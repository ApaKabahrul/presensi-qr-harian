const { supabase, readMuridByGuru, readSettings } = require('../utils/supabase');
const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable').default || require('jspdf-autotable').autoTable || require('jspdf-autotable');
const XLSX = require('xlsx');

function isSundayDate(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.getDay() === 0;
}

function normalizeStatusForExport(status, dateStr) {
  if (isSundayDate(dateStr)) {
    return 'Libur';
  }
  return status;
}

/**
 * Export rekap presensi ke PDF (API)
 */
async function exportPDF(req, res) {
  try {
    const { tanggal_mulai, tanggal_selesai, status, id_murid } = req.query;
    
    const muridData = await readMuridByGuru(req.guru.id_guru);
    const settings = await readSettings();
    const muridIds = muridData.map(m => m.id_murid);

    let filtered = [];
    if (muridIds.length > 0) {
      let query = supabase.from('presensi_harian').select('*');
      if (tanggal_mulai) query = query.gte('tanggal', tanggal_mulai);
      if (tanggal_selesai) query = query.lte('tanggal', tanggal_selesai);
      if (status) query = query.eq('status', status);
      query = query.in('id_murid', muridIds);
      if (id_murid) query = query.eq('id_murid', id_murid);

      const { data, error } = await query;
      if (error) throw error;
      filtered = data || [];
    }
    
    // Group by murid
    const muridPresensi = {};
    (filtered || []).forEach(p => {
      if (!muridPresensi[p.id_murid]) {
        muridPresensi[p.id_murid] = {
          Hadir: 0, Terlambat: 0, Izin: 0, Sakit: 0, Alpha: 0
        };
      }
      muridPresensi[p.id_murid][p.status]++;
    });
    
    // Create PDF
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(16);
    doc.text('LAPORAN PRESENSI HARIAN', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Kelas: ${settings.nama_kelas}`, 20, 35);
    doc.text(`Periode: ${tanggal_mulai || 'Semua'} - ${tanggal_selesai || 'Semua'}`, 20, 42);
    doc.text(`Dicetak oleh: ${req.guru ? req.guru.nama_lengkap : 'Unknown'}`, 20, 49);
    doc.text(`Tanggal cetak: ${new Date().toLocaleDateString('id-ID')}`, 20, 56);
    
    // Prepare table data
    const tableData = [];
    let no = 1;
    
    muridData.forEach(murid => {
      const stats = muridPresensi[murid.id_murid] || { Hadir: 0, Terlambat: 0, Izin: 0, Sakit: 0, Alpha: 0 };
      const total = stats.Hadir + stats.Terlambat + stats.Izin + stats.Sakit + stats.Alpha;
      const persentase = total > 0 ? Math.round(((stats.Hadir + stats.Terlambat) / total) * 100) : 0;
      
      tableData.push([
        no++,
        murid.nis,
        murid.nama,
        stats.Hadir,
        stats.Terlambat,
        stats.Izin,
        stats.Sakit,
        stats.Alpha,
        persentase + '%'
      ]);
    });
    
    // Add table
    autoTable(doc, {
      head: [['No', 'NIS', 'Nama', 'Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpha', '% Kehadiran']],
      body: tableData,
      startY: 65,
      theme: 'grid',
      headStyles: { fillColor: [13, 92, 70] }
    });
    
    // Send PDF as buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=rekap_presensi.pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error exporting PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal export PDF'
    });
  }
}

/**
 * Export rekap presensi ke Excel (API)
 */
async function exportExcel(req, res) {
  try {
    const { tanggal_mulai, tanggal_selesai, status, id_murid } = req.query;
    
    const muridData = await readMuridByGuru(req.guru.id_guru);
    const settings = await readSettings();
    const muridIds = muridData.map(m => m.id_murid);

    let filtered = [];
    if (muridIds.length > 0) {
      let query = supabase.from('presensi_harian').select('*');
      if (tanggal_mulai) query = query.gte('tanggal', tanggal_mulai);
      if (tanggal_selesai) query = query.lte('tanggal', tanggal_selesai);
      if (status) query = query.eq('status', status);
      query = query.in('id_murid', muridIds);
      if (id_murid) query = query.eq('id_murid', id_murid);

      const { data, error } = await query;
      if (error) throw error;
      filtered = data || [];
    }
    
    // Sheet 1: Detail Presensi
    const detailData = (filtered || []).map(p => {
      const murid = muridData.find(m => m.id_murid === p.id_murid);
      return {
        'Tanggal': p.tanggal,
        'NIS': murid ? murid.nis : '',
        'Nama': murid ? murid.nama : '',
        'Jam Presensi': p.jam_presensi || '-',
        'Status': normalizeStatusForExport(p.status, p.tanggal),
        'Metode': p.metode_presensi,
        'Keterangan': p.keterangan || '-'
      };
    });
    
    // Sheet 2: Rekap per Murid
    const muridPresensi = {};
    (filtered || []).forEach(p => {
      if (!muridPresensi[p.id_murid]) {
        muridPresensi[p.id_murid] = {
          Hadir: 0, Terlambat: 0, Izin: 0, Sakit: 0, Alpha: 0
        };
      }
      muridPresensi[p.id_murid][p.status]++;
    });
    
    const rekapData = muridData.map(murid => {
      const stats = muridPresensi[murid.id_murid] || { Hadir: 0, Terlambat: 0, Izin: 0, Sakit: 0, Alpha: 0 };
      const total = stats.Hadir + stats.Terlambat + stats.Izin + stats.Sakit + stats.Alpha;
      const persentase = total > 0 ? Math.round(((stats.Hadir + stats.Terlambat) / total) * 100) : 0;
      
      return {
        'NIS': murid.nis,
        'Nama': murid.nama,
        'Hadir': stats.Hadir,
        'Terlambat': stats.Terlambat,
        'Izin': stats.Izin,
        'Sakit': stats.Sakit,
        'Alpha': stats.Alpha,
        '% Kehadiran': persentase + '%'
      };
    });
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    const ws1 = XLSX.utils.json_to_sheet(detailData);
    const ws2 = XLSX.utils.json_to_sheet(rekapData);
    
    XLSX.utils.book_append_sheet(wb, ws1, 'Detail Presensi');
    XLSX.utils.book_append_sheet(wb, ws2, 'Rekap per Murid');
    
    // Write to buffer and send
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=rekap_presensi.xlsx');
    res.setHeader('Content-Length', excelBuffer.length);
    res.send(excelBuffer);
    
  } catch (error) {
    console.error('Error exporting Excel:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal export Excel'
    });
  }
}

/**
 * Export rekap BULANAN ke PDF (landscape, kolom per tanggal)
 */
async function exportPDFBulanan(req, res) {
  try {
    const { bulan, tahun } = req.query;
    
    if (!bulan || !tahun) {
      return res.status(400).json({ success: false, message: 'Parameter bulan dan tahun wajib diisi' });
    }

    const bulanStr = String(bulan).padStart(2, '0');
    const tahunStr = String(tahun);
    const tanggalMulai = `${tahunStr}-${bulanStr}-01`;
    const lastDay = new Date(parseInt(tahunStr), parseInt(bulanStr), 0).getDate();
    const tanggalSelesai = `${tahunStr}-${bulanStr}-${String(lastDay).padStart(2, '0')}`;

    const muridData = await readMuridByGuru(req.guru.id_guru);
    const settings = await readSettings();
    const muridIds = muridData.map(m => m.id_murid);

    const { data: presensiBulan, error } = muridIds.length > 0
      ? await supabase
        .from('presensi_harian')
        .select('*')
        .gte('tanggal', tanggalMulai)
        .lte('tanggal', tanggalSelesai)
        .in('id_murid', muridIds)
      : { data: [], error: null };

    if (error) throw error;

    // Daftar semua tanggal
    const semuaTanggal = [];
    for (let d = 1; d <= lastDay; d++) {
      semuaTanggal.push(`${tahunStr}-${bulanStr}-${String(d).padStart(2, '0')}`);
    }

    const sundayColumns = semuaTanggal.reduce((cols, tgl, index) => {
      if (isSundayDate(tgl)) cols.push(index + 3);
      return cols;
    }, []);

    // Hitung hari efektif
    const hariEfektifSet = new Set();
    (presensiBulan || []).forEach(p => hariEfektifSet.add(p.tanggal));
    const jumlahHariEfektif = hariEfektifSet.size;

    // Build map presensi per murid per tanggal
    const presensiMap = {};
    (presensiBulan || []).forEach(p => {
      if (!presensiMap[p.id_murid]) presensiMap[p.id_murid] = {};
      presensiMap[p.id_murid][p.tanggal] = p.status;
    });

    const namaBulan = new Date(parseInt(tahunStr), parseInt(bulanStr) - 1, 1)
      .toLocaleDateString('id-ID', { month: 'long' });

    // PDF landscape
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm' });

    doc.setFontSize(14);
    doc.text(`REKAP PRESENSI BULANAN - ${namaBulan.toUpperCase()} ${tahunStr}`, 148, 12, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Kelas: ${settings.nama_kelas} | Hari Efektif: ${jumlahHariEfektif} | Dicetak: ${new Date().toLocaleDateString('id-ID')}`, 148, 18, { align: 'center' });

    // Header: No, NIS, Nama, [tgl1, tgl2, ...], H, T, I, S, A, %
    const headRow = ['No', 'NIS', 'Nama'];
    semuaTanggal.forEach(tgl => headRow.push(String(parseInt(tgl.split('-')[2])))); // hanya angka tanggal
    headRow.push('H', 'T', 'I', 'S', 'A', '%');

    const bodyData = [];
    let no = 1;

    muridData.filter(m => m.status === 'aktif').forEach(murid => {
      const row = [no++, murid.nis, murid.nama];
      const counts = { H: 0, T: 0, I: 0, S: 0, A: 0 };

      semuaTanggal.forEach(tgl => {
        const status = presensiMap[murid.id_murid] && presensiMap[murid.id_murid][tgl];
        if (isSundayDate(tgl)) {
          row.push('L');
        } else if (status) {
          const abbr = status === 'Hadir' ? 'H' : status === 'Terlambat' ? 'T' : status === 'Izin' ? 'I' : status === 'Sakit' ? 'S' : 'A';
          row.push(abbr);
          counts[abbr]++;
        } else {
          row.push('');
        }
      });

      const totalHadir = counts.H + counts.T;
      const persentase = jumlahHariEfektif > 0 ? Math.min(Math.round((totalHadir / jumlahHariEfektif) * 100), 100) : 0;

      row.push(counts.H, counts.T, counts.I, counts.S, counts.A, persentase + '%');
      bodyData.push(row);
    });

    // Hitung lebar kolom: No, NIS, Nama fixed, sisanya dibagi
    const colCount = headRow.length;
    const pageWidth = 277; // landscape A4
    const margin = 8;
    const usableWidth = pageWidth - margin * 2;
    const fixedWidth = 50; // No (5) + NIS (10) + Nama (35)
    const summaryWidth = 36; // H, T, I, S, A, % (6 cols × 6mm)
    const dateCols = colCount - 9; // 3 fixed + 6 summary
    const dateWidth = Math.max((usableWidth - fixedWidth - summaryWidth) / dateCols, 4);

    const columnStyles = {};
    columnStyles[0] = { cellWidth: 5 };
    columnStyles[1] = { cellWidth: 10 };
    columnStyles[2] = { cellWidth: 35 };
    for (let i = 3; i < 3 + dateCols; i++) {
      columnStyles[i] = { cellWidth: dateWidth, halign: 'center' };
    }
    for (let i = 3 + dateCols; i < colCount; i++) {
      columnStyles[i] = { cellWidth: 6, halign: 'center' };
    }

    autoTable(doc, {
      head: [headRow],
      body: bodyData,
      startY: 22,
      theme: 'grid',
      headStyles: { fillColor: [13, 92, 70], fontSize: 7, halign: 'center', valign: 'middle' },
      styles: { fontSize: 6.5, cellPadding: 1.5, overflow: 'linebreak' },
      columnStyles,
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.section === 'head' && sundayColumns.includes(data.column.index)) {
          data.cell.styles.fillColor = [255, 220, 220];
          data.cell.styles.textColor = [180, 30, 30];
        }

        if (data.section === 'body' && data.column && data.column.index >= 3 && data.column.index < 3 + dateCols) {
          const val = data.cell.text && data.cell.text[0];
          if (sundayColumns.includes(data.column.index)) {
            data.cell.styles.fillColor = [255, 220, 220];
            data.cell.styles.textColor = [180, 30, 30];
            if (!val || val === '') {
              data.cell.text = ['L'];
            }
          } else {
            if (val === 'H') {
              data.cell.styles.fillColor = [200, 250, 220]; // hijau muda
              data.cell.styles.textColor = [13, 92, 70];
            } else if (val === 'T') {
              data.cell.styles.fillColor = [255, 243, 205]; // kuning muda
              data.cell.styles.textColor = [133, 100, 4];
            } else if (val === 'I') {
              data.cell.styles.fillColor = [209, 236, 255]; // biru muda
              data.cell.styles.textColor = [0, 83, 159];
            } else if (val === 'S') {
              data.cell.styles.fillColor = [230, 215, 255]; // ungu muda
              data.cell.styles.textColor = [91, 33, 182];
            } else if (val === 'A') {
              data.cell.styles.fillColor = [255, 220, 220]; // merah muda
              data.cell.styles.textColor = [180, 30, 30];
            }
          }
        }
      }
    });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=rekap_bulanan_${namaBulan}_${tahunStr}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error exporting PDF bulanan:', error);
    res.status(500).json({ success: false, message: 'Gagal export PDF bulanan' });
  }
}

/**
 * Export rekap BULANAN ke Excel (kolom per tanggal)
 */
async function exportExcelBulanan(req, res) {
  try {
    const { bulan, tahun } = req.query;
    
    if (!bulan || !tahun) {
      return res.status(400).json({ success: false, message: 'Parameter bulan dan tahun wajib diisi' });
    }

    const bulanStr = String(bulan).padStart(2, '0');
    const tahunStr = String(tahun);
    const tanggalMulai = `${tahunStr}-${bulanStr}-01`;
    const lastDay = new Date(parseInt(tahunStr), parseInt(bulanStr), 0).getDate();
    const tanggalSelesai = `${tahunStr}-${bulanStr}-${String(lastDay).padStart(2, '0')}`;

    const muridData = await readMuridByGuru(req.guru.id_guru);
    const settings = await readSettings();
    const muridIds = muridData.map(m => m.id_murid);

    const { data: presensiBulan, error } = muridIds.length > 0
      ? await supabase
        .from('presensi_harian')
        .select('*')
        .gte('tanggal', tanggalMulai)
        .lte('tanggal', tanggalSelesai)
        .in('id_murid', muridIds)
      : { data: [], error: null };

    if (error) throw error;

    const semuaTanggal = [];
    for (let d = 1; d <= lastDay; d++) {
      semuaTanggal.push(`${tahunStr}-${bulanStr}-${String(d).padStart(2, '0')}`);
    }

    const hariEfektifSet = new Set();
    (presensiBulan || []).forEach(p => hariEfektifSet.add(p.tanggal));
    const jumlahHariEfektif = hariEfektifSet.size;

    const presensiMap = {};
    (presensiBulan || []).forEach(p => {
      if (!presensiMap[p.id_murid]) presensiMap[p.id_murid] = {};
      presensiMap[p.id_murid][p.tanggal] = p.status;
    });

    const namaBulan = new Date(parseInt(tahunStr), parseInt(bulanStr) - 1, 1)
      .toLocaleDateString('id-ID', { month: 'long' });

    // Sheet 1: Rekap Bulanan (kolom per tanggal) — gunakan array-of-arrays agar urutan kolom tepat
    // Header row
    const headerRow = ['No', 'NIS', 'Nama'];
    semuaTanggal.forEach(tgl => headerRow.push(String(parseInt(tgl.split('-')[2]))));
    headerRow.push('H', 'T', 'I', 'S', 'A', '%');

    const rekapRows = [headerRow];

    muridData.filter(m => m.status === 'aktif').forEach((murid, index) => {
      const row = [index + 1, murid.nis, murid.nama];
      const counts = { Hadir: 0, Terlambat: 0, Izin: 0, Sakit: 0, Alpha: 0 };

      semuaTanggal.forEach(tgl => {
        const status = (presensiMap[murid.id_murid] && presensiMap[murid.id_murid][tgl]) || '';
        if (isSundayDate(tgl)) {
          row.push('LIBUR');
        } else {
          const abbr = status === 'Hadir' ? 'H' : status === 'Terlambat' ? 'T' : status === 'Izin' ? 'I' : status === 'Sakit' ? 'S' : status === 'Alpha' ? 'A' : '';
          row.push(abbr);
          if (status && counts[status] !== undefined) counts[status]++;
        }
      });

      const totalHadir = counts.Hadir + counts.Terlambat;
      const persentase = jumlahHariEfektif > 0 ? Math.min(Math.round((totalHadir / jumlahHariEfektif) * 100), 100) : 0;
      row.push(counts.Hadir, counts.Terlambat, counts.Izin, counts.Sakit, counts.Alpha, persentase + '%');
      rekapRows.push(row);
    });

    const rekapSheet = XLSX.utils.aoa_to_sheet(rekapRows);

    // Sheet 2: Detail Harian
    const detailData = (presensiBulan || []).map(p => {
      const murid = muridData.find(m => m.id_murid === p.id_murid);
      return {
        'Tanggal': p.tanggal,
        'NIS': murid ? murid.nis : '',
        'Nama': murid ? murid.nama : '',
        'Jam': p.jam_presensi || '-',
        'Status': normalizeStatusForExport(p.status, p.tanggal),
        'Metode': p.metode_presensi,
        'Keterangan': p.keterangan || '-'
      };
    });

    // Sheet 3: Info
    const infoData = [{
      'Bulan': namaBulan,
      'Tahun': tahunStr,
      'Kelas': settings.nama_kelas,
      'Jumlah Hari Efektif': jumlahHariEfektif,
      'Jumlah Murid Aktif': muridData.filter(m => m.status === 'aktif').length,
      'Tanggal Cetak': new Date().toLocaleDateString('id-ID')
    }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, rekapSheet, 'Rekap Bulanan');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailData), 'Detail Harian');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(infoData), 'Info');

    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=rekap_bulanan_${namaBulan}_${tahunStr}.xlsx`);
    res.setHeader('Content-Length', excelBuffer.length);
    res.send(excelBuffer);

  } catch (error) {
    console.error('Error exporting Excel bulanan:', error);
    res.status(500).json({ success: false, message: 'Gagal export Excel bulanan' });
  }
}

module.exports = {
  exportPDF,
  exportExcel,
  exportPDFBulanan,
  exportExcelBulanan
};
