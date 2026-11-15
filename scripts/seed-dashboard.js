const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('../src/models');
const { Op } = require('sequelize');
const { initializeDatabase } = require('../src/config/migrations');
const sequelize = require('../src/config/database');
const { User, Producto, Pedido, DetallePedido, Pago } = require('../src/models');

const PASSWORD = 'Dashboard2026!';
const CLIENTS = [
  { name: 'Clara', apellido: 'Mendez', email: 'clara.mendez@demoecommerce.com' },
  { name: 'Tomas', apellido: 'Rios', email: 'tomas.rios@demoecommerce.com' },
  { name: 'Valeria', apellido: 'Soto', email: 'valeria.soto@demoecommerce.com' },
  { name: 'Nicolas', apellido: 'Paz', email: 'nicolas.paz@demoecommerce.com' },
  { name: 'Julieta', apellido: 'Luna', email: 'julieta.luna@demoecommerce.com' },
];
const STATES = ['Pendiente', 'Pagado', 'Enviado', 'Entregado', 'Cancelado'];
const PAID_STATES = ['Pagado', 'Enviado', 'Entregado'];

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

async function main() {
  await initializeDatabase(sequelize);

  const products = await Producto.findAll();
  if (products.length === 0) throw new Error('No hay productos; ejecutá seed_DB.js primero');

  // Crear/obtener usuarios demo (sin modificar existentes)
  const users = [];
  const userReport = [];
  for (const client of CLIENTS) {
    let user = await User.findOne({ where: { email: client.email } });
    let created = false;
    if (!user) {
      user = await User.create({ name: client.name, apellido: client.apellido, email: client.email, password: PASSWORD, role: 'client' });
      created = true;
    }
    users.push(user);
    userReport.push({ email: client.email, password: created ? PASSWORD : '(ya existía; no se modificó)', created });
  }

  // Limpiar pedidos demo previos (y restituir stock)
  for (const user of users) {
    const oldOrders = await Pedido.findAll({ where: { cliente: { [Op.like]: `demo-user:${user.id}:%` } } });
    for (const order of oldOrders) {
      const details = await DetallePedido.findAll({ where: { pedidoId: order.id } });
      if (order.estado !== 'Cancelado') {
        for (const d of details) {
          const product = products.find((p) => p.id === d.productoId);
          if (product) await product.update({ stock: product.stock + d.cantidad });
        }
      }
      await Pago.destroy({ where: { pedidoId: order.id } });
      await DetallePedido.destroy({ where: { pedidoId: order.id } });
      await order.destroy();
    }
  }

  // Generar pedidos aleatorios
  // Asegurar que todos los estados aparezcan al menos una vez
  const statePool = [...STATES, ...Array.from({ length: 15 }, () => pick(STATES))];

  let totalOrders = 0;
  for (const user of users) {
    const ordersForUser = rnd(3, 5);
    for (let o = 0; o < ordersForUser; o++) {
      const state = statePool.length ? statePool.pop() : pick(STATES);

      // 1 o 2 productos distintos por pedido
      const numItems = rnd(1, 2);
      const chosenProducts = shuffle(products).slice(0, numItems);

      const items = [];
      let total = 0;
      for (const product of chosenProducts) {
        const maxQty = Math.min(4, Math.max(1, product.stock));
        if (maxQty < 1) continue;
        const qty = rnd(1, maxQty);
        const subtotal = product.precio * qty;
        items.push({ product, qty, subtotal });
        total += subtotal;
      }
      if (items.length === 0) continue;

      const day = String(rnd(1, 28)).padStart(2, '0');
      const hour = String(rnd(9, 20)).padStart(2, '0');
      const minute = String(rnd(0, 59)).padStart(2, '0');
      const date = new Date(`2026-11-${day}T${hour}:${minute}:00Z`);

      const order = await Pedido.create({
        cliente: `demo-user:${user.id}:${user.email}`,
        estado: state,
        total,
        subtotal: total,
        descuento: 0,
        fecha: date.toISOString().slice(0, 10),
        createdAt: date,
        updatedAt: date,
        creditUsedCents: 0,
      });

      for (const item of items) {
        await DetallePedido.create({
          pedidoId: order.id,
          productoId: item.product.id,
          nombreProducto: item.product.nombre,
          cantidad: item.qty,
          precioUnitario: item.product.precio,
          subtotal: item.subtotal,
        });
        if (state !== 'Cancelado') {
          await item.product.update({ stock: item.product.stock - item.qty });
        }
      }

      if (PAID_STATES.includes(state)) {
        await Pago.create({ pedidoId: order.id, monto: total, metodo: pick(['Tarjeta', 'Transferencia']), estado: 'Aprobado', fecha: date });
      }

      totalOrders++;
    }
  }

  console.log('Credenciales / estado:');
  console.table(userReport);
  console.log(`Pedidos generados: ${totalOrders}`);
  console.log('Seed de dashboard (aleatorio) completado.');
  await sequelize.close();
}

main().catch(async (e) => { console.error(e); await sequelize.close(); process.exit(1); });