/**
 * ─── MIGRASI DATA JSON → SUPABASE ───
 * Jalankan sekali untuk memindahkan semua data dari file JSON ke Supabase.
 *
 * Prasyarat:
 *   1. Buat file .env dengan SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY
 *   2. Jalankan SQL schema (supabase-schema.sql) di SQL Editor Supabase
 *
 * Cara pakai:
 *   node scripts/migrasi-json-to-supabase.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Baca file JSON
function readJSONFile(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  ${filename} tidak ditemukan, skip.`);
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(content);

  // Jika settings.json adalah object, bungkus ke array
  if (filename === 'settings.json' && !Array.isArray(parsed)) {
    return [parsed];
  }
  return Array.isArray(parsed) ? parsed : [];
}

// Hapus prefix 'created_at' dari data JSON jika ada (supaya pakai timestamp dari DB)
function cleanRow(row) {
  const cleaned = { ...row };
  delete cleaned.created_at;
  delete cleaned.updated_at;
  return cleaned;
}

function normalizeMuridRow(row) {
  const cleaned = { ...cleanRow(row) };
  if (!cleaned.id_guru || cleaned.id_guru === '') {
    cleaned.id_guru = 'g001';
  }
  if (!('foto_profil' in cleaned)) {
    cleaned.foto_profil = null;
  }
  return cleaned;
}

async function migrate() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║  MIGRASI DATA JSON → SUPABASE      ║');
  console.log('╚══════════════════════════════════════╝\n');

  // 1. Migrasi guru
  console.log('📦 Migrasi: guru...');
  const guru = readJSONFile('guru.json');
  if (guru && guru.length > 0) {
    const clean = guru.map(cleanRow);
    const { error } = await supabase.from('guru').upsert(clean, { onConflict: 'id_guru' });
    if (error) console.error('  ❌ Gagal:', error.message);
    else console.log(`  ✅ ${clean.length} guru berhasil dimigrasi`);
  }

  // 2. Migrasi murid
  console.log('📦 Migrasi: murid...');
  const murid = readJSONFile('murid.json');
  if (murid && murid.length > 0) {
    const clean = murid.map(normalizeMuridRow);
    const { error } = await supabase.from('murid').upsert(clean, { onConflict: 'id_murid' });
    if (error) console.error('  ❌ Gagal:', error.message);
    else console.log(`  ✅ ${clean.length} murid berhasil dimigrasi`);
  }

  // 3. Migrasi presensi_harian
  console.log('📦 Migrasi: presensi_harian...');
  const presensi = readJSONFile('presensi_harian.json');
  if (presensi && presensi.length > 0) {
    const clean = presensi.map(cleanRow);
    const { error } = await supabase.from('presensi_harian').upsert(clean, { onConflict: 'id_presensi' });
    if (error) console.error('  ❌ Gagal:', error.message);
    else console.log(`  ✅ ${clean.length} presensi berhasil dimigrasi`);
  }

  // 4. Migrasi log_koreksi_presensi
  console.log('📦 Migrasi: log_koreksi_presensi...');
  const logKoreksi = readJSONFile('log_koreksi_presensi.json');
  if (logKoreksi && logKoreksi.length > 0) {
    const clean = logKoreksi.map(cleanRow);
    const { error } = await supabase.from('log_koreksi_presensi').upsert(clean, { onConflict: 'id' });
    if (error) console.error('  ❌ Gagal:', error.message);
    else console.log(`  ✅ ${clean.length} log koreksi berhasil dimigrasi`);
  } else {
    console.log('  ℹ️  Tidak ada data log koreksi.');
  }

  // 5. Migrasi settings
  console.log('📦 Migrasi: settings...');
  const settings = readJSONFile('settings.json');
  if (settings && settings.length > 0) {
    const clean = settings.map(cleanRow);
    // Hapus data lama & insert baru
    await supabase.from('settings').delete().neq('id', 0); // clear all
    const { error } = await supabase.from('settings').insert(clean);
    if (error) console.error('  ❌ Gagal:', error.message);
    else console.log(`  ✅ Settings berhasil dimigrasi`);
  } else {
    console.log('  ℹ️  Tidak ada data settings, insert default.');
    await supabase.from('settings').insert({
      nama_kelas: 'X-A',
      jam_mulai: '07:00',
      batas_terlambat: '07:15',
      jam_selesai: '08:00'
    });
  }

  console.log('\n🎉 Migrasi selesai!\n');
  process.exit(0);
}

migrate().catch(err => {
  console.error('\n❌ Migrasi gagal:', err.message);
  process.exit(1);
});