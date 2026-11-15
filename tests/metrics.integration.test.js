const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { test, before, after } = require('node:test');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'metrics-'));
process.env.DB_STORAGE = path.join(directory, 'test.sqlite'); process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'metrics-test-secret';
const db = require('../src/config/database');
const { Pedido, Pago, Producto, User } = require('../src/models');
const { app } = require('../server');
const jwt = require('jsonwebtoken');
let server, base, admin, client;
const request = (query, user = admin) => fetch(`${base}/api/metricas${query}`, { headers: user ? { Authorization: `Bearer ${jwt.sign({ id: user.id }, process.env.JWT_SECRET)}` } : {} });
before(async () => {
  await db.sync({ force: true });
  admin = await User.create({ name: 'Admin', apellido: 'Test', email: 'admin@example.test', password: 'test123', role: 'admin' });
  client = await User.create({ name: 'Client', apellido: 'Test', email: 'client@example.test', password: 'test123' });
  for (const [stock, name] of [[0, 'Sin stock'], [1, 'Bajo1'], [5, 'Bajo5'], [6, 'Normal']]) await Producto.create({ nombre: name, precio: 10, stock, categoria: 'Test' });
  for (const [estado, total, approved, createdAt] of [
    ['Pagado', 100, true, '2026-02-01T03:00:00Z'], ['Enviado', 200, true, '2026-02-28T23:59:59Z'], ['Entregado', 300, true, '2026-03-01T02:59:59Z'],
    ['Pendiente', 400, true, '2026-02-10T12:00:00Z'], ['Cancelado', 500, true, '2026-02-10T12:00:00Z'], ['Pagado', 600, false, '2026-02-10T12:00:00Z'],
    ['Pagado', 700, true, '2026-02-01T02:59:59Z'], ['Pagado', 800, true, '2026-03-01T03:00:00Z'],
  ]) {
    const order = await Pedido.create({ cliente: 'histórico', estado, total, creditUsedCents: 5000, createdAt: new Date(createdAt), updatedAt: new Date(createdAt) });
    await Pago.create({ pedidoId: order.id, metodo: 'Tarjeta', monto: total - 50, estado: approved ? 'Aprobado' : 'Rechazado' });
    if (total === 100) await Pago.create({ pedidoId: order.id, metodo: 'Tarjeta', monto: 50, estado: 'Aprobado' }); // Legacy duplicate cannot inflate metrics.
  }
  server = app.listen(0, '127.0.0.1'); await new Promise((r) => server.once('listening', r)); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise((r) => server.close(r)); await db.close(); fs.rmSync(directory, { recursive: true, force: true }); });
test('solo administradores; valida mes/año en servidor', async () => {
  assert.equal((await request('', null)).status, 401); assert.equal((await request('', client)).status, 403);
  for (const q of ['?month=0&year=2026', '?month=13&year=2026', '?month=2.5&year=2026', '?month=2&year=abc', '?month[]=2']) assert.equal((await request(q)).status, 400, q);
});
test('mes argentino usa creación, incluye extremos correctos y suma cada pedido pagado una vez', async () => {
  const response = await request('?month=2&year=2026'); assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.totalOrders, 6); assert.equal(result.paidOrders, 3); assert.equal(result.totalSales, 600); assert.equal(result.averageTicket, 200);
  assert.deepEqual(result.byStatus, { Pendiente: 1, Pagado: 2, Enviado: 1, Entregado: 1, Cancelado: 1 });
  assert.equal(result.lowStock, 2); assert.equal(result.outOfStock, 1); assert.equal(result.lowStockThreshold, 5);
  assert.equal(result.period.start, '2026-02-01T03:00:00.000Z'); assert.equal(result.period.endExclusive, '2026-03-01T03:00:00.000Z');
});
test('sin datos devuelve ceros y stock actual; período por defecto usa Buenos Aires', async () => {
  const empty = await (await request('?month=1&year=2030')).json();
  assert.equal(empty.totalOrders, 0); assert.equal(empty.totalSales, 0); assert.equal(empty.averageTicket, 0); assert.equal(empty.lowStock, 2);
  const current = await (await request('')).json();
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Argentina/Buenos_Aires', month: 'numeric', year: 'numeric' }).formatToParts(new Date());
  assert.equal(current.period.month, Number(parts.find((p) => p.type === 'month').value)); assert.equal(current.period.year, Number(parts.find((p) => p.type === 'year').value));
});
test('cola de correos solo administrativa; entrega incierta requiere revisión y no reenvío', async () => {
  const { NotificacionCorreo: Mail } = require('../src/models');
  const row = await Mail.create({ pedido_id: 1, destinatario: 'test@example.test', asunto: 'Test', cuerpo: 'Test', estado_pedido: 'Pagado', deliveryStatus: 'incierto' });
  const call = (url, method, user) => fetch(base + url, { method, headers: user ? { Authorization: `Bearer ${jwt.sign({ id: user.id }, process.env.JWT_SECRET)}` } : {} });
  for (const user of [null, client]) {
    assert.equal((await call('/api/notificaciones-correo', 'GET', user)).status, user ? 403 : 401);
    assert.equal((await call(`/api/notificaciones-correo/${row.id}/reintentar`, 'POST', user)).status, user ? 403 : 401);
  }
  assert.equal((await call('/api/notificaciones-correo', 'GET', admin)).status, 200);
  assert.equal((await call(`/api/notificaciones-correo/${row.id}/reintentar`, 'POST', admin)).status, 409);
  assert.equal((await row.reload()).attempts, 0);
});
test('navegación de inventario requiere admin, consulta stock actual y conserva límites/paginación', async () => {
  const get = (query, user = admin) => fetch(`${base}/api/productos/inventario?${query}`, { headers: user ? { Authorization: `Bearer ${jwt.sign({ id: user.id }, process.env.JWT_SECRET)}` } : {} });
  assert.equal((await get('stockFilter=low', null)).status, 401);
  assert.equal((await get('stockFilter=low', client)).status, 403);
  assert.equal((await get('stockFilter=other')).status, 400);
  const low = await (await get('stockFilter=low&limit=1')).json();
  assert.equal(low.pagination.totalItems, 2); assert.equal(low.items.length, 1); assert.equal(low.items[0].stock, 1);
  const second = await (await get('stockFilter=low&limit=1&page=2')).json(); assert.equal(second.items[0].stock, 5);
  const empty = await (await get('stockFilter=empty&month=12&year=2030')).json();
  assert.equal(empty.pagination.totalItems, 1); assert.equal(empty.items[0].stock, 0);
  const expired = await Producto.create({ nombre: 'Bajo vencido', precio: 99, categoria: 'Histórica', image: '/img/ArodeLuzLED.png', stock: 3, validTo: new Date('2020-01-01') });
  const historic = await (await get('stockFilter=low&categoria=Histórica')).json();
  assert.equal(historic.items.length, 1); assert.equal(historic.items[0].id, expired.id); assert.equal(historic.items[0].precio, 99); assert.equal(historic.items[0].image, '/img/ArodeLuzLED.png');
  await expired.update({ stock: 6 });
  assert.equal((await (await get('stockFilter=low&categoria=Histórica')).json()).items.length, 0);
});
