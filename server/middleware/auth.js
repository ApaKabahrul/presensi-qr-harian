/**
 * Middleware untuk mengecek apakah user sudah login
 */
function isAuthenticated(req, res, next) {
  if (req.session && req.session.guruId) {
    return next();
  }
  
  // Jika request adalah API (expecting JSON), return 401
  if (req.headers.accept === 'application/json' || req.xhr) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized - Silakan login terlebih dahulu'
    });
  }
  
  // Untuk request biasa, redirect ke login
  res.redirect('/login');
}

/**
 * Middleware untuk logout
 */
function logout(req, res) {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.clearCookie('connect.sid');
  });
}

module.exports = {
  isAuthenticated,
  logout
};
