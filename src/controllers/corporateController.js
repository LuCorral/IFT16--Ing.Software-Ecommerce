const { Transaction } = require('sequelize');
const sequelize = require('../config/database');
const User = require('../models/User');
const Movement = require('../models/CorporateMovement');
const { getPaginationParams, buildPaginatedResponse } = require('../utils/pagination');

const MAX_BALANCE_CENTS = 100000000000;
const problem = (message, status = 400) => Object.assign(new Error(message), { status });
function parseAmount(value) {
  const amount = typeof value === 'number' || typeof value === 'string' ? String(value) : '';
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(amount)) throw problem('Ingresá un importe válido, con hasta dos decimales');
  const [whole, decimal = ''] = amount.split('.');
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_BALANCE_CENTS) throw problem('El importe debe ser mayor a cero y no superar $1.000.000.000');
  return cents;
}
const summary = (user) => ({ id: user.id, corporateEnabled: user.corporateEnabled, corporateBalanceCents: Number(user.corporateBalanceCents) });
const handle = (operation) => async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id)) || Number(req.params.id) < 1) {
    return res.status(400).json({ message: 'Usuario inválido' });
  }
  try { await operation(req, res); }
  catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'No se pudo actualizar el beneficio corporativo' });
  }
};
async function findClient(id, transaction) {
  const user = await User.findByPk(id, { transaction });
  if (!user) throw problem('Usuario no encontrado', 404);
  if (user.role !== 'client') throw problem('El beneficio corporativo solo se puede asignar a clientes');
  return user;
}

module.exports = {
  setEnabled: handle(async (req, res) => {
    if (typeof req.body?.enabled !== 'boolean') throw problem('Indicá si el beneficio está activo');
    const user = await sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE }, async (transaction) => {
      const account = await findClient(req.params.id, transaction);
      await account.update({ corporateEnabled: req.body.enabled }, { transaction });
      return account;
    });
    res.json({ success: true, user: summary(user), message: user.corporateEnabled ? 'Beneficio corporativo activado' : 'Beneficio corporativo desactivado' });
  }),
  assignCredit: handle(async (req, res) => {
    const amountCents = parseAmount(req.body?.amount);
    const requestId = req.body?.requestId;
    if (typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(requestId)) throw problem('La solicitud necesita un identificador válido');
    const result = await sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE }, async (transaction) => {
      const user = await findClient(req.params.id, transaction);
      const previous = await Movement.findOne({ where: { requestId }, transaction });
      if (previous) {
        if (previous.userId !== user.id || Number(previous.amountCents) !== amountCents || previous.adminId !== req.user.id) throw problem('Este identificador ya fue utilizado para otra asignación', 409);
        return { user: summary(user), movement: previous, repeated: true };
      }
      if (!user.corporateEnabled) throw problem('Activá el beneficio corporativo antes de asignar crédito', 409);
      const balance = Number(user.corporateBalanceCents) + amountCents;
      if (!Number.isSafeInteger(balance) || balance > MAX_BALANCE_CENTS) throw problem('El saldo resultante supera el máximo permitido');
      await user.update({ corporateBalanceCents: balance }, { transaction });
      const movement = await Movement.create({ userId: user.id, adminId: req.user.id, amountCents, balanceAfterCents: balance, requestId }, { transaction });
      return { user: summary(user), movement, repeated: false };
    });
    res.status(result.repeated ? 200 : 201).json({ success: true, ...result, message: result.repeated ? 'Esta asignación ya estaba registrada' : 'Crédito asignado correctamente' });
  }),
  movements: handle(async (req, res) => {
    await findClient(req.params.id);
    const { page } = getPaginationParams(req.query, 10);
    const limit = 10;
    const { count, rows } = await Movement.findAndCountAll({ where: { userId: Number(req.params.id) }, order: [['id', 'DESC']], limit, offset: (page - 1) * limit });
    res.json(buildPaginatedResponse(count, page, limit, rows));
  }),
};
