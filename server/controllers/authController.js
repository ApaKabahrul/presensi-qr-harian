const bcrypt = require('bcrypt');
const { supabase } = require('../utils/supabase');
const { generateToken, verifyToken } = require('../utils/jwt');

function showLoginPage(req, res) {
  const token = req.cookies && req.cookies.jwt_token;
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      return res.redirect('/');
    }
  }
  res.sendFile('login.html', { root: './public' });
}

async function login(req, res) {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username dan password harus diisi'
      });
    }
    
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
    
    const passwordMatch = await bcrypt.compare(password, guru.password_hash);
    
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password salah'
      });
    }
    
    const token = generateToken(guru);
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.cookie('jwt_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });
    
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

function logout(req, res) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.clearCookie('jwt_token', {
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax'
  });
  
  res.redirect('/login');
}

function apiLogout(req, res) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.clearCookie('jwt_token', {
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax'
  });
  
  res.json({ success: true, message: 'Logout berhasil' });
}

function checkAuth(req, res) {
  const token = req.cookies && req.cookies.jwt_token;
  
  if (!token) {
    return res.json({ success: false, guru: null });
  }
  
  const decoded = verifyToken(token);
  
  if (decoded) {
    return res.json({
      success: true,
      guru: decoded
    });
  }
  
  return res.json({ success: false, guru: null });
}

module.exports = {
  showLoginPage,
  login,
  logout,
  apiLogout,
  checkAuth
};
