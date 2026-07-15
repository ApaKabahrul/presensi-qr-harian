const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs').promises;
const { supabase, readAll, insertRow, updateRow, deleteRow, exists, generateId, generateQRToken, readSettings } = require('../utils/supabase');
const QRCode = require('qrcode');
const { jsPDF } = require('jspdf');

/**
 * Menampilkan halaman manajemen murid
 */
async function showMuridPage(req, res) {
  res.sendFile('murid.html', { root: './public' });
}

/**
 * Mendapatkan semua data murid (API)
 */
async function getMurid(req, res) {
  try {
    const muridData = await readAll('murid');
    res.json({
      success: true,
      data: muridData
    });
  } catch (error) {
    console.error('Error getting murid data:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data murid'
    });
  }
}

/**
 * Menambah murid baru (API)
 */
async function addMurid(req, res) {
  try {
    const { nis, nama, status } = req.body;
    
    // Validasi input
    if (!nis || !nama) {
      return res.status(400).json({
        success: false,
        message: 'NIS dan nama harus diisi'
      });
    }
    
    // Cek apakah NIS sudah ada (di Supabase)
    const nisExists = await exists('murid', 'nis', nis);
    if (nisExists) {
      return res.status(400).json({
        success: false,
        message: 'NIS sudah terdaftar'
      });
    }
    
    // Generate ID dan QR token
    const id_murid = await generateId('m', 'murid', 'id_murid');
    const qr_token = generateQRToken();
    
    // Buat data murid baru
    const newMurid = {
      id_murid,
      nis,
      nama,
      qr_token,
      status: status || 'aktif',
      foto_profil: null
    };
    
    // Simpan ke Supabase
    await insertRow('murid', newMurid);
    
    res.json({
      success: true,
      message: 'Murid berhasil ditambahkan',
      data: newMurid
    });
    
  } catch (error) {
    console.error('Error adding murid:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal menambahkan murid'
    });
  }
}

/**
 * Mengupdate data murid (API)
 */
async function updateMurid(req, res) {
  try {
    const { id_murid } = req.params;
    const { nis, nama, status } = req.body;
    
    // Validasi input
    if (!nis || !nama) {
      return res.status(400).json({
        success: false,
        message: 'NIS dan nama harus diisi'
      });
    }
    
    // Cek apakah murid ada
    const murid = await supabase
      .from('murid')
      .select('*')
      .eq('id_murid', id_murid)
      .maybeSingle();

    if (murid.error || !murid.data) {
      return res.status(404).json({
        success: false,
        message: 'Murid tidak ditemukan'
      });
    }
    
    // Cek apakah NIS sudah digunakan oleh murid lain
    const nisExists = await exists('murid', 'nis', nis, 'id_murid', id_murid);
    if (nisExists) {
      return res.status(400).json({
        success: false,
        message: 'NIS sudah digunakan oleh murid lain'
      });
    }
    
    // Update data murid di Supabase
    const updated = await updateRow('murid', 'id_murid', id_murid, {
      nis,
      nama,
      status: status || 'aktif'
    });
    
    res.json({
      success: true,
      message: 'Data murid berhasil diupdate',
      data: updated
    });
    
  } catch (error) {
    console.error('Error updating murid:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengupdate data murid'
    });
  }
}

/**
 * Menghapus murid (API)
 */
async function deleteMurid(req, res) {
  try {
    const { id_murid } = req.params;
    
    // Cek apakah murid ada
    const { data: murid, error: checkErr } = await supabase
      .from('murid')
      .select('id_murid')
      .eq('id_murid', id_murid)
      .maybeSingle();

    if (checkErr || !murid) {
      return res.status(404).json({
        success: false,
        message: 'Murid tidak ditemukan'
      });
    }
    
    // Hapus murid dari Supabase
    await deleteRow('murid', 'id_murid', id_murid);
    
    res.json({
      success: true,
      message: 'Murid berhasil dihapus',
      data: murid
    });
    
  } catch (error) {
    console.error('Error deleting murid:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal menghapus murid'
    });
  }
}

/**
 * Generate ulang QR token untuk murid (API)
 */
async function regenerateQRToken(req, res) {
  try {
    const { id_murid } = req.params;
    
    // Cek murid di Supabase
    const { data: murid, error: checkErr } = await supabase
      .from('murid')
      .select('*')
      .eq('id_murid', id_murid)
      .maybeSingle();

    if (checkErr || !murid) {
      return res.status(404).json({
        success: false,
        message: 'Murid tidak ditemukan'
      });
    }
    
    // Update QR token di Supabase
    const updated = await updateRow('murid', 'id_murid', id_murid, {
      qr_token: generateQRToken()
    });
    
    res.json({
      success: true,
      message: 'QR token berhasil di-generate ulang',
      data: updated
    });
    
  } catch (error) {
    console.error('Error regenerating QR token:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal generate QR token'
    });
  }
}

/**
 * Upload foto profil murid (API)
 */
async function uploadFotoProfil(req, res) {
  try {
    const { id_murid } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada file yang diupload'
      });
    }
    
    // Baca data murid
    let muridData = await readJSON('murid.json');
    
    // Cari index murid
    const index = muridData.findIndex(m => m.id_murid === id_murid);
    if (index === -1) {
      // Hapus file yang diupload jika murid tidak ditemukan
      await fs.unlink(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Murid tidak ditemukan'
      });
    }
    
    // Hapus foto lama jika ada
    if (muridData[index].foto_profil) {
      const oldPhotoPath = path.join(__dirname, '../../public', muridData[index].foto_profil);
      try {
        await fs.unlink(oldPhotoPath);
      } catch (e) {
        // Ignore if old file doesn't exist
      }
    }
    
    // Update foto_profil dengan path file baru
    const fotoPath = '/uploads/' + req.file.filename;
    muridData[index].foto_profil = fotoPath;
    
    // Simpan ke JSON
    await writeJSON('murid.json', muridData);
    
    res.json({
      success: true,
      message: 'Foto profil berhasil diupload',
      data: {
        id_murid: muridData[index].id_murid,
        foto_profil: fotoPath
      }
    });
    
  } catch (error) {
    console.error('Error uploading foto profil:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengupload foto profil'
    });
  }
}

/**
 * Download semua QR code murid dalam satu file PDF (API)
 * Layout: 2 kolom per baris, A4 portrait, siap print
 */
async function downloadAllQRPDF(req, res) {
  try {
    const muridData = await readAll('murid');
    const settings = await readSettings();
    
    const muridAktif = muridData.filter(m => m.status === 'aktif');
    
    if (muridAktif.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tidak ada murid aktif'
      });
    }
    
    // Generate QR data URLs for all active students
    const qrDataList = [];
    for (const murid of muridAktif) {
      const dataUrl = await QRCode.toDataURL(murid.qr_token, {
        width: 200,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      });
      qrDataList.push({
        id_murid: murid.id_murid,
        nama: murid.nama,
        nis: murid.nis,
        qrImage: dataUrl
      });
    }
    
    // Create PDF (A4 portrait: 210mm x 297mm)
    const doc = new jsPDF('portrait', 'mm', 'a4');
    
    const pageWidth = 210;
    const pageHeight = 297;
    const marginX = 12;
    const marginY = 12;
    const colGap = 10;
    const cellWidth = (pageWidth - 2 * marginX - colGap) / 2;  // 2 columns
    const qrSize = 40;       // QR image size in mm
    const labelHeight = 12;  // Space for nama + NIS text
    const cellHeight = qrSize + labelHeight;
    const rowGap = 8;
    const rowsPerPage = Math.floor((pageHeight - 2 * marginY - 25) / (cellHeight + rowGap));  // 25mm reserved for header
    
    let currentPage = 0;

    const drawHeader= () => {
      doc.setFontSize(14);
      doc.text('QR CODE PRESENSI HARIAN', pageWidth / 2, 15, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`Kelas: ${settings.nama_kelas || '-'}`, pageWidth / 2, 22, { align: 'center' });
      doc.text(`Total: ${muridAktif.length} Murid`, pageWidth / 2, 28, { align: 'center' });
    };
    
    const drawCell = (x, y, qrData) => {
      // Draw QR image
      doc.addImage(qrData.qrImage, 'PNG', x, y, qrSize, qrSize);
      
      // Draw name + NIS below QR
      const textY = y + qrSize + 4;
      doc.setFontSize(8);
      doc.text(qrData.nama, x + qrSize / 2, textY, { align: 'center', maxWidth: cellWidth - 2 });
      doc.setFontSize(7);
      doc.text(`NIS: ${qrData.nis}`, x + qrSize / 2, textY + 4, { align: 'center' });
    };
    
    drawHeader();
    
    qrDataList.forEach((qrData, index) => {
      const col = index % 2;
      const rowInPair = Math.floor(index / 2);
      
      // Check if we need a new page
      if (rowInPair >= (currentPage * rowsPerPage) + rowsPerPage) {
        doc.addPage();
        currentPage++;
        drawHeader();
      }
      
      const relativeRow = rowInPair - (currentPage * rowsPerPage);
      const baseY = marginY + 28 + relativeRow * (cellHeight + rowGap);
      const x = col === 0 ? marginX : marginX + cellWidth + colGap;
      
      drawCell(x, baseY, qrData);
    });
    
    // Output PDF
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=qr_code_murid.pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error generating QR PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal membuat PDF QR code'
    });
  }
}

module.exports = {
  showMuridPage,
  getMurid,
  addMurid,
  updateMurid,
  deleteMurid,
  regenerateQRToken,
  uploadFotoProfil,
  downloadAllQRPDF
};
