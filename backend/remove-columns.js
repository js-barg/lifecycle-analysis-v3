require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'lifecycle_analysis',
  user: 'postgres',
  password: 'labyrinth'
});

async function removeColumns() {
  try {
    console.log('Removing unwanted columns from raw_inventory...');
    
    await pool.query('ALTER TABLE raw_inventory DROP COLUMN IF EXISTS warranty_end_date');
    console.log('  - Removed warranty_end_date');
    
    await pool.query('ALTER TABLE raw_inventory DROP COLUMN IF EXISTS sales_order_number');
    console.log('  - Removed sales_order_number');
    
    await pool.query('ALTER TABLE raw_inventory DROP COLUMN IF EXISTS ordered_from');
    console.log('  - Removed ordered_from');
    
    await pool.query('ALTER TABLE raw_inventory DROP COLUMN IF EXISTS order_date');
    console.log('  - Removed order_date');
    
    console.log('Columns removed successfully');
  } catch (err) {
    console.error('Error:', err.message);
  }
  pool.end();
}

removeColumns();
