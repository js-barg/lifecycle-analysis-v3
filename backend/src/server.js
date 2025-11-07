// backend/src/server.js
const app = require('./app');
const logger = require('./config/logger');

const PORT = process.env.PORT || 3001;

// Migration route - FIXED VERSION
app.get('/api/migrate/add-estimation-metadata', async (req, res) => {
  console.log('Migration route called');
  
  try {
    // Move the require INSIDE the try block
    const pool = require('./database/dbConnection');
    const client = await pool.connect();
    
    await client.query('ALTER TABLE phase3_analysis ADD COLUMN IF NOT EXISTS estimation_metadata JSONB');
    
    client.release();
    
    res.json({ success: true, message: 'Migration complete - estimation_metadata column added!' });
    console.log('✅ Added estimation_metadata column to phase3_analysis table');
    
  } catch (error) {
    if (error.code === '42701') { // Column already exists
      res.json({ success: true, message: 'Column already exists', alreadyExists: true });
    } else {
      console.error('Migration error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Phase 1 API: http://localhost:${PORT}/api/phase1`);
  console.log(`Phase 2 API: http://localhost:${PORT}/api/phase2`);
  console.log(`Migration API: http://localhost:${PORT}/api/migrate/add-estimation-metadata`);
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