-- Phase 3 Analysis Table Schema Migration
-- Adds all required fields for lifecycle report generation
-- Run this migration to ensure Phase 3 data is compatible with report system

-- 1. Add missing date fields
ALTER TABLE phase3_analysis 
ADD COLUMN IF NOT EXISTS end_of_life_date DATE;

COMMENT ON COLUMN phase3_analysis.end_of_life_date IS 'End of Life date - often same as last_day_of_support_date';

-- 2. Add calculated status fields
ALTER TABLE phase3_analysis 
ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR(50) DEFAULT 'Unknown';

COMMENT ON COLUMN phase3_analysis.lifecycle_status IS 'Current/End of Sale/End of Support/End of Life/Unknown';

ALTER TABLE phase3_analysis 
ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20) DEFAULT 'none';

COMMENT ON COLUMN phase3_analysis.risk_level IS 'critical/high/medium/low/none';

-- 3. Add Phase 3 specific flags
ALTER TABLE phase3_analysis 
ADD COLUMN IF NOT EXISTS ai_enhanced BOOLEAN DEFAULT false;

COMMENT ON COLUMN phase3_analysis.ai_enhanced IS 'Whether AI research was successfully performed';

ALTER TABLE phase3_analysis 
ADD COLUMN IF NOT EXISTS requires_review BOOLEAN DEFAULT false;

COMMENT ON COLUMN phase3_analysis.requires_review IS 'Whether manual review is recommended based on confidence/risk';

-- 4. Add metadata fields
ALTER TABLE phase3_analysis 
ADD COLUMN IF NOT EXISTS data_sources_metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN phase3_analysis.data_sources_metadata IS 'Additional metadata about data sources';

ALTER TABLE phase3_analysis 
ADD COLUMN IF NOT EXISTS extraction_metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN phase3_analysis.extraction_metadata IS 'Metadata from the extraction process';

-- 5. Add error handling
ALTER TABLE phase3_analysis 
ADD COLUMN IF NOT EXISTS error_message TEXT;

COMMENT ON COLUMN phase3_analysis.error_message IS 'Error message if research failed';

ALTER TABLE phase3_analysis 
ADD COLUMN IF NOT EXISTS research_timestamp TIMESTAMP;

COMMENT ON COLUMN phase3_analysis.research_timestamp IS 'When the AI research was performed';

-- 6. Ensure all date fields exist
ALTER TABLE phase3_analysis 
ADD COLUMN IF NOT EXISTS end_of_sw_vulnerability_maintenance_date DATE;

COMMENT ON COLUMN phase3_analysis.end_of_sw_vulnerability_maintenance_date IS 'End of security vulnerability support';

ALTER TABLE phase3_analysis 
ADD COLUMN IF NOT EXISTS date_introduced DATE;

COMMENT ON COLUMN phase3_analysis.date_introduced IS 'Date product was introduced to market';

-- 7. Add indexes for report queries
CREATE INDEX IF NOT EXISTS idx_phase3_risk_level 
ON phase3_analysis(tenant_id, job_id, risk_level);

CREATE INDEX IF NOT EXISTS idx_phase3_lifecycle_status 
ON phase3_analysis(tenant_id, job_id, lifecycle_status);

CREATE INDEX IF NOT EXISTS idx_phase3_confidence 
ON phase3_analysis(tenant_id, job_id, overall_confidence);

CREATE INDEX IF NOT EXISTS idx_phase3_review 
ON phase3_analysis(tenant_id, job_id, requires_review);

CREATE INDEX IF NOT EXISTS idx_phase3_eol_date 
ON phase3_analysis(tenant_id, job_id, end_of_life_date);

CREATE INDEX IF NOT EXISTS idx_phase3_eos_date 
ON phase3_analysis(tenant_id, job_id, end_of_sale_date);

-- 8. Create a view for report generation
CREATE OR REPLACE VIEW phase3_report_data AS
SELECT 
  p3.*,
  -- Calculate days until key dates
  CASE 
    WHEN p3.end_of_life_date IS NOT NULL 
    THEN DATE_PART('day', p3.end_of_life_date::timestamp - NOW())
    WHEN p3.last_day_of_support_date IS NOT NULL 
    THEN DATE_PART('day', p3.last_day_of_support_date::timestamp - NOW())
    ELSE NULL
  END as days_until_eol,
  
  CASE 
    WHEN p3.end_of_sale_date IS NOT NULL 
    THEN DATE_PART('day', p3.end_of_sale_date::timestamp - NOW())
    ELSE NULL
  END as days_until_eos,
  
  -- Calculate age of data
  CASE 
    WHEN p3.research_timestamp IS NOT NULL 
    THEN DATE_PART('day', NOW() - p3.research_timestamp)
    ELSE NULL
  END as data_age_days,
  
  -- Risk score for sorting (0-100)
  CASE p3.risk_level
    WHEN 'critical' THEN 100
    WHEN 'high' THEN 75
    WHEN 'medium' THEN 50
    WHEN 'low' THEN 25
    ELSE 0
  END as risk_score,
  
  -- Compliance flags
  CASE 
    WHEN p3.end_of_life_date < NOW() THEN true
    WHEN p3.last_day_of_support_date < NOW() THEN true
    ELSE false
  END as is_non_compliant,
  
  CASE 
    WHEN p3.end_of_sale_date < NOW() THEN true
    ELSE false
  END as is_discontinued
  
FROM phase3_analysis p3;

COMMENT ON VIEW phase3_report_data IS 'View optimized for report generation with calculated fields';

-- 9. Update existing records to populate new fields
-- This is a one-time data migration to ensure existing records have the new fields

-- Map last_day_of_support_date to end_of_life_date where missing
UPDATE phase3_analysis 
SET end_of_life_date = last_day_of_support_date
WHERE end_of_life_date IS NULL 
  AND last_day_of_support_date IS NOT NULL;

-- Calculate lifecycle_status for existing records
UPDATE phase3_analysis 
SET lifecycle_status = 
  CASE 
    WHEN (end_of_life_date < NOW() OR last_day_of_support_date < NOW()) THEN 'End of Life'
    WHEN end_of_sale_date < NOW() THEN 'End of Support'
    WHEN end_of_sale_date < NOW() + INTERVAL '6 months' THEN 'End of Sale'
    WHEN is_current_product = true THEN 'Current'
    WHEN end_of_sale_date IS NULL AND end_of_life_date IS NULL THEN 'Current'
    ELSE 'Unknown'
  END
WHERE lifecycle_status IS NULL OR lifecycle_status = 'Unknown';

-- Calculate risk_level for existing records
UPDATE phase3_analysis 
SET risk_level = 
  CASE 
    WHEN lifecycle_status = 'End of Life' THEN 'critical'
    WHEN (end_of_life_date IS NOT NULL AND end_of_life_date < NOW() + INTERVAL '6 months') THEN 'high'
    WHEN (end_of_life_date IS NOT NULL AND end_of_life_date < NOW() + INTERVAL '1 year') THEN 'medium'
    WHEN (end_of_sale_date IS NOT NULL AND end_of_sale_date < NOW()) THEN 'medium'
    WHEN (end_of_sale_date IS NOT NULL AND end_of_sale_date < NOW() + INTERVAL '3 months') THEN 'low'
    WHEN lifecycle_status = 'Current' THEN 'none'
    ELSE 'low'
  END
WHERE risk_level IS NULL OR risk_level = 'none';

-- Set ai_enhanced flag for records with confidence scores
UPDATE phase3_analysis 
SET ai_enhanced = true
WHERE overall_confidence > 0 
  AND ai_enhanced IS NULL;

-- Determine review requirement
UPDATE phase3_analysis 
SET requires_review = true
WHERE (
  overall_confidence < 60 
  OR lifecycle_confidence < 60
  OR (risk_level IN ('critical', 'high') AND overall_confidence < 80)
  OR (end_of_sale_date IS NULL AND end_of_life_date IS NULL AND last_day_of_support_date IS NULL)
)
AND requires_review IS NULL;

-- 10. Create function to validate Phase 3 data completeness
CREATE OR REPLACE FUNCTION validate_phase3_report_data(p_tenant_id UUID, p_job_id VARCHAR)
RETURNS TABLE (
  validation_check VARCHAR,
  status VARCHAR,
  details TEXT
) AS $$
BEGIN
  -- Check for products missing lifecycle status
  RETURN QUERY
  SELECT 
    'Lifecycle Status'::VARCHAR,
    CASE 
      WHEN COUNT(*) = 0 THEN 'PASS'::VARCHAR
      ELSE 'FAIL'::VARCHAR
    END,
    'Products missing lifecycle status: ' || COUNT(*)::TEXT
  FROM phase3_analysis
  WHERE tenant_id = p_tenant_id 
    AND job_id = p_job_id
    AND (lifecycle_status IS NULL OR lifecycle_status = '');

  -- Check for products missing risk level
  RETURN QUERY
  SELECT 
    'Risk Level'::VARCHAR,
    CASE 
      WHEN COUNT(*) = 0 THEN 'PASS'::VARCHAR
      ELSE 'FAIL'::VARCHAR
    END,
    'Products missing risk level: ' || COUNT(*)::TEXT
  FROM phase3_analysis
  WHERE tenant_id = p_tenant_id 
    AND job_id = p_job_id
    AND (risk_level IS NULL OR risk_level = '');

  -- Check for products with no dates
  RETURN QUERY
  SELECT 
    'Date Coverage'::VARCHAR,
    CASE 
      WHEN COUNT(*) = 0 THEN 'PASS'::VARCHAR
      ELSE 'WARN'::VARCHAR
    END,
    'Products with no lifecycle dates: ' || COUNT(*)::TEXT
  FROM phase3_analysis
  WHERE tenant_id = p_tenant_id 
    AND job_id = p_job_id
    AND end_of_sale_date IS NULL 
    AND end_of_life_date IS NULL 
    AND last_day_of_support_date IS NULL;

  -- Check confidence scores
  RETURN QUERY
  SELECT 
    'Confidence Scores'::VARCHAR,
    CASE 
      WHEN AVG(overall_confidence) > 60 THEN 'PASS'::VARCHAR
      ELSE 'WARN'::VARCHAR
    END,
    'Average confidence: ' || ROUND(AVG(overall_confidence), 1)::TEXT || '%'
  FROM phase3_analysis
  WHERE tenant_id = p_tenant_id 
    AND job_id = p_job_id;

  -- Check products requiring review
  RETURN QUERY
  SELECT 
    'Review Required'::VARCHAR,
    'INFO'::VARCHAR,
    'Products requiring review: ' || COUNT(*)::TEXT || ' (' || 
    ROUND(COUNT(*)::NUMERIC / NULLIF((SELECT COUNT(*) FROM phase3_analysis 
      WHERE tenant_id = p_tenant_id AND job_id = p_job_id), 0) * 100, 1)::TEXT || '%)'
  FROM phase3_analysis
  WHERE tenant_id = p_tenant_id 
    AND job_id = p_job_id
    AND requires_review = true;

  RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_phase3_report_data IS 'Validates Phase 3 data completeness for report generation';

-- Usage: SELECT * FROM validate_phase3_report_data('tenant_uuid', 'job_id');