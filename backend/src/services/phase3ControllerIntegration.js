/**
 * Updated Phase 3 Controller Integration
 * Shows how to integrate the Phase3DataProcessor to ensure all required fields
 * are populated for lifecycle reports
 */

const phase3DataProcessor = require('../services/phase3DataProcessor');
const googleAIResearchService = require('../services/googleAIResearchService');
const { pool } = require('../config/database');

class Phase3Controller {
  /**
   * Run AI research and process results for report compatibility
   */
  async runAIResearch(req, res) {
    const { tenant_id, job_id } = req.body;
    
    try {
      // 1. Fetch products from phase2_analysis
      const products = await this.fetchPhase2Products(tenant_id, job_id);
      
      const results = [];
      
      for (const product of products) {
        try {
          // 2. Perform AI research
          const rawResearchResult = await googleAIResearchService.performResearch({
            product_id: product.product_id,
            manufacturer: product.manufacturer,
            description: product.description,
            product_category: product.product_category
          });
          
          // 3. Merge with existing product data
          const mergedResult = {
            ...product, // Keep all original fields
            ...rawResearchResult, // Add AI research results
            tenant_id,
            job_id,
            research_timestamp: new Date().toISOString()
          };
          
          // 4. Process for report compatibility
          const processedResult = phase3DataProcessor.processForReport(mergedResult)[0];
          
          // 5. Store in phase3_analysis table
          await this.storePhase3Result(processedResult);
          
          results.push(processedResult);
          
          console.log(`✅ Processed ${product.product_id}:`, {
            lifecycle_status: processedResult.lifecycle_status,
            risk_level: processedResult.risk_level,
            confidence: processedResult.overall_confidence,
            has_dates: !!(processedResult.end_of_sale_date || processedResult.end_of_life_date)
          });
          
        } catch (error) {
          console.error(`Failed to process ${product.product_id}:`, error);
          
          // Still store the product with default values
          const failedResult = {
            ...product,
            tenant_id,
            job_id,
            // Default values for failed research
            overall_confidence: 0,
            lifecycle_confidence: 0,
            lifecycle_status: 'Unknown',
            risk_level: 'medium',
            requires_review: true,
            ai_enhanced: false,
            error_message: error.message,
            research_timestamp: new Date().toISOString()
          };
          
          const processedFailure = phase3DataProcessor.processForReport(failedResult)[0];
          await this.storePhase3Result(processedFailure);
          results.push(processedFailure);
        }
      }
      
      // 6. Calculate statistics for the entire dataset
      const statistics = phase3DataProcessor.calculateStatistics(results);
      
      // 7. Update job metadata with statistics
      await this.updateJobStatistics(job_id, statistics);
      
      res.json({
        success: true,
        message: `Processed ${results.length} products`,
        statistics,
        summary: {
          total_processed: results.length,
          successful: results.filter(r => r.ai_enhanced && !r.error_message).length,
          failed: results.filter(r => r.error_message).length,
          requiring_review: results.filter(r => r.requires_review).length
        }
      });
      
    } catch (error) {
      console.error('Phase 3 research failed:', error);
      res.status(500).json({
        success: false,
        message: 'Phase 3 research failed',
        error: error.message
      });
    }
  }

  /**
   * Store Phase 3 result in database
   */
  async storePhase3Result(result) {
    const query = `
      INSERT INTO phase3_analysis (
        tenant_id,
        job_id,
        product_id,
        description,
        manufacturer,
        product_category,
        total_quantity,
        total_value,
        
        -- Phase 2 dates (carried forward)
        end_of_sale_date,
        end_of_sw_maintenance_date,
        end_of_life_date,
        last_day_of_support_date,
        end_of_sw_vulnerability_maintenance_date,
        date_introduced,
        
        -- Calculated fields
        lifecycle_status,
        risk_level,
        is_current_product,
        
        -- Phase 3 specific
        overall_confidence,
        lifecycle_confidence,
        ai_enhanced,
        requires_review,
        data_sources,
        data_sources_metadata,
        
        -- Error handling
        error_message,
        
        -- Timestamps
        research_timestamp,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17,
        $18, $19, $20, $21, $22, $23,
        $24,
        $25, NOW(), NOW()
      )
      ON CONFLICT (tenant_id, job_id, product_id) 
      DO UPDATE SET
        description = EXCLUDED.description,
        manufacturer = EXCLUDED.manufacturer,
        product_category = EXCLUDED.product_category,
        total_quantity = EXCLUDED.total_quantity,
        total_value = EXCLUDED.total_value,
        end_of_sale_date = EXCLUDED.end_of_sale_date,
        end_of_sw_maintenance_date = EXCLUDED.end_of_sw_maintenance_date,
        end_of_life_date = EXCLUDED.end_of_life_date,
        last_day_of_support_date = EXCLUDED.last_day_of_support_date,
        end_of_sw_vulnerability_maintenance_date = EXCLUDED.end_of_sw_vulnerability_maintenance_date,
        date_introduced = EXCLUDED.date_introduced,
        lifecycle_status = EXCLUDED.lifecycle_status,
        risk_level = EXCLUDED.risk_level,
        is_current_product = EXCLUDED.is_current_product,
        overall_confidence = EXCLUDED.overall_confidence,
        lifecycle_confidence = EXCLUDED.lifecycle_confidence,
        ai_enhanced = EXCLUDED.ai_enhanced,
        requires_review = EXCLUDED.requires_review,
        data_sources = EXCLUDED.data_sources,
        data_sources_metadata = EXCLUDED.data_sources_metadata,
        error_message = EXCLUDED.error_message,
        research_timestamp = EXCLUDED.research_timestamp,
        updated_at = NOW()
    `;
    
    const values = [
      result.tenant_id,
      result.job_id,
      result.product_id,
      result.description,
      result.manufacturer,
      result.product_category,
      result.total_quantity || 0,
      result.total_value || 0,
      
      // Date fields (ensuring they're properly formatted)
      result.end_of_sale_date || null,
      result.end_of_sw_maintenance_date || null,
      result.end_of_life_date || null,
      result.last_day_of_support_date || null,
      result.end_of_sw_vulnerability_maintenance_date || null,
      result.date_introduced || null,
      
      // Calculated fields
      result.lifecycle_status || 'Unknown',
      result.risk_level || 'none',
      result.is_current_product || false,
      
      // Phase 3 specific
      result.overall_confidence || 0,
      result.lifecycle_confidence || 0,
      result.ai_enhanced || false,
      result.requires_review || false,
      JSON.stringify(result.data_sources || []),
      JSON.stringify(result.data_sources_metadata || {}),
      
      // Error handling
      result.error_message || null,
      
      // Timestamp
      result.research_timestamp || new Date().toISOString()
    ];
    
    await pool.query(query, values);
  }

  /**
   * Fetch products from Phase 2 analysis
   */
  async fetchPhase2Products(tenant_id, job_id) {
    const query = `
      SELECT 
        product_id,
        description,
        manufacturer,
        product_category,
        total_quantity,
        total_value,
        support_coverage_percentage,
        -- Any existing dates from Phase 2
        end_of_sale_date,
        last_day_of_support_date,
        end_of_life_date
      FROM phase2_analysis
      WHERE tenant_id = $1 AND job_id = $2
      ORDER BY total_value DESC
    `;
    
    const result = await pool.query(query, [tenant_id, job_id]);
    return result.rows;
  }

  /**
   * Update job statistics
   */
  async updateJobStatistics(job_id, statistics) {
    const query = `
      UPDATE jobs
      SET 
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{phase3_statistics}',
          $2::jsonb
        ),
        updated_at = NOW()
      WHERE job_id = $1
    `;
    
    await pool.query(query, [job_id, JSON.stringify(statistics)]);
  }

  /**
   * Get Phase 3 results for report generation
   */
  async getResultsForReport(tenant_id, job_id) {
    const query = `
      SELECT 
        *,
        -- Calculate days until key dates for sorting
        CASE 
          WHEN end_of_life_date IS NOT NULL 
          THEN DATE_PART('day', end_of_life_date::timestamp - NOW())
          ELSE 9999
        END as days_until_eol,
        
        CASE 
          WHEN end_of_sale_date IS NOT NULL 
          THEN DATE_PART('day', end_of_sale_date::timestamp - NOW())
          ELSE 9999
        END as days_until_eos
        
      FROM phase3_analysis
      WHERE tenant_id = $1 AND job_id = $2
      ORDER BY 
        CASE risk_level
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        days_until_eol ASC,
        overall_confidence DESC
    `;
    
    const result = await pool.query(query, [tenant_id, job_id]);
    
    // Process results to ensure all fields are present for reports
    const processedResults = phase3DataProcessor.processForReport(result.rows);
    
    return processedResults;
  }
}

module.exports = new Phase3Controller();

/**
 * Database Schema Update Required:
 * 
 * ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR(50);
 * ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20);
 * ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS ai_enhanced BOOLEAN DEFAULT false;
 * ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS requires_review BOOLEAN DEFAULT false;
 * ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS end_of_life_date DATE;
 * ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS data_sources_metadata JSONB;
 * ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS error_message TEXT;
 * ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS research_timestamp TIMESTAMP;
 * 
 * CREATE INDEX IF NOT EXISTS idx_phase3_risk_level ON phase3_analysis(risk_level);
 * CREATE INDEX IF NOT EXISTS idx_phase3_lifecycle_status ON phase3_analysis(lifecycle_status);
 * CREATE INDEX IF NOT EXISTS idx_phase3_confidence ON phase3_analysis(overall_confidence);
 * CREATE INDEX IF NOT EXISTS idx_phase3_review ON phase3_analysis(requires_review);
 */