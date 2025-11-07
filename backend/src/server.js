// backend/src/server.js
const app = require('./app');
const logger = require('./config/logger');

// Use PORT from environment or default to 8080 for Cloud Run
const PORT = process.env.PORT || 8080;  // CHANGE to 8080!

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