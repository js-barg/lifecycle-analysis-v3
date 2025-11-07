-- Create database if not exists
-- CREATE DATABASE lifecycle_db;

-- Phase 3 Analysis Table
CREATE TABLE IF NOT EXISTS phase3_analysis (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(255) NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  manufacturer VARCHAR(255),
  product_category VARCHAR(255),
  product_type VARCHAR(100),
  description TEXT,
  total_quantity INTEGER DEFAULT 0,
  
  -- Lifecycle dates from AI research
  date_introduced DATE,
  end_of_sale_date DATE,
  end_of_sw_maintenance_date DATE,
  end_of_sw_vulnerability_maintenance_date DATE,
  last_day_of_support_date DATE,
  
  -- AI research metadata
  ai_enhanced BOOLEAN DEFAULT FALSE,
  is_current_product BOOLEAN DEFAULT FALSE,
  manufacturer_confidence INTEGER DEFAULT 0,
  category_confidence INTEGER DEFAULT 0,
  lifecycle_confidence INTEGER DEFAULT 0,
  overall_confidence INTEGER DEFAULT 0,
  
  -- Support coverage calculation
  support_coverage_percent DECIMAL(5,2),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  research_completed_at TIMESTAMP,
  data_sources JSONB,
  
  -- Unique constraint per job
  UNIQUE(job_id, product_id)
);

-- Raw inventory table for year distribution
CREATE TABLE IF NOT EXISTS raw_inventory (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(255) NOT NULL,
  product_id VARCHAR(255),
  quantity INTEGER,
  ship_date DATE,
  purchase_date DATE,
  order_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_phase3_job_product ON phase3_analysis(job_id, product_id);
CREATE INDEX IF NOT EXISTS idx_phase3_manufacturer ON phase3_analysis(manufacturer);
CREATE INDEX IF NOT EXISTS idx_raw_inventory_job_product ON raw_inventory(job_id, product_id);

-- Phase 3 jobs tracking
CREATE TABLE IF NOT EXISTS phase3_jobs (
  job_id VARCHAR(255) PRIMARY KEY,
  phase2_job_id VARCHAR(255),
  customer_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'initialized',
  product_count INTEGER DEFAULT 0,
  research_started_at TIMESTAMP,
  research_completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);