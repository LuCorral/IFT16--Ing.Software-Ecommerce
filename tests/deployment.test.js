const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ecommerce-deploy-'));
process.env.NODE_ENV = 'test';
process.env.DB_STORAGE = path.join(testDirectory, 'persistent-test.sqlite');
process.env.JWT_SECRET = 'temporary-deployment-test-secret-32chars';
process.env.PORT = '0';
process.env.DEMO_ADMIN_EMAIL = 'admin@example.test';
process.env.DEMO_ADMIN_PASSWORD = 'temporary-admin-password';
process.env.DEMO_CLIENT_EMAIL = 'client@example.test';
process.env.DEMO_CLIENT_PASSWORD = 'temporary-client-password';

const sequelize = require('../src/config/database');
const { validateEnvironment } = require('../src/config/env');
const { initializeDatabase } = require('../src/config/migrations');
const User = require('../src/models/User');
const Producto = require('../src/models/Producto');
const { seedDemo } = require('../scripts/seed-demo');
const { app, startServer } = require('../server');

after(async () => {
  await sequelize.close();
  fs.rmSync(testDirectory, { recursive: true, force: true });
});

test('production environment validation requires persistent, private configuration', () => {
  const validEnvironment = {
    NODE_ENV: 'production',
    JWT_SECRET: 'a'.repeat(48),
    DB_STORAGE: path.join(testDirectory, 'production.sqlite'),
    IP: '127.0.0.1',
    PORT: '8080',
  };
  assert.equal(validateEnvironment(validEnvironment).port, 8080);
  assert.throws(
    () => validateEnvironment({ ...validEnvironment, DB_STORAGE: path.join(__dirname, '..', 'data.sqlite') }),
    /outside the deployed application directory/,
  );
  assert.throws(
    () => validateEnvironment({ ...validEnvironment, JWT_SECRET: '' }),
    /JWT_SECRET must be set/,
  );
});

test('schema setup is repeatable, preserves rows, and snapshots a database before migrations', async () => {
  await sequelize.sync();
  const existingUser = await User.create({
    name: 'Persistente',
    apellido: 'Demo',
    email: 'persistent@example.test',
    password: 'temporary-user-password',
    role: 'client',
  });

  await initializeDatabase(sequelize);
  await initializeDatabase(sequelize);

  assert.equal((await User.findByPk(existingUser.id)).email, 'persistent@example.test');
  const indexes = await sequelize.getQueryInterface().showIndex(User.sequelize.models.Pedido.getTableName());
  assert.ok(indexes.some((index) => index.name === 'pedidos_cliente_idx'));
  assert.equal(fs.readdirSync(testDirectory).filter((file) => file.endsWith('.bak')).length, 1);
});

test('explicit demo data setup is idempotent and does not reset existing records', async () => {
  await seedDemo();
  const userCount = await User.count();
  const productCount = await Producto.count();
  const sampleProduct = await Producto.findOne({ where: { nombre: 'Aro de luz LED de escritorio con trípode' } });
  await sampleProduct.update({ stock: 7 });

  await seedDemo();

  assert.equal(await User.count(), userCount);
  assert.equal(await Producto.count(), productCount);
  assert.equal((await Producto.findByPk(sampleProduct.id)).stock, 7);
});

test('server startup, health, registration, login, profile, and role gates work', async () => {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const request = (url, options) => fetch(`${baseUrl}${url}`, options);

  try {
    const response = await request('/health');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', commit: 'local' });

    const catalogResponse = await request('/api/productos');
    assert.equal(catalogResponse.status, 200);
    assert.ok((await catalogResponse.json()).items.length > 0);
    assert.equal((await request('/img/ArodeLuzLED.png')).status, 200);

    const registerResponse = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cuenta',
        apellido: 'Nueva',
        email: 'registered@example.test',
        password: 'temporary-registration-password',
        role: 'admin',
      }),
    });
    assert.equal(registerResponse.status, 201);
    assert.equal((await registerResponse.json()).user.role, 'client');

    const loginResponse = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'registered@example.test', password: 'temporary-registration-password' }),
    });
    assert.equal(loginResponse.status, 200);
    const { token } = await loginResponse.json();
    const profileResponse = await request('/api/auth/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(profileResponse.status, 200);
    assert.equal((await profileResponse.json()).user.email, 'registered@example.test');
    assert.equal((await request('/api/auth/profile')).status, 401);
    assert.equal((await request('/api/tickets')).status, 401);
    assert.equal((await request('/api/tickets', {
      headers: { Authorization: `Bearer ${token}` },
    })).status, 403);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
