// update-phase3-simple.js
// Uses your existing database connection from backend

const db = require('./src/database/dbConnection');

async function updateSchema() {
  try {
    console.log('Starting Phase 3 schema updates...\n');
    
    // Add columns to phase3_analysis table
    const phase3AnalysisUpdates = [
      "ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS total_value DECIMAL(15,2)",
      "ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS end_of_sale_date DATE",
      "ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS end_of_sw_maintenance_date DATE",
      "ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS end_of_life_date DATE",
      "ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS last_day_of_support_date DATE",
      "ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS end_of_sw_vulnerability_maintenance_date DATE",
      "ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS date_introduced DATE",
      "ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR(50)",
      "ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20)",
      "ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS is_current_product BOOLEAN DEFAULT FALSE",
      "ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS overall_confidence INTEGER DEFAULT 0",
      "ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS lifecycle_confidence INTEGER DEFAULT 0",
      "ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS manufacturer_confidence INTEGER DEFAULT 0",
      "ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS category_confidence INTEGER DEFAULT 0",
      "ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS ai_enhanced BOOLEAN DEFAULT FALSE",
      "ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS requires_review BOOLEAN DEFAULT FALSE",
      "ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS data_sources JSONB",
      "ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS research_completed_at TIMESTAMP",
      "ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS support_coverage_percent DECIMAL(5,2)",
      "ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()"
    ];
    
    console.log('Updating phase3_analysis table...');
    for (const query of phase3AnalysisUpdates) {
      try {
        await db.query(query);
        const columnName = query.match(/ADD COLUMN IF NOT EXISTS (\w+)/)[1];
        console.log('✓ Added column: ' + columnName);
      } catch (err) {
        if (err.code === '42701') { // Column already exists
          const columnName = query.match(/ADD COLUMN IF NOT EXISTS (\w+)/)[1];
          console.log('→ Column already exists: ' + columnName);
        } else {
          console.error('✗ Error: ' + err.message);
        }
      }
    }
    
    console.log('\n');
    
    // Add columns to phase3_jobs table
    const phase3JobsUpdates = [
      "ALTER TABLE phase3_jobs ADD COLUMN IF NOT EXISTS products_researched INTEGER DEFAULT 0",
      "ALTER TABLE phase3_jobs ADD COLUMN IF NOT EXISTS products_enhanced INTEGER DEFAULT 0",
      "ALTER TABLE phase3_jobs ADD COLUMN IF NOT EXISTS products_no_data_found INTEGER DEFAULT 0",
      "ALTER TABLE phase3_jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP",
      "ALTER TABLE phase3_jobs ADD COLUMN IF NOT EXISTS avg_confidence_score DECIMAL(5,2)"
    ];
    
    console.log('Updating phase3_jobs table...');
    for (const query of phase3JobsUpdates) {
      try {
        await db.query(query);
        const columnName = query.match(/ADD COLUMN IF NOT EXISTS (\w+)/)[1];
        console.log('✓ Added column: ' + columnName);
      } catch (err) {
        if (err.code === '42701') { // Column already exists
          const columnName = query.match(/ADD COLUMN IF NOT EXISTS (\w+)/)[1];
          console.log('→ Column already exists: ' + columnName);
        } else {
          console.error('✗ Error: ' + err.message);
        }
      }
    }
    
    console.log('\n✅ Schema update complete!');
    console.log('\nYou can now run Phase 3 AI Research.');
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error updating schema:', error);
    process.exit(1);
  }
}

// Run the update
updateSchema();