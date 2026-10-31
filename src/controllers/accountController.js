const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { Op, col, fn, where } = require('sequelize');
const sequelize = require('../config/database');
const User = require('../models/User');
const Pedido = require('../models/Pedido');
const Ticket = require('../models/Ticket');
const NotificacionCorreo = require('../models/NotificacionCorreo');
const mail = require('../utils/accountMail');
const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');
const validPassword = (value) => typeof value === 'string' && value.length >= 6 && Buffer.byteLength(value, 'utf8') <= 72;
const publicUser = (u) => ({ id: u.id, name: u.name, apellido: u.apellido, email: u.email, telefono: u.telefono, role: u.role });
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const handle = (fn) => async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { await fn(req, res); }
  catch (error) {
    const duplicate = error.name === 'SequelizeUniqueConstraintError';
    res.status(duplicate ? 409 : error.status || 500).json({ success: false,
      message: duplicate ? 'El correo electrónico ya está registrado' : error.status ? error.message : 'No se pudo completar la operación' });
  }
};

module.exports = {
  updateProfile: handle(async (req, res) => {
    const { name, apellido, email, telefono } = req.body || {};
    if (![name, apellido, email].every((v) => typeof v === 'string' && v.trim() && v.trim().length <= 254)) throw fail('Completá nombre, apellido y correo válido');
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw fail('Ingresá un email válido');
    if (telefono != null && (typeof telefono !== 'string' || (telefono && !/^[0-9]{1,30}$/.test(telefono)))) throw fail('El teléfono debe contener solo números (máximo 30)');
    const other = await User.findOne({ where: where(fn('lower', col('email')), normalizedEmail) });
    if (other && other.id !== req.user.id) throw fail('El correo electrónico ya está registrado', 409);
    await sequelize.transaction(async (transaction) => {
      // Migrate legacy email ownership before allowing that email to be reused.
      await Pedido.update({ cliente: `demo-user:${req.user.id}:${normalizedEmail}` }, {
        where: where(fn('lower', col('cliente')), req.user.email.toLowerCase()), transaction,
      });
      await req.account.update({ name: name.trim(), apellido: apellido.trim(), email: normalizedEmail, telefono: telefono || null, resetTokenHash: null, resetTokenExpires: null }, { transaction });
    });
    res.json({ success: true, user: publicUser(req.account), message: 'Datos actualizados' });
  }),
  changePassword: handle(async (req, res) => {
    const { currentPassword, password, confirmPassword } = req.body || {};
    if (!validPassword(password) || password !== confirmPassword) throw fail('La nueva contraseña debe tener al menos 6 caracteres, no ser demasiado larga y coincidir con su confirmación');
    await sequelize.transaction(async (transaction) => {
      const user = await User.findByPk(req.user.id, { transaction });
      if (!user || typeof currentPassword !== 'string' || !await user.comparePassword(currentPassword)) throw fail('La contraseña actual es incorrecta', 401);
      if (await user.comparePassword(password)) throw fail('Elegí una contraseña diferente de la actual');
      await user.update({ password, sessionVersion: user.sessionVersion + 1, resetTokenHash: null, resetTokenExpires: null }, { transaction });
    });
    res.json({ success: true, message: 'Contraseña actualizada. Volvé a iniciar sesión.' });
  }),
  forgotPassword: handle(async (req, res) => {
    if (!mail.configured()) throw fail('La recuperación por correo no está disponible. Contactá al administrador.', 503);
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw fail('Ingresá un email válido');
    const user = await User.findOne({ where: where(fn('lower', col('email')), email) });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = hash(token);
      await user.update({ resetTokenHash: tokenHash, resetTokenExpires: new Date(Date.now() + 20 * 60 * 1000) });
      try { await mail.sendReset(user.email, token); }
      catch {
        await User.update({ resetTokenHash: null, resetTokenExpires: null }, { where: { id: user.id, resetTokenHash: tokenHash } });
        console.error('No se pudo entregar un correo de recuperación');
      }
    }
    res.json({ success: true, message: 'Si el correo está registrado, recibirás un enlace para recuperar tu contraseña.' });
  }),
  resetPassword: handle(async (req, res) => {
    const { token, password, confirmPassword } = req.body || {};
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw fail('El enlace es inválido o venció');
    if (!validPassword(password) || password !== confirmPassword) throw fail('La contraseña debe tener al menos 6 caracteres, no ser demasiado larga y coincidir con su confirmación');
    const passwordHash = await bcrypt.hash(password, 10);
    // Conditional update makes consuming the token atomic, including simultaneous requests.
    const [updated] = await User.update({ password: passwordHash, sessionVersion: sequelize.literal('sessionVersion + 1'), resetTokenHash: null, resetTokenExpires: null }, {
      where: { resetTokenHash: hash(token), resetTokenExpires: { [Op.gt]: new Date() } },
    });
    if (!updated) throw fail('El enlace es inválido o venció');
    res.json({ success: true, message: 'Contraseña restablecida. Ya podés iniciar sesión.' });
  }),
  deleteAccount: handle(async (req, res) => {
    if (req.body?.confirmation !== 'ELIMINAR') throw fail('Escribí ELIMINAR para confirmar');
    await sequelize.transaction(async (transaction) => {
      const user = await User.findByPk(req.user.id, { transaction });
      if (!user || typeof req.body.password !== 'string' || !await user.comparePassword(req.body.password)) throw fail('La contraseña es incorrecta', 401);
      if (user.role === 'admin' && await User.count({ where: { role: 'admin' }, transaction }) <= 1) throw fail('No podés eliminar al último administrador', 409);
      const ownership = { [Op.or]: [where(fn('lower', col('cliente')), user.email.toLowerCase()), { cliente: { [Op.like]: `demo-user:${user.id}:%` } }] };
      const orders = await Pedido.findAll({ where: ownership, attributes: ['id'], transaction });
      const ids = orders.map((order) => order.id);
      await Pedido.update({ cliente: `deleted-user:${user.id}` }, { where: ownership, transaction });
      await Ticket.update({ cliente: 'Cuenta eliminada' }, { where: { id_pedido: { [Op.in]: ids } }, transaction });
      await NotificacionCorreo.destroy({ where: { [Op.or]: [{ pedido_id: { [Op.in]: ids } }, where(fn('lower', col('destinatario')), user.email.toLowerCase())] }, transaction });
      await user.destroy({ transaction });
    });
    res.json({ success: true, message: 'Tu cuenta fue eliminada. Se conserva el historial de compras anonimizado.' });
  }),
};
