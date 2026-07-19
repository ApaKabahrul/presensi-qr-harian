const express = require('express');
const router = express.Router();
const presensiController = require('../controllers/presensiController');

// GET /api/presensi/rekap - Dapatkan rekap presensi (MUST be before /:tanggal)
router.get('/rekap', presensiController.getRekap);

// GET /api/presensi/rekap-bulanan - Dapatkan rekap bulanan per murid (MUST be before /:tanggal)
router.get('/rekap-bulanan', presensiController.getRekapBulanan);

// GET /api/presensi/statistik - Dapatkan statistik presensi (MUST be before /:tanggal)
router.get('/statistik', presensiController.getStatistik);

// GET /api/presensi/:tanggal - Dapatkan presensi berdasarkan tanggal (CATCH-ALL, must be last)
router.get('/:tanggal', presensiController.getPresensiByDate);

// POST /api/presensi/scan - Scan QR untuk presensi
router.post('/scan', presensiController.scanQR);

// POST /api/presensi/manual - Absen manual
router.post('/manual', presensiController.absenManual);

// PUT /api/presensi/koreksi - Koreksi presensi
router.put('/koreksi', presensiController.koreksiPresensi);

// POST /api/presensi/tutup - Tutup presensi dan auto Alpha
router.post('/tutup', presensiController.tutupPresensi);

module.exports = router;
