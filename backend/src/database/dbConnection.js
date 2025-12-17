const { Pool } = require('pg');

// Only load dotenv in non-production (Cloud Run provides env vars directly)
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch (e) {
    // Ignore dotenv errors in production
  }
}

// Get database URL - in Cloud Run this comes from secrets
// Trim whitespace/newlines that might be in the secret value
// CRITICAL: Wrap everything in try/catch to prevent module load crashes
let databaseUrl = null;
try {
  if (process.env.DATABASE_URL) {
    databaseUrl = String(process.env.DATABASE_URL).trim();
    // Remove any trailing newlines or whitespace
    databaseUrl = databaseUrl.replace(/\n$/, '').replace(/\r$/, '').trim();
    
    // Validate it's not empty after trimming
    if (databaseUrl.length === 0) {
      databaseUrl = null;
    }
  }
} catch (e) {
  console.error('❌ Error processing DATABASE_URL:', e.message);
  databaseUrl = null;
}

// Log connection info (without exposing credentials) - wrapped in try/catch
try {
  if (databaseUrl && databaseUrl.length > 0) {
    try {
      const urlInfo = new URL(databaseUrl);
      console.log(`📊 Database connection: ${urlInfo.protocol}//${urlInfo.hostname}${urlInfo.pathname}`);
    } catch (urlError) {
      console.warn('⚠️  Could not parse DATABASE_URL:', urlError.message);
      console.warn('   DATABASE_URL length:', databaseUrl ? databaseUrl.length : 0);
      // Don't crash - continue with fallback
      databaseUrl = null;
    }
  } else {
    console.error('❌ DATABASE_URL environment variable is not set or empty!');
    console.error('   Falling back to localhost (this will fail in Cloud Run)');
  }
} catch (e) {
  console.error('❌ Error in database URL logging:', e.message);
  // Continue anyway - don't crash the module
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

// Test connection on startup (in production) - async, non-blocking
// Don't block startup if connection fails - it will fail later when actually needed
if (process.env.NODE_ENV === 'production') {
  // Test asynchronously without blocking
  setTimeout(() => {
    pool.query('SELECT NOW()')
      .then(() => {
        console.log('✅ Database connection test successful');
      })
      .catch((err) => {
        console.error('❌ Database connection test failed:', err.message);
        console.error('   DATABASE_URL:', databaseUrl ? 'SET (but connection failed)' : 'NOT SET');
        // Don't throw - let the app start, connection will be retried on actual use
      });
  }, 1000); // Wait 1 second after startup
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};