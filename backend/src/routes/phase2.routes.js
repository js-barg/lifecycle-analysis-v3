// backend/src/routes/phase2.routes.js
const express = require('express');
const router = express.Router();
const phase2Controller = require('../controllers/phase2Controller');

// Phase 2 Enhanced Inventory endpoints
router.post('/analyze', phase2Controller.processPhase2Analysis);

// Inventory management
router.get('/results/:jobId', phase2Controller.getPhase2Results);
router.get('/status/:jobId', phase2Controller.getPhase2Status);
router.put('/item/:jobId/:itemId', phase2Controller.updateInventoryItem);
router.post('/bulk-update/:jobId', phase2Controller.bulkUpdateItems);
router.get('/changes/:jobId', phase2Controller.getModificationHistory);

// Analysis and Phase 3 preparation
router.post('/analyze-fields/:jobId', phase2Controller.analyzeAndFillFields);
router.post('/save-for-phase3/:jobId', phase2Controller.saveForPhase3);

// Export functionality
router.get('/export/:jobId', phase2Controller.exportPhase2Results);

// Saved filters management
router.get('/filters', phase2Controller.getSavedFilters);
router.post('/filters', phase2Controller.saveFilter);
router.get('/filters/:filterName', phase2Controller.loadFilterByName);
router.delete('/filters/:filterName', phase2Controller.deleteFilter);

module.exports = router;