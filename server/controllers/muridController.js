const path = require('path');
const fs = require('fs').promises;
const { supabase, readMuridByGuru, readAll, insertRow, updateRow, deleteRow, exists, generateId, generateQRToken, readSettings } = require('../utils/supabase');
const QRCode = require('qrcode');
const { jsPDF } = require('jspdf');
const archiver = require('archiver');
const { createCanvas, loadImage, registerFont } = require('canvas');

const fontPath = path.join(__dirname, '../../fonts/NotoSans-Regular.ttf');
registerFont(fontPath, { family: 'Noto Sans' });

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
    const muridData = await readMuridByGuru(req.guru.id_guru);
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
    
    // Cek apakah NIS sudah ada untuk guru ini atau murid lain di seluruh sistem
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
    
    // Buat data murid baru dengan id_guru saat ini
    const newMurid = {
      id_murid,
      nis,
      nama,
      qr_token,
      status: status || 'aktif',
      foto_profil: null,
      id_guru: req.guru.id_guru
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
    
    // Cek apakah murid ada dan milik guru saat ini
    const { data: murid, error: muridErr } = await supabase
      .from('murid')
      .select('*')
      .eq('id_murid', id_murid)
      .eq('id_guru', req.guru.id_guru)
      .maybeSingle();

    if (muridErr || !murid) {
      return res.status(404).json({
        success: false,
        message: 'Murid tidak ditemukan atau tidak milik Anda'
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
    
    // Cek apakah murid ada dan milik guru saat ini
    const { data: murid, error: checkErr } = await supabase
      .from('murid')
      .select('id_murid')
      .eq('id_murid', id_murid)
      .eq('id_guru', req.guru.id_guru)
      .maybeSingle();

    if (checkErr || !murid) {
      return res.status(404).json({
        success: false,
        message: 'Murid tidak ditemukan atau tidak milik Anda'
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
    
    // Cek murid di Supabase dan pastikan milik guru saat ini
    const { data: murid, error: checkErr } = await supabase
      .from('murid')
      .select('*')
      .eq('id_murid', id_murid)
      .eq('id_guru', req.guru.id_guru)
      .maybeSingle();

    if (checkErr || !murid) {
      return res.status(404).json({
        success: false,
        message: 'Murid tidak ditemukan atau tidak milik Anda'
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

    const { data: murid, error } = await supabase
      .from('murid')
      .select('*')
      .eq('id_murid', id_murid)
      .eq('id_guru', req.guru.id_guru)
      .maybeSingle();

    if (error || !murid) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(404).json({
        success: false,
        message: 'Murid tidak ditemukan atau tidak milik Anda'
      });
    }

    if (murid.foto_profil) {
      const oldPhotoPath = path.join(__dirname, '../../public', murid.foto_profil);
      try {
        await fs.unlink(oldPhotoPath);
      } catch (e) {
        // Ignore if old file doesn't exist
      }
    }

    const fotoPath = '/uploads/' + req.file.filename;
    await updateRow('murid', 'id_murid', id_murid, { foto_profil: fotoPath });

    res.json({
      success: true,
      message: 'Foto profil berhasil diupload',
      data: {
        id_murid,
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
    const muridData = await readMuridByGuru(req.guru.id_guru);
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
        width: 300,
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
    
    // Layout: 2 columns × 2 rows = 4 QR per page
    const pageWidth = 210;
    const pageHeight = 297;
    const marginX = 15;
    const marginTop = 30;   // space for header
    const marginBottom = 10;
    const colGap = 14;
    const rowGap = 20;
    const labelHeight = 14; // space for nama + NIS
    
    const cols = 2;
    const rows = 2;
    const perPage = cols * rows;  // 4
    
    const cellWidth = (pageWidth - 2 * marginX - (cols - 1) * colGap) / cols;
    const usableHeight = pageHeight - marginTop - marginBottom;
    const cellHeight = (usableHeight - (rows - 1) * rowGap) / rows;
    const qrSize = Math.min(cellWidth - 4, cellHeight - labelHeight - 4);  // QR sebesar mungkin dalam cell
    
    const drawHeader= () => {
      doc.setFontSize(14);
      doc.text('QR CODE PRESENSI HARIAN', pageWidth / 2, 15, { align: 'center' });
      doc.setFontSize(9);
      doc.text(`Kelas: ${settings.nama_kelas || '-'}  |  Total: ${muridAktif.length} Murid`, pageWidth / 2, 23, { align: 'center' });
    };
    
    const drawCell = (x, y, qrData) => {
      // Center QR horizontally in the cell
      const qrX = x + (cellWidth - qrSize) / 2;
      
      // Draw QR image
      doc.addImage(qrData.qrImage, 'PNG', qrX, y, qrSize, qrSize);
      
      // Draw name + NIS below QR
      const textY = y + qrSize + 4;
      doc.setFontSize(9);
      doc.text(qrData.nama, x + cellWidth / 2, textY, { align: 'center', maxWidth: cellWidth - 2 });
      doc.setFontSize(8);
      doc.text(`NIS: ${qrData.nis}`, x + cellWidth / 2, textY + 5, { align: 'center' });
    };
    
    let currentPage = 0;
    
    drawHeader();
    
    qrDataList.forEach((qrData, index) => {
      const pageIndex = Math.floor(index / perPage);
      const posInPage = index % perPage;
      const col = posInPage % cols;
      const row = Math.floor(posInPage / cols);
      
      // Add new page if needed
      if (pageIndex > currentPage) {
        doc.addPage();
        currentPage = pageIndex;
        drawHeader();
      }
      
      const x = marginX + col * (cellWidth + colGap);
      const y = marginTop + row * (cellHeight + rowGap);
      
      drawCell(x, y, qrData);
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

/**
 * Mendownload semua QR code murid sebagai ZIP berisi file PNG individual
 */
async function downloadAllQRZIP(req, res) {
  try {
    const muridData = await readMuridByGuru(req.guru.id_guru);
    const settings = await readSettings();
    
    const muridAktif = muridData.filter(m => m.status === 'aktif');
    
    if (muridAktif.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tidak ada murid aktif'
      });
    }
    
    // Setup ZIP response
    res.setHeader('Content-Type', 'application/zip');
    const zipFilename = `qr_code_murid_${settings.nama_kelas || 'kelas'}.zip`;
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
    
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });
    
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Gagal membuat ZIP file'
        });
      }
    });
    
    archive.pipe(res);
    
    // Generate QR PNG for each student (with name label below) and add to ZIP
    for (const murid of muridAktif) {
      try {
        // Generate QR code as data URL first, then load as image
        const qrDataUrl = await QRCode.toDataURL(murid.qr_token, {
          width: 300,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' }
        });
        
        const qrImage = await loadImage(qrDataUrl);
        const qrSize = qrImage.width;
        
        // Canvas: QR + label area below
        const labelHeight = 50;
        const padding = 20;
        const canvasWidth = qrSize + padding * 2;
        const canvasHeight = qrSize + labelHeight + padding * 2;
        
        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');
        
        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        // Draw QR code centered
        ctx.drawImage(qrImage, padding, padding, qrSize, qrSize);
        
        // Draw student name
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Name (bold, larger)
        ctx.font = 'bold 16px "Noto Sans"';
        ctx.fillText(murid.nama, canvasWidth / 2, padding + qrSize + 18);
        
        // NIS (smaller)
        ctx.font = '13px "Noto Sans"';
        ctx.fillStyle = '#555555';
        ctx.fillText(`NIS: ${murid.nis}`, canvasWidth / 2, padding + qrSize + 38);
        
        // Export canvas to PNG buffer
        const pngBuffer = canvas.toBuffer('image/png');
        
        // Sanitize filename
        const safeName = murid.nama.replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const pngFilename = `${murid.nis}-${safeName}.png`;
        
        const archived = archive.append(pngBuffer, { name: pngFilename });
        if (!archived) {
          throw new Error(`Failed to add ${pngFilename} to archive`);
        }
      } catch (qrError) {
        console.error(`Error generating QR for ${murid.nama}:`, qrError);
        throw qrError;
      }
    }
    
    // Add README.txt with class info
    const readmeContent = muridAktif.map(m => `${m.nis} - ${m.nama}`).join('\n');
    const readme = `QR Code Presensi Harian\nKelas: ${settings.nama_kelas || '-'}\nTotal: ${muridAktif.length} murid\n\nDaftar murid:\n${readmeContent}`;
    archive.append(readme, { name: 'README.txt' });
    
    // Wait for archive to be finalized using event-based approach
    await new Promise((resolve, reject) => {
      archive.finalize();
      archive.on('end', resolve);
      archive.on('error', reject);
    });
    
  } catch (error) {
    console.error('Error generating QR ZIP:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Gagal membuat ZIP QR code'
      });
    }
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
  downloadAllQRPDF,
  downloadAllQRZIP
};
