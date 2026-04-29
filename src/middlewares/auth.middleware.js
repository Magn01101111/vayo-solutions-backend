const jwt = require('jsonwebtoken');
const { unauthorized, forbidden } = require('../utils/response');

/**
 * verifyToken
 * Verifica el Bearer JWT en Authorization header.
 * Adjunta req.user = { id, role } para los siguientes middlewares.
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, 'Token de acceso no proporcionado');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, iat, exp }
    next();
  } catch (err) {
    return unauthorized(res, 'Token inválido o expirado');
  }
}

/**
 * requireRole(...roles)
 * Middleware factory: solo permite el acceso si req.user.role
 * está incluido en la lista de roles permitidos.
 *
 * Uso: router.get('/admin', verifyToken, requireRole('ADMIN'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return forbidden(res);
    }
    next();
  };
}

module.exports = { verifyToken, requireRole };
