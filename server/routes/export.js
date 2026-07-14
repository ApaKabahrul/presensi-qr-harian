const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');

// GET /api/export/pdf - Export ke PDF
router.get('/pdf', exportController.exportPDF);

// GET /api/export/excel - Export ke Excel
router.get('/excel', exportController.exportExcel);

module.exports = router;
