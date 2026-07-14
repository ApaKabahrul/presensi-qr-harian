/**
 * Script untuk update server/index.js agar support production mode
 * Jalankan: node scripts/update-server-for-render.js
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'server', 'index.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Tambah deteksi production mode
content = content.replace(
  'const ips = getNetworkIPs();\n\n  if (USE_HTTPS && ensureCertificate())',
  'const isProduction = process.env.NODE_ENV === "production";\n  const ips = getNetworkIPs();\n\n  // HTTPS hanya untuk development (Render handle HTTPS otomatis)\n  if (!isProduction && USE_HTTPS && ensureCertificate())'
);

// 2. Update log HTTP server
content = content.replace(
  '  // Always start HTTP as fallback\n  http.createServer(app).listen(PORT, () => {\n    console.log(`  HTTP fallback: http://localhost:${PORT}`);',
  '  // HTTP server (production atau fallback)\n  http.createServer(app).listen(PORT, () => {\n    if (isProduction) {\n      console.log(`  Server running on port ${PORT} (production)`);\n    } else {\n      console.log(`  HTTP fallback: http://localhost:${PORT}`);\n    }'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ server/index.js berhasil diupdate untuk production mode!');
