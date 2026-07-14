-- ═══════════════════════════════════════════
-- SUPABASE SQL SCHEMA
-- Aplikasi Presensi QR Harian
-- ═══════════════════════════════════════════
-- Jalankan script ini di SQL Editor Supabase:
--   https://supabase.com/dashboard → Project → SQL Editor
-- ═══════════════════════════════════════════

-- 1. Tabel guru
CREATE TABLE IF NOT EXISTS guru (
  id_guru      TEXT PRIMARY KEY,
  username     TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nama_lengkap TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabel murid
CREATE TABLE IF NOT EXISTS murid (
  id_murid    TEXT PRIMARY KEY,
  nis         TEXT UNIQUE NOT NULL,
  nama        TEXT NOT NULL,
  qr_token    TEXT UNIQUE NOT NULL,
  status      TEXT DEFAULT 'aktif',
  foto_profil TEXT DEFAULT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabel presensi_harian
CREATE TABLE IF NOT EXISTS presensi_harian (
  id_presensi      TEXT PRIMARY KEY,
  tanggal          DATE NOT NULL,
  id_murid         TEXT REFERENCES murid(id_murid) ON DELETE CASCADE,
  jam_presensi     TIME,
  status           TEXT NOT NULL CHECK (status IN ('Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpha')),
  metode_presensi  TEXT NOT NULL CHECK (metode_presensi IN ('scan-qr', 'manual', 'auto')),
  input_by         TEXT REFERENCES guru(id_guru),
  keterangan       TEXT DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabel log_koreksi_presensi
CREATE TABLE IF NOT EXISTS log_koreksi_presensi (
  id          SERIAL PRIMARY KEY,
  id_presensi TEXT REFERENCES presensi_harian(id_presensi) ON DELETE CASCADE,
  status_lama TEXT NOT NULL,
  status_baru TEXT NOT NULL,
  keterangan  TEXT DEFAULT '',
  diubah_oleh TEXT REFERENCES guru(id_guru),
  waktu_ubah  TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabel settings
CREATE TABLE IF NOT EXISTS settings (
  id              SERIAL PRIMARY KEY,
  nama_kelas      TEXT NOT NULL DEFAULT 'X-A',
  jam_mulai       TIME NOT NULL DEFAULT '07:00',
  batas_terlambat TIME NOT NULL DEFAULT '07:15',
  jam_selesai     TIME NOT NULL DEFAULT '08:00',
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ═══════════ INDEX UNTUK PERFORMA ═══════════
CREATE INDEX IF NOT EXISTS idx_presensi_tanggal ON presensi_harian(tanggal);
CREATE INDEX IF NOT EXISTS idx_presensi_murid ON presensi_harian(id_murid);
CREATE INDEX IF NOT EXISTS idx_presensi_status ON presensi_harian(status);
CREATE INDEX IF NOT EXISTS idx_murid_status ON murid(status);
CREATE INDEX IF NOT EXISTS idx_guru_username ON guru(username);
CREATE INDEX IF NOT EXISTS idx_presensi_tanggal_murid ON presensi_harian(tanggal, id_murid);

-- ═══════════ DEFAULT DATA ═══════════
-- Insert settings default (jika belum ada)
INSERT INTO settings (nama_kelas, jam_mulai, batas_terlambat, jam_selesai)
SELECT 'IV-A', '20:00', '21:00', '22:00'
WHERE NOT EXISTS (SELECT 1 FROM settings);

-- ═══════════ ROW LEVEL SECURITY (RLS) ═══════════
-- Enable RLS untuk keamanan
ALTER TABLE guru ENABLE ROW LEVEL SECURITY;
ALTER TABLE murid ENABLE ROW LEVEL SECURITY;
ALTER TABLE presensi_harian ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_koreksi_presensi ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Untuk development: izinkan semua akses dengan service_role key
-- (Kita pakai service_role key, jadi RLS tidak membatasi)
-- Kalau mau granular, buat policy per tabel.
CREATE POLICY "Allow all with service_role" ON guru FOR ALL USING (true);
CREATE POLICY "Allow all with service_role" ON murid FOR ALL USING (true);
CREATE POLICY "Allow all with service_role" ON presensi_harian FOR ALL USING (true);
CREATE POLICY "Allow all with service_role" ON log_koreksi_presensi FOR ALL USING (true);
CREATE POLICY "Allow all with service_role" ON settings FOR ALL USING (true);