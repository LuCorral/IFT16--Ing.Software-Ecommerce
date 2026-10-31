const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { test, before, after } = require('node:test');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ecommerce-corporate-'));
process.env.NODE_ENV = 'test';
process.env.DB_STORAGE = path.join(directory, 'test.sqlite');
process.env.JWT_SECRET = 'corporate-integration-test-secret-only';
const sequelize = require('../src/config/database');
const { User, CorporateMovement: Movement } = require('../src/models');
const { app } = require('../server');
const jwt = require('jsonwebtoken');
let server, base, admin, client, other, adminToken, clientToken;
const token = (user, role = user.role) => jwt.sign({ id: user.id, role, sessionVersion: 0 }, process.env.JWT_SECRET);
const headers = (session) => ({ 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session}` } : {}) });
const request = (url, method = 'GET', body, session = adminToken) => fetch(base + url, { method, headers: headers(session), ...(body ? { body: JSON.stringify(body) } : {}) });
const enabled = (value, user = client, session = adminToken) => request(`/api/usuarios/${user.id}/corporativo`, 'PUT', { enabled: value }, session);
const assign = (amount, requestId = randomUUID(), user = client, session = adminToken) => request(`/api/usuarios/${user.id}/credito-corporativo`, 'POST', { amount, requestId }, session);
before(async () => {
  await sequelize.sync({ force: true });
  admin = await User.create({ name: 'Admin', apellido: 'Prueba', email: 'admin@example.test', password: 'admin123', role: 'admin' });
  client = await User.create({ name: 'Ana', apellido: 'Empleado', email: 'ana@example.test', password: 'client123' });
  other = await User.create({ name: 'Bruno', apellido: 'Otro', email: 'bruno@example.test', password: 'client123' });
  adminToken = token(admin); clientToken = token(client);
  server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await sequelize.close(); fs.rmSync(directory, { recursive: true, force: true });
});
test('solo admin puede activar, asignar o consultar movimientos; JWT no puede elevar rol', async () => {
  for (const session of [null, clientToken, token(client, 'admin')]) {
    const expected = session ? 403 : 401;
    assert.equal((await enabled(true, client, session)).status, expected);
    assert.equal((await assign('50000', randomUUID(), client, session)).status, expected);
    assert.equal((await request(`/api/usuarios/${client.id}/movimientos-corporativos`, 'GET', null, session)).status, expected);
  }
  assert.equal((await enabled(true, admin)).status, 400);
  assert.equal((await request('/api/usuarios/999999/corporativo', 'PUT', { enabled: true })).status, 404);
  assert.equal((await request(`/api/usuarios/${client.id}/corporativo`, 'PUT', { enabled: 'true' })).status, 400);
  assert.equal((await assign('50000')).status, 409);
  await client.reload(); assert.equal(client.corporateEnabled, false); assert.equal(Number(client.corporateBalanceCents), 0);
});
test('búsqueda por nombre, apellido y email funciona en servidor y conserva paginación', async () => {
  for (const search of ['ANA', 'empleado', 'ANA@EXAMPLE.TEST']) {
    const result = await (await request(`/api/usuarios?search=${encodeURIComponent(search)}&limit=1`)).json();
    assert.equal(result.pagination.totalItems, 1); assert.equal(result.items[0].id, client.id);
  }
  const result = await (await request('/api/usuarios?search=%25')).json();
  assert.equal(result.items.length, 0);
});
test('activación y asignaciones positivas se suman y registran administrador, fecha y saldo', async () => {
  assert.equal((await enabled(true)).status, 200);
  assert.equal((await assign('50000')).status, 201);
  assert.equal((await assign('100000.25')).status, 201);
  await client.reload(); assert.equal(client.role, 'client'); assert.equal(Number(client.corporateBalanceCents), 15000025);
  const result = await (await request(`/api/usuarios/${client.id}/movimientos-corporativos`)).json();
  assert.equal(result.pagination.totalItems, 2);
  assert.equal(result.items[0].adminId, admin.id); assert.equal(Number(result.items[0].balanceAfterCents), 15000025); assert.ok(result.items[0].createdAt);
  const user = await (await request(`/api/usuarios/${client.id}`)).json();
  assert.equal(user.corporateEnabled, true); assert.equal(Number(user.corporateBalanceCents), 15000025);
});
test('rechaza cero, negativos, decimales excesivos e importes inválidos sin alterar saldo', async () => {
  const before = Number((await client.reload()).corporateBalanceCents);
  for (const value of [0, -1, '0.00', '1.001', '1e3', '100,20', 'Infinity', {}, true, null, '1000000001']) {
    assert.equal((await assign(value)).status, 400, String(value));
  }
  assert.equal((await assign('1', 'invalid')).status, 400);
  assert.equal(Number((await client.reload()).corporateBalanceCents), before);
});
test('reintentar solicitud no duplica saldo; claves con otro contenido se rechazan', async () => {
  const key = randomUUID();
  const before = Number((await client.reload()).corporateBalanceCents);
  assert.equal((await assign('25.35', key)).status, 201);
  assert.equal((await assign('25.35', key)).status, 200);
  assert.equal((await assign('30', key)).status, 409);
  assert.equal(Number((await client.reload()).corporateBalanceCents), before + 2535);
  assert.equal(await Movement.count({ where: { requestId: key } }), 1);
});
test('asignaciones simultáneas no pierden incrementos y reintentos concurrentes son únicos', async () => {
  const before = Number((await client.reload()).corporateBalanceCents);
  const results = await Promise.all([assign('1.10'), assign('2.20'), assign('3.30')]);
  assert.deepEqual(results.map((r) => r.status), [201, 201, 201]);
  assert.equal(Number((await client.reload()).corporateBalanceCents), before + 660);
  const key = randomUUID();
  const repeated = await Promise.all([assign('1', key), assign('1', key)]);
  assert.deepEqual(repeated.map((r) => r.status).sort(), [200, 201]);
  assert.equal(Number((await client.reload()).corporateBalanceCents), before + 760);
});
test('fallo del movimiento revierte saldo; desactivar conserva saldo e impide asignaciones', async () => {
  const before = Number((await client.reload()).corporateBalanceCents);
  const create = Movement.create;
  Movement.create = async () => { throw new Error('fallo deliberado'); };
  try { assert.equal((await assign('100')).status, 500); }
  finally { Movement.create = create; }
  assert.equal(Number((await client.reload()).corporateBalanceCents), before);
  assert.equal((await enabled(false)).status, 200);
  assert.equal((await assign('1')).status, 409);
  assert.equal(Number((await client.reload()).corporateBalanceCents), before);
});
test('cliente no altera condición ni saldo desde perfil ni registro', async () => {
  assert.equal((await request('/api/auth/profile', 'PUT', { name: 'Ana', apellido: 'Empleado', email: client.email,
    corporateEnabled: true, corporateBalanceCents: 99999999 }, clientToken)).status, 200);
  await client.reload(); assert.equal(client.corporateEnabled, false);
  const response = await request('/api/auth/register', 'POST', { name: 'Nuevo', apellido: 'Cliente', email: 'nuevo@example.test', password: 'client123', corporateEnabled: true, corporateBalanceCents: 999 }, null);
  assert.equal(response.status, 201);
  const newUser = await User.findOne({ where: { email: 'nuevo@example.test' } });
  assert.equal(newUser.corporateEnabled, false); assert.equal(Number(newUser.corporateBalanceCents), 0);
});
test('migración de base anterior preserva cuentas e inicializa beneficio inactivo y saldo cero', async () => {
  const qi = sequelize.getQueryInterface();
  await Movement.drop();
  await qi.removeColumn('Users', 'corporateEnabled'); await qi.removeColumn('Users', 'corporateBalanceCents');
  const migration = require('../src/migrations/004-corporate-credit');
  await sequelize.transaction(async (transaction) => migration.up(qi, transaction));
  await sequelize.transaction(async (transaction) => migration.up(qi, transaction));
  await client.reload(); assert.equal(client.email, 'ana@example.test'); assert.equal(client.corporateEnabled, false); assert.equal(Number(client.corporateBalanceCents), 0);
  await enabled(true); assert.equal((await assign('10.25')).status, 201);
  await sequelize.transaction(async (transaction) => migration.up(qi, transaction));
  assert.equal(Number((await client.reload()).corporateBalanceCents), 1025);
  assert.equal(await Movement.count(), 1);
});
test('eliminar un usuario con asignaciones conserva el registro sin bloquear la baja', async () => {
  const disposable = await User.create({ name: 'Temporal', apellido: 'Prueba', email: 'temporal@example.test', password: 'client123' });
  await enabled(true, disposable); assert.equal((await assign('25', randomUUID(), disposable)).status, 201);
  const movement = await Movement.findOne({ where: { userId: disposable.id } });
  const response = await request(`/api/usuarios/${disposable.id}`, 'DELETE');
  assert.equal(response.status, 200);
  await movement.reload(); assert.equal(movement.userId, null); assert.equal(Number(movement.amountCents), 2500);
});
