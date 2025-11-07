require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'lifecycle_analysis',
  user: 'postgres',
  password: 'labyrinth'
});

async function checkTables() {
  try {
    const result = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    console.log('Tables in database:');
    result.rows.forEach(row => console.log('  -', row.table_name));
  } catch (err) {
    console.error('Error:', err.message);
  }
  pool.end();
}

checkTables();
