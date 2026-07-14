const { supabase, readAll, readSettings } = require('../utils/supabase');
const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable');
const XLSX = require('xlsx');

/**
 * Export rekap presensi ke PDF (API)
 */
async function exportPDF(req, res) {
  try {
    const { tanggal_mulai, tanggal_selesai, status, id_murid } = req.query;
    
    const muridData = await readAll('murid');
    const settings = await readSettings();

    let query = supabase.from('presensi_harian').select('*');
    if (tanggal_mulai) query = query.gte('tanggal', tanggal_mulai);
    if (tanggal_selesai) query = query.lte('tanggal', tanggal_selesai);
    if (status) query = query.eq('status', status);
    if (id_murid) query = query.eq('id_murid', id_murid);

    const { data: filtered, error } = await query;
    if (error) throw error;
    
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
    doc.text(`Dicetak oleh: ${req.session.guruName}`, 20, 49);
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
    
    const muridData = await readAll('murid');
    const settings = await readSettings();

    let query = supabase.from('presensi_harian').select('*');
    if (tanggal_mulai) query = query.gte('tanggal', tanggal_mulai);
    if (tanggal_selesai) query = query.lte('tanggal', tanggal_selesai);
    if (status) query = query.eq('status', status);
    if (id_murid) query = query.eq('id_murid', id_murid);

    const { data: filtered, error } = await query;
    if (error) throw error;
    
    // Sheet 1: Detail Presensi
    const detailData = (filtered || []).map(p => {
      const murid = muridData.find(m => m.id_murid === p.id_murid);
      return {
        'Tanggal': p.tanggal,
        'NIS': murid ? murid.nis : '',
        'Nama': murid ? murid.nama : '',
        'Jam Presensi': p.jam_presensi || '-',
        'Status': p.status,
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

module.exports = {
  exportPDF,
  exportExcel
};
