const { Pool } = require('pg');

// Only load dotenv in non-production (Cloud Run provides env vars directly)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Get database URL - in Cloud Run this comes from secrets
const databaseUrl = process.env.DATABASE_URL;

// Log connection info (without exposing credentials)
if (databaseUrl) {
  const urlInfo = new URL(databaseUrl);
  console.log(`📊 Database connection: ${urlInfo.protocol}//${urlInfo.hostname}${urlInfo.pathname}`);
} else {
  console.error('❌ DATABASE_URL environment variable is not set!');
  console.error('   Falling back to localhost (this will fail in Cloud Run)');
}

const pool = new Pool({
  connectionString: databaseUrl || 'postgresql://localhost:5432/lifecycle_db',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err, client) => {
  console.error('❌ Unexpected error on idle client', err);
});

// Test connection on startup (in production)
if (process.env.NODE_ENV === 'production') {
  pool.query('SELECT NOW()')
    .then(() => {
      console.log('✅ Database connection successful');
    })
    .catch((err) => {
      console.error('❌ Database connection failed:', err.message);
      console.error('   DATABASE_URL:', databaseUrl ? 'SET' : 'NOT SET');
    });
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};