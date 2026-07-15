const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const muridController = require('../controllers/muridController');

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../public/uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'foto-' + req.params.id_murid + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|webp)$/i)) {
      return cb(new Error('Hanya file JPG, PNG, dan WEBP yang diperbolehkan'));
    }
    cb(null, true);
  }
});

// GET /api/murid - Dapatkan semua data murid
router.get('/', muridController.getMurid);

// POST /api/murid - Tambah murid baru
router.post('/', muridController.addMurid);

// GET /api/murid/qr/pdf - Download semua QR code murid dalam satu PDF
router.get('/qr/pdf', muridController.downloadAllQRPDF);

// PUT /api/murid/:id_murid - Update data murid
router.put('/:id_murid', muridController.updateMurid);

// DELETE /api/murid/:id_murid - Hapus murid
router.delete('/:id_murid', muridController.deleteMurid);

// POST /api/murid/:id_murid/regenerate-qr - Generate ulang QR token
router.post('/:id_murid/regenerate-qr', muridController.regenerateQRToken);

// POST /api/murid/:id_murid/upload-foto - Upload foto profil murid
router.post('/:id_murid/upload-foto', upload.single('foto'), muridController.uploadFotoProfil);

module.exports = router;
