require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'lifecycle_analysis',
  user: 'postgres',
  password: 'labyrinth'
});

async function checkTable() {
  try {
    const result = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'upload_jobs' ORDER BY ordinal_position"
    );
    console.log('upload_jobs columns:');
    result.rows.forEach(row => {
      console.log('  -', row.column_name, ':', row.data_type);
    });
  } catch (err) {
    console.error('Error:', err.message);
  }
  pool.end();
}

checkTable();
