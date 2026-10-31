const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authenticateToken = async (req, res, next) => {
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) return res.status(401).json({ message: 'Acceso denegado. Token no provisto.' });
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }); }
  catch { return res.status(403).json({ message: 'Token inválido o expirado.' }); }
  try {
    const user = await User.findByPk(payload.id);
    if (!user || (payload.sessionVersion ?? 0) !== user.sessionVersion) {
      return res.status(401).json({ message: 'Tu sesión venció. Volvé a iniciar sesión.' });
    }
    req.user = { id: user.id, name: user.name, apellido: user.apellido, email: user.email, role: user.role };
    req.account = user;
    next();
  } catch (error) { next(error); }
};
const isAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Acceso denegado. Se requieren permisos de administrador.' });
  next();
};
module.exports = { authenticateToken, isAdmin };
