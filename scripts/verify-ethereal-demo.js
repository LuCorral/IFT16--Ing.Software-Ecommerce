// Opt-in manual check: uses only temporary data and Ethereal, never real delivery.
if (!process.argv.includes('--ethereal')) {
  console.error('Verificación manual opcional: node scripts/verify-ethereal-demo.js --ethereal');
  process.exit(1);
}
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const assert = require('node:assert/strict');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecommerce-ethereal-'));
process.env.DB_STORAGE = path.join(dir, 'test.sqlite'); process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'temporary-ethereal-verification-only';
const nodemailer = require('nodemailer');
const db = require('../src/config/database');
const { User, Producto, NotificacionCorreo: Mail } = require('../src/models');
const { app } = require('../server');
const jwt = require('jsonwebtoken');
(async () => {
  let server;
  try {
    const account = await nodemailer.createTestAccount();
    Object.assign(process.env, { SMTP_HOST: account.smtp.host, SMTP_PORT: String(account.smtp.port), SMTP_SECURE: String(account.smtp.secure), SMTP_USER: account.user, SMTP_PASSWORD: account.pass, SMTP_FROM: account.user, ORDER_MAIL_MODE: 'demo', ORDER_MAIL_TO: account.user });
    await db.sync({ force: true });
    const user = await User.create({ name: 'Cliente', apellido: 'Demostración', email: 'cliente@example.test', password: 'temporary123' });
    const admin = await User.create({ name: 'Admin', apellido: 'Demostración', email: 'admin@example.test', password: 'temporary123', role: 'admin' });
    const product = await Producto.create({ nombre: 'Producto de prueba', precio: 10, stock: 5, categoria: 'Test' });
    server = app.listen(0, '127.0.0.1'); await new Promise((r) => server.once('listening', r));
    const call = async (url, method, body, session = user) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`, { method, headers: { Authorization: `Bearer ${jwt.sign({ id: session.id }, process.env.JWT_SECRET)}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      assert.ok(response.ok, `${method} ${url}: ${response.status}`); return response.json();
    };
    const create = () => call('/api/pedidos', 'POST', { productos: [{ productoId: product.id, cantidad: 1 }] });
    const first = await create();
    await call(`/api/pedidos/${first.pedido.id}/pagar`, 'POST', { metodo: 'tarjeta' });
    await call(`/api/pedidos/${first.pedido.id}`, 'PUT', { estado: 'Enviado' }, admin);
    await call(`/api/pedidos/${first.pedido.id}`, 'PUT', { estado: 'Entregado' }, admin);
    const second = await create(); await call(`/api/pedidos/${second.pedido.id}/cancelar`, 'PATCH');
    const records = await Mail.findAll({ order: [['id', 'ASC']] });
    assert.equal(records.length, 6);
    for (const record of records) { assert.equal(record.deliveryStatus, 'demo', `Correo ${record.id}: ${record.lastError}`); assert.match(record.previewUrl, /^https:\/\/ethereal.email\//); console.log(`${record.estado_pedido}: ${record.previewUrl}`); }
    console.log('6 capturas Ethereal verificadas; sin entrega de correos reales.');
  } finally {
    if (server) await new Promise((r) => server.close(r)); await db.close(); fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(() => { console.error('No se pudo verificar Ethereal. No se imprimen credenciales.'); process.exitCode = 1; });
