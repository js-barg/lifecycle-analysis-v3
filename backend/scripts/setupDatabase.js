require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'lifecycle_analysis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

const tables = {
  raw_inventory: `
    CREATE TABLE IF NOT EXISTS raw_inventory (
      id SERIAL PRIMARY KEY,
      tenant_id VARCHAR(255) NOT NULL,
      job_id VARCHAR(255) NOT NULL,
      manufacturer VARCHAR(255),
      product_id VARCHAR(255),
      description TEXT,
      quantity INTEGER,
      cost DECIMAL(15,2),
      product_type VARCHAR(255),
      product_category VARCHAR(255),
      purchase_date DATE,
      ship_date DATE,
      support_contract_active BOOLEAN,
      support_start_date DATE,
      support_end_date DATE,
      date_introduced DATE,
      end_of_sale_date DATE,
      end_of_sw_vulnerability_maintenance_date DATE,
      last_day_of_support_date DATE,
      end_of_life_date DATE,
      warranty_end_date DATE,
      sales_order_number VARCHAR(255),
      ordered_from VARCHAR(255),
      order_date DATE,
      quote_number VARCHAR(255),
      business_entity VARCHAR(255),
      asset_type VARCHAR(255),
      service_contract VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

  inventory_analysis: `
    CREATE TABLE IF NOT EXISTS inventory_analysis (
      id SERIAL PRIMARY KEY,
      tenant_id VARCHAR(255) NOT NULL,
      job_id VARCHAR(255) NOT NULL,
      product_id VARCHAR(255) NOT NULL,
      description TEXT,
      manufacturer VARCHAR(255),
      product_category VARCHAR(255),
      product_type VARCHAR(255),
      business_entity VARCHAR(255),
      asset_type VARCHAR(255),
      service_contract VARCHAR(255),
      total_quantity INTEGER,
      total_value DECIMAL(15,2),
      support_coverage_percent DECIMAL(5,2),
      purchase_dates JSONB,
      end_of_sale_date DATE,
      last_day_of_support_date DATE,
      end_of_life_date DATE,
      warranty_end_date DATE,
      lifecycle_status VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, job_id, product_id)
    )`,

  upload_jobs: `
    CREATE TABLE IF NOT EXISTS upload_jobs (
      job_id VARCHAR(255) PRIMARY KEY,
      tenant_id VARCHAR(255) NOT NULL,
      original_filename VARCHAR(255),
      file_path TEXT,
      file_size_bytes INTEGER,
      file_type VARCHAR(50),
      status VARCHAR(50),
      progress INTEGER DEFAULT 0,
      total_rows_uploaded INTEGER,
      total_rows_processed INTEGER,
      total_products_identified INTEGER,
      total_inventory_value DECIMAL(15,2),
      errors JSONB,
      warnings JSONB,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      processing_time_seconds INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

  lifecycle_reports: `
    CREATE TABLE IF NOT EXISTS lifecycle_reports (
      report_id VARCHAR(255) PRIMARY KEY,
      tenant_id VARCHAR(255) NOT NULL,
      job_id VARCHAR(255) NOT NULL,
      phase INTEGER NOT NULL,
      report_type VARCHAR(50) NOT NULL,
      report_name VARCHAR(255),
      file_path TEXT,
      file_size_bytes INTEGER,
      report_config JSONB,
      generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
};

const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_raw_inventory_tenant ON raw_inventory(tenant_id)',
  'CREATE INDEX IF NOT EXISTS idx_raw_inventory_job ON raw_inventory(job_id)',
  'CREATE INDEX IF NOT EXISTS idx_inventory_analysis_tenant ON inventory_analysis(tenant_id)',
  'CREATE INDEX IF NOT EXISTS idx_inventory_analysis_job ON inventory_analysis(job_id)',
  'CREATE INDEX IF NOT EXISTS idx_upload_jobs_tenant ON upload_jobs(tenant_id)',
  'CREATE INDEX IF NOT EXISTS idx_upload_jobs_status ON upload_jobs(status)',
  'CREATE INDEX IF NOT EXISTS idx_lifecycle_reports_tenant ON lifecycle_reports(tenant_id)',
  'CREATE INDEX IF NOT EXISTS idx_lifecycle_reports_job ON lifecycle_reports(job_id)'
];

async function setupDatabase() {
  let client;
  
  try {
    console.log('🚀 Starting database setup...');
    console.log(`📍 Connecting to ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    
    client = await pool.connect();
    console.log('✅ Database connection successful');
    
    // Create tables
    for (const [tableName, createSQL] of Object.entries(tables)) {
      console.log(`📝 Creating table: ${tableName}`);
      await client.query(createSQL);
      console.log(`✅ Table ${tableName} created/verified`);
    }
    
    // Create indexes
    console.log('📑 Creating indexes...');
    for (const indexSQL of indexes) {
      await client.query(indexSQL);
    }
    console.log('✅ All indexes created/verified');
    
    // Verify tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('\n📊 Database tables:');
    result.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    console.log('\n✨ Database setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('\nPossible issues:');
    console.error('1. PostgreSQL is not running');
    console.error('2. Wrong password in .env file');
    console.error('3. Database "lifecycle_planning" does not exist');
    console.error('\nTo fix:');
    console.error('1. Make sure PostgreSQL service is running');
    console.error('2. Update DB_PASSWORD in .env file');
    console.error('3. Create database: psql -U postgres -c "CREATE DATABASE lifecycle_planning;"');
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

setupDatabase();