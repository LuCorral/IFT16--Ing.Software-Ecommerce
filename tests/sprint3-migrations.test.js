const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { test } = require('node:test');
const { Sequelize, DataTypes, QueryTypes } = require('sequelize');
test('migraciones de canje y correo preservan pedidos y simulaciones anteriores sin enviarlas', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sprint3-migrations-'));
  const db = new Sequelize({ dialect: 'sqlite', storage: path.join(dir, 'old.sqlite'), logging: false });
  try {
    const qi = db.getQueryInterface();
    await qi.createTable('Pedidos', { id: { type: DataTypes.INTEGER, primaryKey: true }, cliente: DataTypes.STRING, total: DataTypes.FLOAT });
    await qi.createTable('notificaciones_correo', { id: { type: DataTypes.INTEGER, primaryKey: true }, pedido_id: DataTypes.INTEGER, cuerpo: DataTypes.TEXT });
    await qi.bulkInsert('Pedidos', [{ id: 12, cliente: 'histórico', total: 123.45 }]);
    await qi.bulkInsert('notificaciones_correo', [{ id: 34, pedido_id: 12, cuerpo: 'Correo histórico simulado' }]);
    for (let i = 0; i < 2; i++) for (const migration of ['005-order-credit', '006-mail-delivery']) await db.transaction(async (transaction) => require(`../src/migrations/${migration}`).up(qi, transaction));
    const [order] = await db.query('SELECT * FROM Pedidos', { type: QueryTypes.SELECT });
    assert.equal(order.id, 12); assert.equal(order.total, 123.45); assert.equal(order.creditUsedCents, 0); assert.equal(order.checkoutRequestId, null);
    const [mail] = await db.query('SELECT * FROM notificaciones_correo', { type: QueryTypes.SELECT });
    assert.equal(mail.id, 34); assert.equal(mail.cuerpo, 'Correo histórico simulado'); assert.equal(mail.deliveryStatus, 'legado'); assert.equal(mail.attempts, 0);
  } finally { await db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
