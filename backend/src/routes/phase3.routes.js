const express = require('express');
const router = express.Router();
const phase3Controller = require('../controllers/phase3Controller');
const lifecycleReportController = require('../controllers/lifecycleReportController');

// Phase 3 initialization and research
router.post('/initialize', phase3Controller.initializePhase3.bind(phase3Controller));
router.post('/run-research', phase3Controller.runAIResearch.bind(phase3Controller));
router.get('/research-progress/:jobId', phase3Controller.getResearchProgress.bind(phase3Controller));
router.get('/results/:jobId', phase3Controller.getResults.bind(phase3Controller));

// Report endpoints
// Add these routes if not already present
router.post('/reports/generate', (req, res) => lifecycleReportController.generateLifecycleReport(req, res));
router.post('/reports/export/lifecycle-report-excel', (req, res) => lifecycleReportController.exportLifecycleReportExcel(req, res));

// Simple Phase 3 results export
router.post('/export-results', phase3Controller.exportPhase3Results);

module.exports = router;