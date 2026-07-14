const bcrypt = require('bcrypt');
const { supabase } = require('../utils/supabase');

/**
 * Menampilkan halaman login
 */
async function showLoginPage(req, res) {
  // Jika sudah login, redirect ke dashboard
  if (req.session && req.session.guruId) {
    return res.redirect('/');
  }
  
  res.sendFile('login.html', { root: './public' });
}

/**
 * Handle login
 */
async function login(req, res) {
  try {
    const { username, password } = req.body;
    
    // Validasi input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username dan password harus diisi'
      });
    }
    
    // Cari guru berdasarkan username (dari Supabase)
    const { data: guru, error } = await supabase
      .from('guru')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error || !guru) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password salah'
      });
    }
    
    // Cek password
    const passwordMatch = await bcrypt.compare(password, guru.password_hash);
    
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password salah'
      });
    }
    
    // Set session
    req.session.guruId = guru.id_guru;
    req.session.guruName = guru.nama_lengkap;
    req.session.username = guru.username;
    
    res.json({
      success: true,
      message: 'Login berhasil',
      redirect: '/'
    });
    
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat login'
    });
  }
}

/**
 * Handle logout
 */
function logout(req, res) {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
}

/**
 * Cek status login (API)
 */
function checkAuth(req, res) {
  if (req.session && req.session.guruId) {
    return res.json({
      success: true,
      guru: {
        id: req.session.guruId,
        name: req.session.guruName,
        username: req.session.username
      }
    });
  }
  
  return res.json({
    success: false,
    guru: null
  });
}

module.exports = {
  showLoginPage,
  login,
  logout,
  checkAuth
};
