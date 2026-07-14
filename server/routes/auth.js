const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// GET /api/auth/check - Cek status login
router.get('/check', authController.checkAuth);

// POST /api/auth/login - Login
router.post('/login', authController.login);

// GET /api/auth/logout - Logout
router.get('/logout', authController.logout);

module.exports = router;
