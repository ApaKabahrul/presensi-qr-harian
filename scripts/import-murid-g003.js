require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { generateQRToken } = require('../server/utils/supabase');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function readNamesFromFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

function getNextMuridId(existingIds) {
  const maxId = existingIds.reduce((max, id) => {
    const match = /^m(\d+)$/i.exec(id);
    if (!match) return max;
    const value = parseInt(match[1], 10);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  return next => `m${String(next).padStart(3, '0')}`;
}

function getNextNis(existingNis) {
  const maxNis = existingNis.reduce((max, nis) => {
    const parsed = parseInt(nis, 10);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0);
  return next => String(next);
}

async function main() {
  console.log('\n📥 Import murid_g003.txt ke tabel murid (id_guru = g003)\n');

  const dataPath = path.join(__dirname, 'import-murid-g003.txt');
  if (!fs.existsSync(dataPath)) {
    console.error('❌ File tidak ditemukan:', dataPath);
    process.exit(1);
  }

  const names = readNamesFromFile(dataPath);
  if (names.length === 0) {
    console.error('❌ Tidak ada nama murid ditemukan di file.');
    process.exit(1);
  }

  const { data: existingMurid, error: readError } = await supabase
    .from('murid')
    .select('id_murid, nis');

  if (readError) {
    console.error('❌ Gagal membaca data murid existing:', readError.message);
    process.exit(1);
  }

  const existingIds = existingMurid.map(row => row.id_murid);
  const existingNis = existingMurid.map(row => row.nis);
  const getId = getNextMuridId(existingIds);
  const getNis = getNextNis(existingNis);

  const nextIdNumber = existingIds.reduce((max, id) => {
    const match = /^m(\d+)$/i.exec(id);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0) + 1;

  const nextNisNumber = existingNis.reduce((max, nis) => {
    const parsed = parseInt(nis, 10);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0) + 1;

  const newRows = names.map((name, index) => ({
    id_murid: getId(nextIdNumber + index),
    nis: getNis(nextNisNumber + index),
    nama: name,
    qr_token: generateQRToken(),
    status: 'aktif',
    foto_profil: null,
    id_guru: 'g003'
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('murid')
    .insert(newRows)
    .select();

  if (insertError) {
    console.error('❌ Gagal insert murid baru:', insertError.message);
    process.exit(1);
  }

  console.log(`✅ Berhasil import ${inserted.length} murid ke id_guru = g003.`);
  inserted.forEach(row => {
    console.log(`  - ${row.id_murid} | NIS ${row.nis} | ${row.nama}`);
  });
  console.log('');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err.message || err);
  process.exit(1);
});
