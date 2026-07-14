# Presensi QR Harian

Aplikasi presensi harian murid berbasis QR Code dengan penyimpanan data menggunakan **Supabase (PostgreSQL)**. Dibangun dengan Node.js dan Express.

## Fitur

- **Scan QR Code** — Murid melakukan absensi harian dengan memindai QR code melalui kamera HP/laptop.
- **Manajemen Murid** — Tambah, edit, hapus data murid, serta generate & cetak QR code.
- **Rekap Presensi** — Lihat dan export data presensi dalam format PDF dan Excel (XLSX).
- **Autentikasi** — Login berbasis sesi untuk guru dengan password terenkripsi (bcrypt).
- **Pengaturan Waktu** — Konfigurasi jam mulai, batas terlambat, dan jam selesai presensi.
- **Database Cloud** — Semua data disimpan di Supabase (PostgreSQL).
- **HTTPS Built-in** — Self-signed certificate auto-generated untuk akses kamera dari HP.

## Teknologi

- **Backend:** Node.js, Express
- **Frontend:** HTML, CSS, JavaScript
- **QR Code:** `html5-qrcode` (scanner), `qrcode` (generator)
- **Export:** `jspdf` v4, `jspdf-autotable`, `xlsx` (SheetJS)
- **Autentikasi:** `express-session`, `bcrypt`
- **Database:** Supabase (PostgreSQL), `@supabase/supabase-js`
- **HTTPS:** Self-signed certificate via OpenSSL

## Instalasi

### Prasyarat

- Node.js (versi 18 atau lebih baru)
- npm
- OpenSSL (untuk HTTPS — otomatis diinstall via `winget` di Windows)
- Akun Supabase ([supabase.com](https://supabase.com))

### Langkah-langkah

1. **Clone repository:**
   ```bash
   git clone https://github.com/username/presensi-qr-harian.git
   cd presensi-qr-harian
   ```

2. **Install dependensi:**
   ```bash
   npm install
   ```

3. **Setup Database (Supabase):**
   - Buat project di [supabase.com](https://supabase.com)
   - Buka **SQL Editor**, paste isi `scripts/supabase-schema.sql`, klik **Run**
   - Copy `.env.example` ke `.env`, isi `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY`

4. **Migrasi data (opsional, jika ada data lama):**
   ```bash
   node scripts/migrasi-json-to-supabase.js
   ```

5. **Jalankan server (HTTPS + HTTP):**
   ```bash
   npm start
   ```

   Server akan otomatis generate sertifikat SSL dan menampilkan alamat akses:
   ```
   ══════════════════════════════════════════════
     Presensi QR Harian - HTTPS MODE
   ══════════════════════════════════════════════

     Access from laptop:
        https://localhost:3443

     Access from phone (same network):
        https://192.168.x.x:3443
   ══════════════════════════════════════════════
   ```

6. **Mode pengembangan (auto-restart):**
   ```bash
   npm run dev
   ```

7. **Mode HTTP only (tanpa kamera di HP):**
   ```bash
   npm run http-only
   ```

## Akses dari HP (Scan QR)

Agar kamera HP bisa digunakan untuk scan QR, akses **harus** melalui HTTPS:

| Langkah | Tindakan |
|---------|----------|
| 1 | Pastikan HP & laptop dalam **satu jaringan WiFi** yang sama |
| 2 | Jalankan `npm start`, catat IP yang muncul (contoh: `192.168.18.63`) |
| 3 | Di HP, buka `https://192.168.18.63:3443` |
| 4 | Klik **"Advanced"** / **"Lanjutkan"** saat muncul peringatan sertifikat |
| 5 | Login, buka menu **Presensi**, izinkan kamera |
| 6 | Scan QR code murid! 🎉 |

> ⚠️ **Peringatan sertifikat** muncul karena menggunakan self-signed certificate (development). Untuk production, gunakan sertifikat resmi (Let's Encrypt).

## Akun Default

Saat pertama kali dijalankan, akun guru dibuat otomatis:

| Field | Nilai |
|-------|-------|
| Username | `riris` |
| Password | `bahrulriris` |

> ⚠️ **Penting:** Ubah password sesuai kebutuhan via `scripts/ubah-password-guru.js`

## Struktur Proyek

```
presensi-qr-harian/
├── certs/                      # Sertifikat SSL (auto-generated)
├── server/
│   ├── index.js                # Entry point (HTTP + HTTPS)
│   ├── controllers/            # Logic bisnis (auth, murid, presensi, export)
│   ├── middleware/              # Middleware autentikasi
│   ├── routes/                  # Definisi rute API
│   └── utils/
│       ├── jsonHandler.js      # Utility baca/tulis file JSON (legacy)
│       └── supabase.js         # Client Supabase (pengganti jsonHandler)
├── public/
│   ├── index.html              # Dashboard utama
│   ├── login.html              # Halaman login
│   ├── murid.html              # Manajemen murid
│   ├── presensi.html           # Halaman scan QR presensi
│   ├── rekap.html              # Rekap dan export presensi
│   ├── css/
│   │   └── style.css           # Stylesheet
│   └── js/
│       ├── html5-qrcode.min.js # Library scanner QR
│       └── qrcode-local.js     # Generator QR code
├── scripts/
│   ├── supabase-schema.sql     # SQL schema untuk Supabase
│   ├── migrasi-json-to-supabase.js
│   └── ubah-password-guru.js
├── .env.example                # Template environment variables
├── .gitignore
├── package.json
└── README.md
```

## API Endpoints

### Auth
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/auth/check` | Cek status login |
| POST | `/api/auth/login` | Login guru |
| GET | `/api/auth/logout` | Logout |

### Murid
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/murid` | Daftar semua murid |
| POST | `/api/murid` | Tambah murid baru |
| PUT | `/api/murid/:id` | Update data murid |
| DELETE | `/api/murid/:id` | Hapus murid |
| POST | `/api/murid/:id/regenerate-qr` | Generate ulang QR token |

### Presensi
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/presensi/:tanggal` | Presensi berdasarkan tanggal |
| GET | `/api/presensi/rekap` | Rekap presensi (dengan filter) |
| GET | `/api/presensi/statistik` | Statistik presensi |
| POST | `/api/presensi/scan` | Catat presensi via scan QR |
| POST | `/api/presensi/manual` | Absen manual oleh guru |
| PUT | `/api/presensi/koreksi` | Koreksi presensi |
| POST | `/api/presensi/tutup` | Tutup presensi (auto Alpha) |

### Export
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/export/pdf` | Export presensi ke PDF |
| GET | `/api/export/xlsx` | Export presensi ke Excel |

## Pengaturan

File `data/settings.json`:

```json
{
  "nama_kelas": "X-A",
  "jam_mulai": "07:00",
  "batas_terlambat": "07:15",
  "jam_selesai": "08:00"
}
```

## Cara Penggunaan

### 1. Login
- Buka aplikasi di browser (`https://localhost:3443` atau `https://<ip>:3443`)
- Masukkan username `guru` dan password `guru123`
- Klik "Login"

### 2. Tambah Murid
- Buka menu **Murid**
- Isi NIS, Nama, dan Status
- Upload foto (opsional)
- Klik **Tambah Murid** — QR code di-generate otomatis

### 3. Cetak QR Murid
- Klik tombol **Lihat QR** pada daftar murid
- Klik **Cetak QR** untuk mencetak

### 4. Presensi Harian
- Buka menu **Presensi**
- Klik **Mulai Kamera**, arahkan ke QR code murid
- Atau gunakan **Absen Manual** jika QR bermasalah
- Klik **Tutup Presensi** di akhir hari → murid yang belum absen otomatis **Alpha**

### 5. Rekap dan Export
- Buka menu **Rekap**
- Pilih filter: tanggal mulai, tanggal selesai, status, nama murid
- Klik **Filter** untuk melihat data
- Klik **Export PDF** atau **Export Excel** untuk mengunduh laporan

## Keamanan

- Password guru di-hash menggunakan bcrypt
- Database di Supabase dengan Row Level Security (RLS)
- Session management untuk autentikasi
- Server berjalan di HTTPS (port 3443) dengan self-signed certificate

## License

MIT

## Author

Bahrul Faizi
