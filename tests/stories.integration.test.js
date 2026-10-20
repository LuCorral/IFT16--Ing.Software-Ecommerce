const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ecommerce-stories-'));
process.env.DB_STORAGE = path.join(testDirectory, 'ecommerce-test.sqlite');
process.env.JWT_SECRET = 'temporary-test-secret-only';

const express = require('express');
const jwt = require('jsonwebtoken');
const sequelize = require('../src/config/database');
const User = require('../src/models/User');
const Producto = require('../src/models/Producto');
const Pedido = require('../src/models/Pedido');
const Ticket = require('../src/models/Ticket');
const productRoutes = require('../src/routes/productosRoutes');
const categoryRoutes = require('../src/routes/categoriasRoutes');
const orderRoutes = require('../src/routes/pedidoRoutes');

const app = express();
app.use(express.json());
app.use('/api/productos', productRoutes);
app.use('/api/categorias', categoryRoutes);
app.use('/api/pedidos', orderRoutes);

let server;
let baseUrl;
let admin;
let client;
let otherClient;
let product;

const tokenFor = (user) => jwt.sign({
  id: user.id,
  name: user.name,
  apellido: user.apellido,
  email: user.email,
  role: user.role,
}, process.env.JWT_SECRET);

const auth = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });

async function request(url, options = {}) {
  return fetch(`${baseUrl}${url}`, options);
}

before(async () => {
  await sequelize.sync({ force: true });
  admin = await User.create({ name: 'Alicia', apellido: 'Admin', email: 'admin@example.test', password: 'hashed', role: 'admin' });
  client = await User.create({ name: 'Camila', apellido: 'Cliente', email: 'camila@example.test', password: 'hashed', role: 'client' });
  otherClient = await User.create({ name: 'Bruno', apellido: 'Otro', email: 'bruno@example.test', password: 'hashed', role: 'client' });
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

test('historias de categorías, pedidos, permisos, estados y comprobantes', async (t) => {
  let orderId;
  let legacyOrderId;

  await t.test('categorías disponibles y CRUD de productos validado en servidor', async () => {
    const categoriesResponse = await request('/api/categorias');
    assert.equal(categoriesResponse.status, 200);
    assert.deepEqual(await categoriesResponse.json(), ['Hogar']);

    const publicCatalog = await request('/api/productos');
    assert.equal(publicCatalog.status, 200);
    assert.equal((await publicCatalog.json()).items.length, 1);

    const noSessionCreate = await request('/api/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'Inválido', categoria: 'Hogar', precio: 1, stock: 1 }),
    });
    assert.equal(noSessionCreate.status, 401);

    const clientCreate = await request('/api/productos', {
      method: 'POST',
      headers: { ...auth(client), 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'Inválido', categoria: 'Hogar', precio: 1, stock: 1 }),
    });
    assert.equal(clientCreate.status, 403);

    const invalidCreate = await request('/api/productos', {
      method: 'POST',
      headers: { ...auth(admin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'Inválido', categoria: 'No existente', precio: 1, stock: 1 }),
    });
    assert.equal(invalidCreate.status, 400);

    const validCreate = await request('/api/productos', {
      method: 'POST',
      headers: { ...auth(admin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'Nuevo', categoria: 'Hogar', precio: 2, stock: 3 }),
    });
    assert.equal(validCreate.status, 201);
    const newProduct = (await validCreate.json()).producto;

    const invalidEdit = await request(`/api/productos/${newProduct.id}`, {
      method: 'PUT',
      headers: { ...auth(admin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'Nuevo', categoria: 'Inventada', precio: 2, stock: 3 }),
    });
    assert.equal(invalidEdit.status, 400);

    const validEdit = await request(`/api/productos/${newProduct.id}`, {
      method: 'PUT',
      headers: { ...auth(admin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'Editado', categoria: 'Hogar', precio: 4, stock: 3 }),
    });
    assert.equal(validEdit.status, 200);
    assert.equal((await validEdit.json()).producto.categoria, 'Hogar');
  });

  await t.test('pedido creado y aislado por cliente, incluyendo identificador histórico de email', async () => {
    const noSessionList = await request('/api/pedidos');
    assert.equal(noSessionList.status, 401);

    const created = await request('/api/pedidos', {
      method: 'POST',
      headers: { ...auth(client), 'Content-Type': 'application/json' },
      body: JSON.stringify({ productos: [{ productoId: product.id, cantidad: 1 }] }),
    });
    assert.equal(created.status, 201);
    const createdData = await created.json();
    orderId = createdData.pedido.id;
    assert.equal(createdData.pedido.clienteInfo.nombre, 'Camila');
    assert.equal(Object.hasOwn(createdData.pedido, 'cliente'), false);

    const legacyOrder = await Pedido.create({
      cliente: client.email,
      fecha: new Date().toISOString().slice(0, 10),
      estado: 'Pagado',
      total: 25,
      subtotal: 25,
      descuento: 0,
    });
    legacyOrderId = legacyOrder.id;

    const foreignOrder = await Pedido.create({
      cliente: `demo-user:${otherClient.id}:${otherClient.email}`,
      fecha: new Date().toISOString().slice(0, 10),
      estado: 'Pendiente',
      total: 1,
      subtotal: 1,
      descuento: 0,
    });

    const ownOrdersResponse = await request('/api/pedidos', { headers: auth(client) });
    assert.equal(ownOrdersResponse.status, 200);
    const ownOrders = await ownOrdersResponse.json();
    assert.deepEqual(ownOrders.map((order) => order.id), [legacyOrderId, orderId]);
    assert.equal(ownOrders[0].clienteInfo.email, client.email);
    assert.equal(JSON.stringify(ownOrders).includes('demo-user:'), false);
    assert.equal(JSON.stringify(ownOrders).includes('"password"'), false);
    assert.equal(JSON.stringify(ownOrders).includes('"token"'), false);

    const legacyOrderResponse = await request(`/api/pedidos/${legacyOrderId}`, { headers: auth(client) });
    assert.equal(legacyOrderResponse.status, 200);
    assert.equal((await legacyOrderResponse.json()).clienteInfo.email, client.email);

    const foreignAccess = await request(`/api/pedidos/${foreignOrder.id}`, { headers: auth(client) });
    assert.equal(foreignAccess.status, 404);
    const noSessionAccess = await request(`/api/pedidos/${orderId}`);
    assert.equal(noSessionAccess.status, 401);

    const adminOrders = await request('/api/pedidos', { headers: auth(admin) });
    assert.equal(adminOrders.status, 200);
    const listedOrders = await adminOrders.json();
    const ownedAdminOrder = listedOrders.find((order) => order.id === orderId);
    assert.deepEqual(ownedAdminOrder.clienteInfo, {
      nombre: 'Camila',
      apellido: 'Cliente',
      email: 'camila@example.test',
    });

    const currentProduct = await Producto.findByPk(product.id);
    assert.equal(currentProduct.stock, 4);
  });

  await t.test('transiciones válidas, no válidas y comprobante accesible tras el envío y la entrega', async () => {
    const payResponse = await request(`/api/pedidos/${orderId}/pagar`, {
      method: 'POST',
      headers: { ...auth(client), 'Content-Type': 'application/json' },
      body: JSON.stringify({ metodo: 'tarjeta', resultadoSimulado: 'aprobado' }),
    });
    assert.equal(payResponse.status, 200);
    assert.equal((await payResponse.json()).estadoPedido, 'Pagado');

    const clientTransition = await request(`/api/pedidos/${orderId}`, {
      method: 'PUT',
      headers: { ...auth(client), 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'Enviado' }),
    });
    assert.equal(clientTransition.status, 403);

    const invalidTransition = await request(`/api/pedidos/${orderId}`, {
      method: 'PUT',
      headers: { ...auth(admin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'Entregado' }),
    });
    assert.equal(invalidTransition.status, 400);

    const pagadoReceipt = await request(`/api/pedidos/${orderId}/comprobante`, { headers: auth(client) });
    assert.equal(pagadoReceipt.status, 200);

    const unauthorizedReceipt = await request(`/api/pedidos/${orderId}/comprobante`);
    assert.equal(unauthorizedReceipt.status, 401);
    const foreignReceipt = await request(`/api/pedidos/${legacyOrderId}/comprobante`, { headers: auth(otherClient) });
    assert.equal(foreignReceipt.status, 404);

    const shipped = await request(`/api/pedidos/${orderId}`, {
      method: 'PUT',
      headers: { ...auth(admin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'Enviado' }),
    });
    assert.equal(shipped.status, 200);
    assert.equal((await shipped.json()).pedido.estado, 'Enviado');
    assert.equal((await request(`/api/pedidos/${orderId}/comprobante`, { headers: auth(client) })).status, 200);

    const delivered = await request(`/api/pedidos/${orderId}`, {
      method: 'PUT',
      headers: { ...auth(admin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'Entregado' }),
    });
    assert.equal(delivered.status, 200);
    assert.equal((await delivered.json()).pedido.estado, 'Entregado');
    assert.equal((await request(`/api/pedidos/${orderId}/comprobante`, { headers: auth(client) })).status, 200);

    const repeatedTransition = await request(`/api/pedidos/${orderId}`, {
      method: 'PUT',
      headers: { ...auth(admin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'Enviado' }),
    });
    assert.equal(repeatedTransition.status, 400);

    const ticket = await Ticket.findOne({ where: { id_pedido: orderId } });
    assert.equal(ticket.estado_pago, 'Aprobado');
  });
});
