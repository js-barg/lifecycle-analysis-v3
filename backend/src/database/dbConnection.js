console.log('=== DBCONNECTION v2025-12-17-A LOADING ===');
console.log('=== DATABASE_URL at load:', process.env.DATABASE_URL ? 'SET' : 'NOT SET', '===');
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
  // Debug: Check if DATABASE_URL exists in process.env
  console.log('🔍 DATABASE_URL check:');
  console.log('   process.env.DATABASE_URL exists?', !!process.env.DATABASE_URL);
  console.log('   process.env.DATABASE_URL type:', typeof process.env.DATABASE_URL);
  console.log('   process.env.DATABASE_URL length:', process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0);
  console.log('   NODE_ENV:', process.env.NODE_ENV);
  console.log('   databaseUrl after processing:', databaseUrl ? `SET (length: ${databaseUrl.length})` : 'NULL');
  
  if (databaseUrl && databaseUrl.length > 0) {
    try {
      const urlInfo = new URL(databaseUrl);
      console.log(`📊 Database connection: ${urlInfo.protocol}//${urlInfo.hostname}${urlInfo.pathname}`);
    } catch (urlError) {
      console.warn('⚠️  Could not parse DATABASE_URL for logging (this is OK for socket URLs):', urlError.message);
      console.warn('   DATABASE_URL length:', databaseUrl ? databaseUrl.length : 0);
      // DON'T reset databaseUrl - the connection string is still valid even if URL parsing fails
      // Socket URLs like postgresql://user:pass@/db?host=/cloudsql/... may not parse as standard URLs
    }
  } else {
    console.error('❌ DATABASE_URL environment variable is not set or empty!');
    console.error('   Falling back to localhost (this will fail in Cloud Run)');
    console.error('   This means the secret is not being injected properly!');
  }
} catch (e) {
  console.error('❌ Error in database URL logging:', e.message);
  // Continue anyway - don't crash the module
}

// Log what we're using for connection (for debugging)
if (!databaseUrl) {
  console.error('❌ CRITICAL: DATABASE_URL is null/empty, using localhost fallback (will fail in Cloud Run)');
  console.error('   process.env.DATABASE_URL exists?', !!process.env.DATABASE_URL);
  console.error('   process.env.DATABASE_URL length:', process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0);
  console.error('   NODE_ENV:', process.env.NODE_ENV);
} else {
  console.log('✅ Using DATABASE_URL for connection (length:', databaseUrl.length, ')');
  
  // Check if we're in production and using localhost (which won't work with Cloud SQL)
  if (process.env.NODE_ENV === 'production' || process.env.K_SERVICE) {
    // Check if connection string contains localhost or 127.0.0.1
    if (databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1') || databaseUrl.includes(':5432')) {
      console.error('❌ CRITICAL: DATABASE_URL appears to use localhost/TCP connection in Cloud Run!');
      console.error('   Cloud Run requires Unix socket connection format:');
      console.error('   postgresql://user:password@/database?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME&sslmode=disable');
      console.error('   Current connection string starts with:', databaseUrl.substring(0, 50) + '...');
      console.error('   Please update the DATABASE_URL secret using:');
      console.error('   ./update-database-secret.sh (or .ps1 on Windows)');
    } else if (databaseUrl.includes('/cloudsql/')) {
      console.log('✅ DATABASE_URL uses Cloud SQL Unix socket format (correct for Cloud Run)');
    }
  }
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
        console.error('   Error code:', err.code);
        console.error('   DATABASE_URL:', databaseUrl ? 'SET (but connection failed)' : 'NOT SET');
        
        // Provide helpful error messages for common issues
        if (err.code === 'ECONNREFUSED') {
          console.error('');
          console.error('   🔧 TROUBLESHOOTING: Connection refused (ECONNREFUSED)');
          if (process.env.NODE_ENV === 'production' || process.env.K_SERVICE) {
            console.error('   This usually means:');
            console.error('   1. DATABASE_URL is using localhost/127.0.0.1 instead of Cloud SQL Unix socket');
            console.error('   2. The secret needs to be updated with format:');
            console.error('      postgresql://user:password@/database?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME&sslmode=disable');
            console.error('   3. Run: ./update-database-secret.sh to fix this');
          } else {
            console.error('   This usually means PostgreSQL is not running locally');
            console.error('   Or DATABASE_URL is pointing to wrong host/port');
          }
        }
        // Don't throw - let the app start, connection will be retried on actual use
      });
  }, 1000); // Wait 1 second after startup
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};