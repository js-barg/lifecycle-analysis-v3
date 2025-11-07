require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'lifecycle_analysis',
  user: 'postgres',
  password: 'labyrinth'
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error:', err.message);
  } else {
    console.log('Connected:', res.rows[0].now);
  }
  pool.end();
});
