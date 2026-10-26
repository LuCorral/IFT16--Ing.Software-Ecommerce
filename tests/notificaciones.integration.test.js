const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ecommerce-notificaciones-'));
process.env.DB_STORAGE = path.join(testDirectory, 'ecommerce-test.sqlite');
process.env.JWT_SECRET = 'temporary-test-secret-only';

const express = require('express');
const jwt = require('jsonwebtoken');
const sequelize = require('../src/config/database');
const User = require('../src/models/User');
const Producto = require('../src/models/Producto');
const NotificacionCorreo = require('../src/models/NotificacionCorreo');
const orderRoutes = require('../src/routes/pedidoRoutes');

const app = express();
app.use(express.json());
app.use('/api/pedidos', orderRoutes);

let server;
let baseUrl;
let admin;
let client;
let product;

const tokenFor = (user) => jwt.sign({
  id: user.id,
  name: user.name,
  apellido: user.apellido,
  email: user.email,
  role: user.role,
}, process.env.JWT_SECRET);

const auth = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });
const jsonHeaders = (user) => ({ ...auth(user), 'Content-Type': 'application/json' });
const request = (url, options = {}) => fetch(`${baseUrl}${url}`, options);

before(async () => {
  await sequelize.sync({ force: true });
  admin = await User.create({
    name: 'Alicia',
    apellido: 'Admin',
    email: 'admin@example.test',
    password: 'hashed',
    role: 'admin',
  });
  client = await User.create({
    name: 'Camila',
    apellido: 'Cliente',
    email: 'camila@example.test',
    password: 'hashed',
    role: 'client',
  });
  product = await Producto.create({
    nombre: 'Producto de prueba',
    precio: 1250,
    stock: 5,
    categoria: 'Hogar',
    validFrom: new Date('2020-01-01'),
    validTo: new Date('2099-12-31'),
  });

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  await sequelize.close();
  fs.rmSync(testDirectory, { recursive: true, force: true });
});

test('notificaciones de correo simulado', async (t) => {
  let orderId;

  await t.test('crear un pedido guarda y devuelve el correo de confirmación', async () => {
    const response = await request('/api/pedidos', {
      method: 'POST',
      headers: jsonHeaders(client),
      body: JSON.stringify({ productos: [{ productoId: product.id, cantidad: 1 }] }),
    });
    assert.equal(response.status, 201);

    const data = await response.json();
    orderId = data.pedido.id;
    assert.equal(data.correo_simulado.estado_pedido, 'Pendiente');
    assert.equal(data.correo_simulado.destinatario, client.email);
    assert.equal(data.correo_simulado.pedido_id, orderId);
    assert.match(data.correo_simulado.asunto, new RegExp(`#${orderId}`));
    assert.ok(data.correo_simulado.cuerpo.length > 0);
    assert.equal(await NotificacionCorreo.count({ where: { pedido_id: orderId } }), 1);
  });

  await t.test('pagado, enviado y entregado generan su correo', async () => {
    const cases = [
      ['Pagado', /confirmado/i],
      ['Enviado', /camino/i],
      ['Entregado', /entregado/i],
    ];

    for (const [estado, patron] of cases) {
      const response = await request(`/api/pedidos/${orderId}`, {
        method: 'PUT',
        headers: jsonHeaders(admin),
        body: JSON.stringify({ estado }),
      });
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.correo_simulado.estado_pedido, estado);
      assert.match(data.correo_simulado.asunto, patron);
      assert.equal(data.correo_simulado.destinatario, client.email);
    }

    assert.equal(await NotificacionCorreo.count({ where: { pedido_id: orderId } }), 4);
  });

  await t.test('pendiente o repetido no generan correo', async () => {
    for (const estado of ['Pendiente', 'Pendiente']) {
      const response = await request(`/api/pedidos/${orderId}`, {
        method: 'PUT',
        headers: jsonHeaders(admin),
        body: JSON.stringify({ estado }),
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).correo_simulado, null);
    }
    assert.equal(await NotificacionCorreo.count({ where: { pedido_id: orderId } }), 4);
  });

  await t.test('un pedido rechazado no deja notificación huérfana', async () => {
    const before = await NotificacionCorreo.count();
    const response = await request('/api/pedidos', {
      method: 'POST',
      headers: jsonHeaders(client),
      body: JSON.stringify({ productos: [{ productoId: product.id, cantidad: 999 }] }),
    });
    assert.equal(response.status, 400);
    assert.equal(await NotificacionCorreo.count(), before);
  });

  await t.test('el pago aprobado también genera su correo simulado', async () => {
    const created = await request('/api/pedidos', {
      method: 'POST',
      headers: jsonHeaders(client),
      body: JSON.stringify({ productos: [{ productoId: product.id, cantidad: 1 }] }),
    });
    assert.equal(created.status, 201);
    const createdData = await created.json();

    const paid = await request(`/api/pedidos/${createdData.pedido.id}/pagar`, {
      method: 'POST',
      headers: jsonHeaders(client),
      body: JSON.stringify({ metodo: 'tarjeta', resultadoSimulado: 'aprobado' }),
    });
    assert.equal(paid.status, 200);
    const paidData = await paid.json();
    assert.equal(paidData.estadoPedido, 'Pagado');
    assert.equal(paidData.correo_simulado.estado_pedido, 'Pagado');
    assert.equal(paidData.correo_simulado.destinatario, client.email);
  });
});
