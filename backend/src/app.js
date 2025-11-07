// backend/src/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Import routes
const uploadRoutes = require('./routes/upload.routes');
const phase2Routes = require('./routes/phase2.routes');
const phase3Routes = require('./routes/phase3.routes');

// API Routes
app.use('/api/phase1', uploadRoutes);
app.use('/api/phase2', phase2Routes);
app.use('/api/phase3', phase3Routes);

// Debug endpoint to verify Phase 2 is mounted
app.get('/api/phase2/test', (req, res) => {
  res.json({ message: 'Phase 2 API is working' });
});

// Migration route
app.get('/api/migrate/add-estimation-metadata', async (req, res) => {
  console.log('Migration route called');
  
  try {
    const db = require('./database/dbConnection');
    const client = await db.pool.connect(); // Access .pool property!
    
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

// Serve static frontend files (after all API routes)
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// Catch-all route for React Router (must be last)
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../public/index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(404).json({ 
        error: 'Frontend not found', 
        message: 'Please ensure frontend is built and deployed',
        path: indexPath 
      });
    }
  });
});

// Error handling middleware (must be after all routes)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

module.exports = app;