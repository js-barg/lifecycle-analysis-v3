const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'lifecycle_analysis',
  user: 'postgres',
  password: 'labyrinth'
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database Error:', err.message);
    console.error('Check your password in backend/.env file');
  } else {
    console.log('Database Connected Successfully:', res.rows[0].now);
  }
  pool.end();
});
