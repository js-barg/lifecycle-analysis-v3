// backend/src/routes/upload.routes.js
const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');

// File upload endpoint
router.post('/upload', uploadController.upload, uploadController.uploadFile);

// Status check endpoint
router.get('/status/:jobId', uploadController.getJobStatus);

// Results endpoint  
router.get('/results/:jobId', uploadController.getResults);

// Export endpoint
router.get('/export/:jobId', uploadController.exportResults);

// Filter management endpoints
router.get('/filters', uploadController.getFilterSets);
router.get('/filters/:filterId', uploadController.getFilterSet);
router.post('/filters', uploadController.createFilterSet);
router.put('/filters/:filterId', uploadController.updateFilterSet);
router.delete('/filters/:filterId', uploadController.deleteFilterSet);
router.post('/filters/active', uploadController.setActiveFilter);
router.post('/filters/preview', uploadController.previewFilter);

module.exports = router;