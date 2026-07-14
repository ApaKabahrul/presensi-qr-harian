const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs').promises;
const { supabase, readAll, insertRow, updateRow, deleteRow, exists, generateId, generateQRToken } = require('../utils/supabase');

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

module.exports = {
  showMuridPage,
  getMurid,
  addMurid,
  updateMurid,
  deleteMurid,
  regenerateQRToken,
  uploadFotoProfil
};
