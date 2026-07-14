const { verifyToken } = require('../utils/jwt');

function isAuthenticated(req, res, next) {
  let token = null;

  if (req.cookies && req.cookies.jwt_token) {
    token = req.cookies.jwt_token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    if (req.headers.accept === 'application/json' || req.xhr || req.path.startsWith('/api/')) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - Silakan login terlebih dahulu'
      });
    }
    return res.redirect('/login');
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    if (req.headers.accept === 'application/json' || req.xhr || req.path.startsWith('/api/')) {
      return res.status(401).json({
        success: false,
        message: 'Token tidak valid atau kadaluarsa'
      });
    }
    res.cookie('jwt_token', '', { maxAge: 1 });
    return res.redirect('/login');
  }

  req.guru = decoded;
  next();
}

module.exports = { isAuthenticated };
