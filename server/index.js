require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const os = require('os');
const { execSync } = require('child_process');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const { supabase, insertRow } = require('./utils/supabase');

const authRoutes = require('./routes/auth');
const muridRoutes = require('./routes/murid');
const presensiRoutes = require('./routes/presensi');
const exportRoutes = require('./routes/export');

const { isAuthenticated } = require('./middleware/auth');
const authController = require('./controllers/authController');
const muridController = require('./controllers/muridController');
const presensiController = require('./controllers/presensiController');

const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const USE_HTTPS = process.env.HTTPS !== 'false';
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// Routes - API
app.use('/api/auth', authRoutes);
app.use('/api/murid', isAuthenticated, muridRoutes);
app.use('/api/presensi', isAuthenticated, presensiRoutes);
app.use('/api/export', isAuthenticated, exportRoutes);

// Routes - Pages
app.get('/login', authController.showLoginPage);
app.get('/', isAuthenticated, (req, res) => {
  res.sendFile('index.html', { root: './public' });
});
app.get('/murid', isAuthenticated, muridController.showMuridPage);
app.get('/presensi', isAuthenticated, presensiController.showPresensiPage);
app.get('/rekap', (req, res) => {
  res.sendFile('rekap.html', { root: './public' });
});
app.get('/logout', authController.logout);

// Get network IPs
function getNetworkIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// Generate self-signed certificate if not exists
const CERT_DIR = path.join(__dirname, '..', 'certs');
const CERT_KEY = path.join(CERT_DIR, 'key.pem');
const CERT_CRT = path.join(CERT_DIR, 'cert.pem');

function ensureCertificate() {
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
  }
  if (!fs.existsSync(CERT_KEY) || !fs.existsSync(CERT_CRT)) {
    console.log('Generating self-signed SSL certificate...');
    try {
      // Try common OpenSSL paths on Windows
      const opensslPaths = [
        'openssl',
        'C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe',
        'C:\\Program Files (x86)\\OpenSSL-Win32\\bin\\openssl.exe'
      ];
      let opensslCmd = '';
      for (const p of opensslPaths) {
        try {
          execSync(`"${p}" version`, { stdio: 'pipe' });
          opensslCmd = p;
          break;
        } catch (e) { /* try next */ }
      }
      if (!opensslCmd) throw new Error('OpenSSL not found');
      
      execSync(
        `"${opensslCmd}" req -x509 -newkey rsa:2048 -keyout "${CERT_KEY}" -out "${CERT_CRT}" -days 365 -nodes -subj "/CN=presensi-qr-local"`,
        { stdio: 'pipe' }
      );
      console.log('SSL certificate generated.');
    } catch (e) {
      console.error('Failed to generate SSL certificate. Install OpenSSL first.');
      console.error('Or run: npm run http-only (HTTP only, no camera on phone)');
      return false;
    }
  }
  return true;
}

// Initialize default guru account if not exists
async function initializeDefaultData() {
  try {
    const { data: guruData } = await supabase
      .from('guru')
      .select('id_guru')
      .limit(1);

    if (!guruData || guruData.length === 0) {
      const defaultPassword = 'guru123';
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(defaultPassword, saltRounds);
      
      const defaultGuru = {
        id_guru: 'g001',
        username: 'guru',
        password_hash,
        nama_lengkap: 'Guru Pengajar'
      };
      
      await insertRow('guru', defaultGuru);
      console.log('Default guru account created (username: guru, password: guru123)');
    }
  } catch (error) {
    console.error('Error initializing default data:', error);
  }
}

// Start server
async function start() {
  await initializeDefaultData();

  const ips = getNetworkIPs();

  if (USE_HTTPS && ensureCertificate()) {
    const sslOptions = {
      key: fs.readFileSync(CERT_KEY),
      cert: fs.readFileSync(CERT_CRT)
    };

    https.createServer(sslOptions, app).listen(HTTPS_PORT, () => {
      console.log('');
      console.log('══════════════════════════════════════════════');
      console.log('  Presensi QR Harian - HTTPS MODE');
      console.log('══════════════════════════════════════════════');
      console.log('');
      console.log(`  https://localhost:${HTTPS_PORT}`);
      console.log('');
      ips.forEach(ip => {
        console.log(`  https://${ip}:${HTTPS_PORT}`);
      });
      console.log('');
      console.log('══════════════════════════════════════════════');
      console.log('');
    }).on('error', (err) => {
      console.error('HTTPS server error:', err.message);
    });
  }

  // Always start HTTP as fallback
  http.createServer(app).listen(PORT, () => {
    console.log(`  HTTP fallback: http://localhost:${PORT}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`  HTTP port ${PORT} already in use (skipping HTTP fallback)`);
    }
  });
}

start();

module.exports = app;
