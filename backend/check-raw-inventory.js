require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'lifecycle_analysis',
  user: 'postgres',
  password: 'labyrinth'
});

async function checkRawInventory() {
  try {
    const result = await pool.query(
      "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'raw_inventory' ORDER BY ordinal_position"
    );
    console.log('raw_inventory table columns:');
    result.rows.forEach(row => 
      console.log('  -', row.column_name, ':', row.data_type, row.is_nullable === 'NO' ? '(REQUIRED)' : '')
    );
  } catch (err) {
    console.error('Error:', err.message);
  }
  pool.end();
}

checkRawInventory();
