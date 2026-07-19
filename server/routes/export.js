const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');

// GET /api/export/pdf - Export ke PDF
router.get('/pdf', exportController.exportPDF);

// GET /api/export/excel - Export ke Excel
router.get('/excel', exportController.exportExcel);

// GET /api/export/pdf-bulanan - Export rekap bulanan ke PDF
router.get('/pdf-bulanan', exportController.exportPDFBulanan);

// GET /api/export/excel-bulanan - Export rekap bulanan ke Excel
router.get('/excel-bulanan', exportController.exportExcelBulanan);

module.exports = router;
