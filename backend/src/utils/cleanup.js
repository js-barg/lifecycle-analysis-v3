const FileSecurity = require('./fileSecurity');
const logger = require('../config/logger');
const path = require('path');

/**
 * Run periodic cleanup of old uploaded files
 */
async function runCleanup() {
  try {
    const uploadDir = path.resolve(process.env.UPLOAD_TEMP_DIR || './uploads');
    await FileSecurity.cleanupOldFiles(uploadDir, 24); // Clean files older than 24 hours
    logger.info('Cleanup completed successfully');
  } catch (error) {
    logger.error('Cleanup failed:', error);
  }
}

// Run cleanup every hour if this script is run directly
if (require.main === module) {
  // Run immediately
  runCleanup();
  
  // Then run every hour
  setInterval(runCleanup, 60 * 60 * 1000);
  
  logger.info('Cleanup service started - running every hour');
}

module.exports = { runCleanup };