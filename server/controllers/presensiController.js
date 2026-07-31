const { supabase, readMuridByGuru, insertRow, updateRow, getPresensiWithMurid, generateId, generateQRToken, readSettings } = require('../utils/supabase');

// ─── Helper: Waktu Indonesia Barat (UTC+7) ───────────────────────────────────
function getWIBNow() {
  const now = new Date();
  // Konversi ke UTC, lalu tambah offset WIB (+7 jam)
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  return new Date(utcMs + 7 * 60 * 60 * 1000);
}

function getWIBTime() {
  const wib = getWIBNow();
  return `${String(wib.getHours()).padStart(2, '0')}:${String(wib.getMinutes()).padStart(2, '0')}`;
}

function getWIBDate() {
  const wib = getWIBNow();
  const y = wib.getFullYear();
  const m = String(wib.getMonth() + 1).padStart(2, '0');
  const d = String(wib.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWIBISOString() {
  const wib = getWIBNow();
  return wib.toISOString().replace('Z', '+07:00');
}
// ────────────────────────────────────────────────────────────────────────────

/**
 * Menampilkan halaman presensi harian
 */
async function showPresensiPage(req, res) {
  res.sendFile('presensi.html', { root: './public' });
}

/**
 * Mendapatkan data presensi untuk tanggal tertentu (API)
 */
async function getPresensiByDate(req, res) {
  try {
    const { tanggal } = req.params;

    // JOIN presensi + murid agar NIS dan Nama langsung tersedia, hanya untuk murid guru saat ini
    const { data: presensiTanggal, error } = await supabase
      .from('presensi_harian')
      .select('*, murid(nis, nama, id_guru)')
      .eq('tanggal', tanggal)
      .eq('murid.id_guru', req.guru.id_guru)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Flatten hasil join
    const result = (presensiTanggal || []).map(row => ({
      ...row,
      nis: row.murid?.nis || null,
      nama: row.murid?.nama || null,
      murid: undefined
    }));

    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Error getting presensi by date:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data presensi'
    });
  }
}

/**
 * Scan QR untuk presensi (API)
 */
async function scanQR(req, res) {
  try {
    const { token, tanggal } = req.body;
    
    if (!token || !tanggal) {
      return res.status(400).json({
        success: false,
        message: 'Token QR dan tanggal harus diisi'
      });
    }
    
    const { data: murid, error: muridErr } = await supabase
      .from('murid')
      .select('*')
      .eq('qr_token', token)
      .eq('id_guru', req.guru.id_guru)
      .maybeSingle();

    const settings = await readSettings();
    
    if (muridErr || !murid) {
      return res.status(404).json({
        success: false,
        message: 'QR token tidak valid'
      });
    }
    
    if (murid.status !== 'aktif') {
      return res.status(400).json({
        success: false,
        message: 'Murid tidak aktif'
      });
    }
    
    // Cek duplikat langsung dari Supabase — lebih akurat & tidak kena limit 1000 rows
    const { data: sudahPresensi, error: checkErr } = await supabase
      .from('presensi_harian')
      .select('id_presensi, status')
      .eq('tanggal', tanggal)
      .eq('id_murid', murid.id_murid)
      .maybeSingle();

    if (checkErr) throw checkErr;

    if (sudahPresensi) {
      return res.status(400).json({
        success: false,
        message: `Murid sudah presensi hari ini dengan status: ${sudahPresensi.status}`,
        data: sudahPresensi
      });
    }
    
    const currentTime = getWIBTime();
    
    let status = 'Hadir';
    if (currentTime > settings.batas_terlambat) {
      status = 'Terlambat';
    }
    
    const newPresensi = {
      id_presensi: await generateId('p', 'presensi_harian', 'id_presensi'),
      tanggal,
      id_murid: murid.id_murid,
      jam_presensi: currentTime,
      status,
      metode_presensi: 'scan-qr',
      input_by: req.guru ? req.guru.id_guru : 'unknown',
      keterangan: ''
    };

    // Simpan ke Supabase
    await insertRow('presensi_harian', newPresensi);
    
    res.json({
      success: true,
      message: `Presensi tercatat: ${status}`,
      data: newPresensi
    });
    
  } catch (error) {
    console.error('Error scanning QR:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal memproses scan QR'
    });
  }
}

/**
 * Absen manual oleh guru (API)
 */
async function absenManual(req, res) {
  try {
    const { id_murid, tanggal, status, keterangan } = req.body;
    
    if (!id_murid || !tanggal || !status || !keterangan) {
      return res.status(400).json({
        success: false,
        message: 'Semua field harus diisi'
      });
    }
    
    const validStatus = ['Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpha'];
    if (!validStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status tidak valid'
      });
    }
    
    const { data: murid, error: muridErr } = await supabase
      .from('murid')
      .select('id_murid')
      .eq('id_murid', id_murid)
      .eq('id_guru', req.guru.id_guru)
      .maybeSingle();

    if (muridErr || !murid) {
      return res.status(404).json({
        success: false,
        message: 'Murid tidak ditemukan atau tidak milik Anda'
      });
    }

    // Cek duplikat langsung dari Supabase
    const { data: sudahPresensi, error: checkErr } = await supabase
      .from('presensi_harian')
      .select('id_presensi, status')
      .eq('tanggal', tanggal)
      .eq('id_murid', id_murid)
      .maybeSingle();

    if (checkErr) throw checkErr;

    if (sudahPresensi) {
      return res.status(400).json({
        success: false,
        message: `Murid sudah presensi hari ini dengan status: ${sudahPresensi.status}`
      });
    }
    
    const currentTime = getWIBTime();
    
    const newPresensi = {
      id_presensi: await generateId('p', 'presensi_harian', 'id_presensi'),
      tanggal,
      id_murid,
      jam_presensi: status === 'Hadir' || status === 'Terlambat' ? currentTime : null,
      status,
      metode_presensi: 'manual',
      input_by: req.guru ? req.guru.id_guru : 'unknown',
      keterangan
    };

    await insertRow('presensi_harian', newPresensi);
    
    res.json({
      success: true,
      message: 'Absen manual berhasil dicatat',
      data: newPresensi
    });
    
  } catch (error) {
    console.error('Error on manual absen:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mencatat absen manual'
    });
  }
}

/**
 * Koreksi presensi (API)
 */
async function koreksiPresensi(req, res) {
  try {
    const { id_presensi, statusBaru, keterangan } = req.body;
    
    if (!id_presensi || !statusBaru || !keterangan) {
      return res.status(400).json({
        success: false,
        message: 'Semua field harus diisi'
      });
    }

    // Ambil data presensi yang akan dikoreksi dan pastikan milik murid guru saat ini
    const { data: presensi, error: findErr } = await supabase
      .from('presensi_harian')
      .select('*, murid(id_guru)')
      .eq('id_presensi', id_presensi)
      .maybeSingle();

    if (findErr || !presensi || presensi.murid?.id_guru !== req.guru.id_guru) {
      return res.status(404).json({
        success: false,
        message: 'Data presensi tidak ditemukan atau tidak milik Anda'
      });
    }
    
    const statusLama = presensi.status;

    // Update status di presensi_harian
    await updateRow('presensi_harian', 'id_presensi', id_presensi, {
      status: statusBaru,
      keterangan
    });

    // Simpan log koreksi
    const newLog = {
      id_presensi,
      status_lama: statusLama,
      status_baru: statusBaru,
      keterangan,
      diubah_oleh: req.guru ? req.guru.id_guru : 'unknown',
      waktu_ubah: getWIBISOString()
    };

    await insertRow('log_koreksi_presensi', newLog);
    
    res.json({
      success: true,
      message: 'Presensi berhasil dikoreksi',
      data: newLog
    });
    
  } catch (error) {
    console.error('Error correcting presensi:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengoreksi presensi'
    });
  }
}

/**
 * Mendapatkan rekap presensi (API)
 */
async function getRekap(req, res) {
  try {
    const { tanggal_mulai, tanggal_selesai, status, id_murid } = req.query;
    
    // Gunakan JOIN presensi + murid langsung dari Supabase
    const result = await getPresensiWithMurid({
      tanggal_mulai,
      tanggal_selesai,
      status,
      id_murid,
      id_guru: req.guru.id_guru
    });
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Error getting rekap:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data rekap'
    });
  }
}

/**
 * Mendapatkan statistik presensi (API)
 */
async function getStatistik(req, res) {
  try {
    const { tanggal_mulai, tanggal_selesai } = req.query;

    let query = supabase.from('presensi_harian').select('status, murid(id_guru)');

    if (tanggal_mulai) query = query.gte('tanggal', tanggal_mulai);
    if (tanggal_selesai) query = query.lte('tanggal', tanggal_selesai);
    query = query.eq('murid.id_guru', req.guru.id_guru);

    const { data: filtered, error } = await query;

    if (error) throw error;
    
    const stats = {
      Hadir: 0,
      Terlambat: 0,
      Izin: 0,
      Sakit: 0,
      Alpha: 0
    };
    
    filtered.forEach(p => {
      if (stats[p.status] !== undefined) {
        stats[p.status]++;
      }
    });
    
    res.json({
      success: true,
      data: stats,
      total: filtered.length
    });
    
  } catch (error) {
    console.error('Error getting statistik:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil statistik'
    });
  }
}

/**
 * Tutup presensi dan auto Alpha (API)
 */
async function tutupPresensi(req, res) {
  try {
    const { tanggal } = req.body;
    
    if (!tanggal) {
      return res.status(400).json({
        success: false,
        message: 'Tanggal harus diisi'
      });
    }
    
    const muridAktif = await readMuridByGuru(req.guru.id_guru, 'aktif');
    const muridIds = muridAktif.map(m => m.id_murid);

    const { data: presensiHariIni } = muridIds.length > 0
      ? await supabase
        .from('presensi_harian')
        .select('id_murid')
        .eq('tanggal', tanggal)
        .in('id_murid', muridIds)
      : { data: [] };

    const idSudahPresensi = (presensiHariIni || []).map(p => p.id_murid);
    const muridBelumPresensi = muridAktif.filter(m => !idSudahPresensi.includes(m.id_murid));
    
    const rows = muridBelumPresensi.map(murid => ({
      tanggal,
      id_murid: murid.id_murid,
      jam_presensi: null,
      status: 'Alpha',
      metode_presensi: 'auto',
      input_by: req.guru ? req.guru.id_guru : 'unknown',
      keterangan: 'Alpha otomatis - tidak hadir tanpa keterangan'
    }));

    // Generate ID untuk setiap row
    for (const row of rows) {
      row.id_presensi = await generateId('p', 'presensi_harian', 'id_presensi');
    }

    if (rows.length > 0) {
      const { error } = await supabase.from('presensi_harian').insert(rows);
      if (error) throw error;
    }
    
    res.json({
      success: true,
      message: `Presensi harian ditutup. ${muridBelumPresensi.length} murid mendapat status Alpha.`,
      alphaCount: muridBelumPresensi.length
    });
    
  } catch (error) {
    console.error('Error closing presensi:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal menutup presensi harian'
    });
  }
}

/**
 * Mendapatkan rekap bulanan per murid (API)
 * GET /api/presensi/rekap-bulanan?bulan=07&tahun=2026
 */
async function getRekapBulanan(req, res) {
  try {
    const { bulan, tahun } = req.query;

    if (!bulan || !tahun) {
      return res.status(400).json({
        success: false,
        message: 'Parameter bulan dan tahun wajib diisi'
      });
    }

    const bulanStr = String(bulan).padStart(2, '0');
    const tahunStr = String(tahun);

    const tanggalMulai = `${tahunStr}-${bulanStr}-01`;
    const lastDay = new Date(parseInt(tahunStr), parseInt(bulanStr), 0).getDate();
    const tanggalSelesai = `${tahunStr}-${bulanStr}-${String(lastDay).padStart(2, '0')}`;

    // Daftar semua tanggal dalam bulan
    const semuaTanggal = [];
    for (let d = 1; d <= lastDay; d++) {
      semuaTanggal.push(`${tahunStr}-${bulanStr}-${String(d).padStart(2, '0')}`);
    }

    // Ambil semua presensi dalam rentang bulan
    const muridAktif = await readMuridByGuru(req.guru.id_guru, 'aktif');
    const muridIds = muridAktif.map(m => m.id_murid);

    const { data: presensiBulan, error } = muridIds.length > 0
      ? await supabase
        .from('presensi_harian')
        .select('*')
        .gte('tanggal', tanggalMulai)
        .lte('tanggal', tanggalSelesai)
        .in('id_murid', muridIds)
      : { data: [] };

    if (error) throw error;

    const muridAktifData = muridAktif;

    // Hitung jumlah hari efektif
    const hariEfektifSet = new Set();
    (presensiBulan || []).forEach(p => hariEfektifSet.add(p.tanggal));
    const jumlahHariEfektif = hariEfektifSet.size;

    // Build map: id_murid -> { tanggal -> status }
    const presensiMap = {};
    (presensiBulan || []).forEach(p => {
      if (!presensiMap[p.id_murid]) {
        presensiMap[p.id_murid] = {};
      }
      presensiMap[p.id_murid][p.tanggal] = p.status;
    });

    // Buat rekap per murid dengan kolom harian
    const rekapData = (muridAktifData || []).map(murid => {
      const harian = {};
      const counts = { Hadir: 0, Terlambat: 0, Izin: 0, Sakit: 0, Alpha: 0 };

      semuaTanggal.forEach(tgl => {
        const status = (presensiMap[murid.id_murid] && presensiMap[murid.id_murid][tgl]) || null;
        harian[tgl] = status;
        if (status && counts[status] !== undefined) {
          counts[status]++;
        }
      });

      const totalHadir = counts.Hadir + counts.Terlambat;
      const persentase = jumlahHariEfektif > 0
        ? Math.round((totalHadir / jumlahHariEfektif) * 100)
        : 0;

      return {
        id_murid: murid.id_murid,
        nis: murid.nis,
        nama: murid.nama,
        foto_profil: murid.foto_profil || null,
        harian,
        hadir: counts.Hadir,
        terlambat: counts.Terlambat,
        izin: counts.Izin,
        sakit: counts.Sakit,
        alpha: counts.Alpha,
        total_hadir: totalHadir,
        persentase: Math.min(persentase, 100)
      };
    });

    // Ringkasan statistik
    let totalHadir = 0, totalTerlambat = 0, totalIzin = 0, totalSakit = 0, totalAlpha = 0;
    rekapData.forEach(r => {
      totalHadir += r.hadir;
      totalTerlambat += r.terlambat;
      totalIzin += r.izin;
      totalSakit += r.sakit;
      totalAlpha += r.alpha;
    });

    res.json({
      success: true,
      data: {
        bulan: bulanStr,
        tahun: tahunStr,
        last_day: lastDay,
        semua_tanggal: semuaTanggal,
        jumlah_hari_efektif: jumlahHariEfektif,
        jumlah_murid: muridAktif.length,
        statistik: {
          hadir: totalHadir,
          terlambat: totalTerlambat,
          izin: totalIzin,
          sakit: totalSakit,
          alpha: totalAlpha
        },
        rekap: rekapData
      }
    });

  } catch (error) {
    console.error('Error getting rekap bulanan:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil rekap bulanan'
    });
  }
}

module.exports = {
  showPresensiPage,
  getPresensiByDate,
  scanQR,
  absenManual,
  koreksiPresensi,
  getRekap,
  getStatistik,
  tutupPresensi,
  getRekapBulanan
};
