// backend/src/server.js
// CRITICAL: Load environment variables FIRST before anything else
// This must happen before requiring app.js or any services
// In Cloud Run, environment variables come from Secret Manager
// In local dev, they come from .env file

const path = require('path');
const fs = require('fs');

// Only load dotenv if not in production (Cloud Run provides env vars directly)
if (process.env.NODE_ENV !== 'production') {
  // Load .env from backend directory
  // This file is at: backend/src/server.js
  // .env file is at: backend/.env (C:\development\lifecycle-analysis\backend\.env)
  const envPath = path.join(__dirname, '../.env');
  
  console.log(`🔍 Loading environment variables...`);
  console.log(`   __dirname: ${__dirname}`);
  console.log(`   Looking for .env at: ${envPath}`);
  
  if (fs.existsSync(envPath)) {
    const result = require('dotenv').config({ path: envPath });
    if (result.error) {
      console.error(`❌ Error loading .env file:`, result.error);
    } else {
      console.log(`✅ Loaded environment variables from: ${envPath}`);
      console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 20) + '...' : 'NOT SET'}`);
      console.log(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.substring(0, 20) + '...' : 'NOT SET'}`);
      console.log(`   AI_RESEARCH_PROVIDER: ${process.env.AI_RESEARCH_PROVIDER || 'NOT SET (will default to gemini)'}`);
    }
  } else {
    console.log(`⚠️  .env file not found at: ${envPath}`);
    console.log(`   Trying default dotenv behavior (current working directory)...`);
    const result = require('dotenv').config();
    if (result.error) {
      console.error(`❌ Error loading .env:`, result.error);
    } else if (result.parsed) {
      console.log(`✅ Loaded .env from default location`);
      console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 20) + '...' : 'NOT SET'}`);
      console.log(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.substring(0, 20) + '...' : 'NOT SET'}`);
      console.log(`   AI_RESEARCH_PROVIDER: ${process.env.AI_RESEARCH_PROVIDER || 'NOT SET (will default to gemini)'}`);
    } else {
      console.log(`⚠️  No .env file found in default location either`);
    }
  }
} else {
  console.log(`ℹ️  Production mode - using environment variables from Cloud Run`);
}

// NOW load app and other modules (after env vars are loaded)
const app = require('./app');
const logger = require('./config/logger');

// Use 3001 for local dev, 8080 for production (Cloud Run)
// Cloud Run will set PORT=8080 automatically
const PORT = process.env.NODE_ENV === 'production' 
  ? (process.env.PORT || 8080)
  : (process.env.PORT ? parseInt(process.env.PORT) : 3001);

// Start server
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 API Endpoints:`);
  console.log(`   - Health: http://localhost:${PORT}/api/health`);
  console.log(`   - Phase 1: http://localhost:${PORT}/api/phase1`);
  console.log(`   - Phase 2: http://localhost:${PORT}/api/phase2`);
  console.log(`   - Phase 3: http://localhost:${PORT}/api/phase3`);
  logger.info(`Server started on port ${PORT}`);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

module.exports = server;