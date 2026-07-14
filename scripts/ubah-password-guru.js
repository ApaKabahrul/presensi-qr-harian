/**
 * Ubah username & password guru di Supabase
 *
 * Cara pakai:
 *   node scripts/ubah-password-guru.js
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function ubahPassword() {
  // ─── KONFIGURASI ───
  const usernameBaru = 'riris';
  const passwordBaru = 'bahrulriris';
  const idGuru = 'g001'; // ID guru yang mau diubah
  // ───────────────────

  console.log('\n🔐 Mengubah kredensial guru...\n');

  // Hash password baru
  const password_hash = await bcrypt.hash(passwordBaru, 10);

  // Update di Supabase
  const { data, error } = await supabase
    .from('guru')
    .update({
      username: usernameBaru,
      password_hash: password_hash
    })
    .eq('id_guru', idGuru)
    .select();

  if (error) {
    console.log('❌ GAGAL:', error.message);
    process.exit(1);
  }

  console.log('✅ BERHASIL! Kredensial guru sudah diubah.\n');
  console.log('  Username baru :', data[0].username);
  console.log('  Password baru :', passwordBaru);
  console.log('  Nama          :', data[0].nama_lengkap);
  console.log('\n🔑 Login sekarang dengan:');
  console.log('   Username:', usernameBaru);
  console.log('   Password:', passwordBaru);
  console.log('');

  process.exit(0);
}

ubahPassword().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
