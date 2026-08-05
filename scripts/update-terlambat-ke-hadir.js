require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus diisi di file .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function updateTerlambatToHadir() {
  console.log('\n🔄 Menjalankan update status presensi...\n');

  const { data, error } = await supabase
    .from('presensi_harian')
    .update({ status: 'Hadir' })
    .eq('status', 'Terlambat')
    .select('id_presensi');

  if (error) {
    console.error('❌ Gagal mengupdate presensi:', error.message);
    process.exit(1);
  }

  const updatedCount = Array.isArray(data) ? data.length : 0;
  console.log(`✅ Selesai. Baris yang diupdate: ${updatedCount}`);
  console.log('\nTips: jalankan kembali query SQL di Supabase jika ingin memverifikasi hasil.');
  process.exit(0);
}

updateTerlambatToHadir().catch(err => {
  console.error('❌ Error eksekusi skrip:', err.message);
  process.exit(1);
});
