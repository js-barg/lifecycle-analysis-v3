// backend/src/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Import routes
const uploadRoutes = require('./routes/upload.routes');
const phase2Routes = require('./routes/phase2.routes');// Add after other route imports
const phase3Routes = require('./routes/phase3.routes');


// API Routes
app.use('/api/phase1', uploadRoutes);
app.use('/api/phase2', phase2Routes);
app.use('/api/phase3', phase3Routes);

// Debug endpoint to verify Phase 2 is mounted
app.get('/api/phase2/test', (req, res) => {
  res.json({ message: 'Phase 2 API is working' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// In backend/src/app.js - WORKING VERSION
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

module.exports = app;