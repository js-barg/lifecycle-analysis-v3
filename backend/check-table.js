const { pool } = require('./src/config/database');

async function checkTable() {
  try {
    const result = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'upload_jobs'"
    );
    console.log('upload_jobs columns:', result.rows);
    pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    pool.end();
  }
}

checkTable();
