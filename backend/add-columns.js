require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'lifecycle_analysis',
  user: 'postgres',
  password: 'labyrinth'
});

async function addMissingColumns() {
  try {
    // Add customer_name column if missing
    await pool.query("ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255)");
    console.log('Added customer_name column');
    
    // Add file_name column if missing  
    await pool.query("ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)");
    console.log('Added file_name column');
    
    // Add rows_processed column if missing
    await pool.query("ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS rows_processed INTEGER DEFAULT 0");
    console.log('Added rows_processed column');
    
  } catch (err) {
    console.error('Error:', err.message);
  }
  pool.end();
}

addMissingColumns();
