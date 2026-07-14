const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'presensi-qr-harian-jwt-secret-2026';
const JWT_EXPIRES_IN = '24h';

function generateToken(guru) {
  return jwt.sign(
    {
      id_guru: guru.id_guru,
      username: guru.username,
      nama_lengkap: guru.nama_lengkap
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

module.exports = { generateToken, verifyToken, JWT_SECRET };
