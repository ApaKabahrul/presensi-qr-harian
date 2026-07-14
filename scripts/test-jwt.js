require('dotenv').config();
const http = require('http');

// Login
const loginData = JSON.stringify({ username: 'riris', password: 'guru123' });
const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(loginData)
  }
}, res => {
  let cookies = res.headers['set-cookie'];
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    const r = JSON.parse(body);
    console.log('LOGIN:', r.success ? 'BERHASIL ✅' : 'GAGAL ❌', r.message);

    if (!r.success || !cookies) {
      console.log('COOKIE:', cookies ? cookies[0].substring(0, 50) + '...' : 'NONE');
      process.exit(0);
    }

    console.log('COOKIE SET:', cookies[0].substring(0, 30) + '...');

    // Test /api/murid
    const req2 = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/murid',
      method: 'GET',
      headers: { 'Cookie': cookies.join('; ') }
    }, res2 => {
      let body2 = '';
      res2.on('data', c => body2 += c);
      res2.on('end', () => {
        const d = JSON.parse(body2);
        console.log('MURID API:', d.success ? 'BERHASIL ✅ (' + d.data.length + ' murid)' : 'GAGAL ❌');

        // Test /api/presensi/rekap
        const req3 = http.request({
          hostname: 'localhost',
          port: 3000,
          path: '/api/presensi/rekap',
          method: 'GET',
          headers: { 'Cookie': cookies.join('; ') }
        }, res3 => {
          let body3 = '';
          res3.on('data', c => body3 += c);
          res3.on('end', () => {
            const d3 = JSON.parse(body3);
            console.log('PRESENSI API:', d3.success ? 'BERHASIL ✅ (' + d3.data.length + ' record)' : 'GAGAL ❌');

            // Test /api/auth/check
            const req4 = http.request({
              hostname: 'localhost',
              port: 3000,
              path: '/api/auth/check',
              method: 'GET',
              headers: { 'Cookie': cookies.join('; ') }
            }, res4 => {
              let body4 = '';
              res4.on('data', c => body4 += c);
              res4.on('end', () => {
                const d4 = JSON.parse(body4);
                console.log('AUTH CHECK:', d4.success ? 'BERHASIL ✅ (guru: ' + d4.guru.nama_lengkap + ')' : 'GAGAL ❌');
                console.log('\n✅ SEMUA TEST SELESAI!');
                process.exit(0);
              });
            });
            req4.end();
          });
        });
        req3.end();
      });
    });
    req2.end();
  });
});
req.write(loginData);
req.end();
