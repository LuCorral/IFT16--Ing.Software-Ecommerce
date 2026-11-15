// Isolated manual validation. No credentials or database paths are persisted here.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ecommerce-manual-'));
const storage = path.join(directory, 'demo.sqlite');
Object.assign(process.env, {
  DB_STORAGE: storage, DB_DIALECT: 'sqlite', NODE_ENV: 'test',
  JWT_SECRET: crypto.randomBytes(48).toString('hex'), SMTP_HOST: '',
  ORDER_MAIL_MODE: 'demo', ORDER_MAIL_TO: '',
});
const db = require('../src/config/database');
const { User, Producto, Pedido, DetallePedido, Pago } = require('../src/models');
const { app } = require('../server');
let server;
async function main() {
  if (db.options.storage !== storage) throw new Error('La base no es la base temporal esperada');
  const account = await require('nodemailer').createTestAccount();
  Object.assign(process.env, {
    SMTP_HOST: account.smtp.host, SMTP_PORT: String(account.smtp.port), SMTP_SECURE: String(account.smtp.secure),
    SMTP_USER: account.user, SMTP_PASSWORD: account.pass, SMTP_FROM: account.user, ORDER_MAIL_TO: account.user,
  });
  await db.sync();
  const password = `Demo-${crypto.randomBytes(6).toString('hex')}-a1`;
  const users = [];
  for (const [name, email, role] of [
    ['Administrador', 'admin@example.test', 'admin'], ['Cliente', 'cliente@example.test', 'client'],
    ['Otra cuenta', 'otro@example.test', 'client'], ['Cuenta descartable', 'baja@example.test', 'client'],
  ]) users.push(await User.create({ name, apellido: 'Demostración', email, role, password }));
  const seeded = spawnSync(process.execPath, ['seed_DB.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, DB_STORAGE: storage, DB_DIALECT: 'sqlite' }, encoding: 'utf8' });
  if (seeded.status !== 0) throw new Error('Falló la carga del seed original');
  const product = await Producto.findOne({ where: { nombre: 'Aro de luz LED de escritorio con trípode' } });
  for (const [nombre, stock] of [['Aspiradora robot Wi-Fi', 3], ["Smart TV 43' Full HD Android", 5], ['Tablet Lenovo Tab M10 Plus 10.6 Fhd', 0]]) await Producto.update({ stock }, { where: { nombre } });
  for (const [state, quantity, date] of [
    ['Pagado', 1, '2026-11-05T15:00:00Z'], ['Enviado', 2, '2026-11-06T15:00:00Z'], ['Entregado', 3, '2026-11-07T15:00:00Z'],
    ['Pendiente', 4, '2026-11-08T15:00:00Z'], ['Cancelado', 5, '2026-11-09T15:00:00Z'], ['Pagado', 9, '2026-10-10T15:00:00Z'],
  ]) {
    const total = product.precio * quantity;
    const order = await Pedido.create({ cliente: `demo-user:${users[1].id}:${users[1].email}`, estado: state, total, subtotal: total, fecha: date.slice(0, 10), createdAt: new Date(date), updatedAt: new Date(date) });
    await DetallePedido.create({ pedidoId: order.id, productoId: product.id, nombreProducto: product.nombre, cantidad: quantity, precioUnitario: product.precio, subtotal: total });
    if (['Pagado', 'Enviado', 'Entregado'].includes(state)) await Pago.create({ pedidoId: order.id, monto: total, metodo: 'Tarjeta (fixture de demostración)', estado: 'Aprobado', fecha: new Date(date) });
  }
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  process.env.PUBLIC_URL = `http://127.0.0.1:${server.address().port}`;
  console.log(JSON.stringify({ url: process.env.PUBLIC_URL, database: storage, password, users: users.map((u) => ({ email: u.email, role: u.role })), smtp: 'Ethereal — solo capturas, sin entrega real' }, null, 2));
}
process.on('SIGINT', async () => { if (server) await new Promise((r) => server.close(r)); await db.close(); process.exit(0); });
main().catch(async (error) => { console.error('No se pudo iniciar la demo aislada:', error.code || error.name); await db.close(); process.exitCode = 1; });
