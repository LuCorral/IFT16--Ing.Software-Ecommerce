// Explicitly restricted to the disposable manual demo, never a configured database.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const target = path.resolve(process.argv[2] || '.');
const parent = path.dirname(target);
if (path.dirname(parent).toLowerCase() !== path.resolve(os.tmpdir()).toLowerCase() || !/^ecommerce-manual-[a-z0-9]+$/i.test(path.basename(parent)) || path.basename(target) !== 'demo.sqlite' || !fs.existsSync(target)) throw new Error('Se requiere la demo temporal existente ecommerce-manual-*/demo.sqlite');
Object.assign(process.env, { DB_STORAGE: target, DB_DIALECT: 'sqlite', NODE_ENV: 'test', SMTP_HOST: '' });
const db = require('../src/config/database');
const { User, Producto, Pedido, DetallePedido, Pago, CorporateMovement, NotificacionCorreo } = require('../src/models');
(async () => {
  try {
    if (db.options.storage !== target) throw new Error('Base inesperada');
    const products = await Producto.findAll({ attributes: ['id', 'nombre', 'precio', 'stock', 'categoria'], raw: true });
    const orders = await Pedido.findAll({ attributes: ['id', 'estado', 'total', 'creditUsedCents', 'createdAt'], raw: true });
    if (!process.argv.includes('--apply')) {
      console.log(JSON.stringify({ products, orders, users: await User.count(), movements: await CorporateMovement.count(), notifications: await NotificacionCorreo.count() }, null, 2));
      return;
    }
    const before = { users: await User.count(), movements: await CorporateMovement.count(), notifications: await NotificacionCorreo.count() };
    // Run the original seed unchanged, with an explicit temporary database in the child.
    const seeded = spawnSync(process.execPath, ['seed_DB.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, DB_STORAGE: target, DB_DIALECT: 'sqlite' }, encoding: 'utf8' });
    if (seeded.status !== 0) throw new Error('Falló el seed original: ' + seeded.stderr);
    const artificial = products.filter((p) => p.categoria === 'Demostración');
    const aro = await Producto.findOne({ where: { nombre: 'Aro de luz LED de escritorio con trípode' } });
    if (!aro) throw new Error('No se cargó el catálogo original');
    const changes = [];
    await db.transaction(async (transaction) => {
      for (const old of artificial) {
        const details = await DetallePedido.findAll({ where: { productoId: old.id }, transaction });
        for (const detail of details) {
          const order = await Pedido.findByPk(detail.pedidoId, { transaction });
          const payment = await Pago.findOne({ where: { pedidoId: order.id }, transaction });
          if (!payment?.metodo.includes('fixture') && ![4, 5].includes(order.id)) throw new Error('Hay compras manuales con productos artificiales: requieren revisión antes de sustituirlos');
          if (Number(order.creditUsedCents) !== 0) throw new Error('No se modifican pedidos con crédito utilizado');
          const subtotal = aro.precio * detail.cantidad;
          await detail.update({ productoId: aro.id, nombreProducto: aro.nombre, precioUnitario: aro.precio, subtotal }, { transaction });
          const lines = await DetallePedido.findAll({ where: { pedidoId: order.id }, transaction });
          const total = lines.reduce((sum, line) => sum + Number(line.subtotal), 0);
          await order.update({ total, subtotal: total, descuento: 0, cuponCodigo: null }, { transaction, silent: true });
          if (payment) await payment.update({ monto: total }, { transaction });
          changes.push({ order: order.id, product: aro.nombre, quantity: detail.cantidad, total });
        }
        await Producto.destroy({ where: { id: old.id }, transaction });
      }
      // Only local stock fixtures; names, prices, images and categories stay as in seed_DB.js.
      for (const [name, stock] of [['Aspiradora robot Wi-Fi', 3], ["Smart TV 43' Full HD Android", 5], ['Tablet Lenovo Tab M10 Plus 10.6 Fhd', 0]]) {
        const product = await Producto.findOne({ where: { nombre: name }, transaction });
        if (!product) throw new Error('Falta producto original: ' + name);
        await product.update({ stock }, { transaction });
      }
    });
    const after = { users: await User.count(), movements: await CorporateMovement.count(), notifications: await NotificacionCorreo.count() };
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Cambió un contador protegido');
    console.log(JSON.stringify({ products: await Producto.count(), preserved: after, fixtureChanges: changes, categories: [...new Set((await Producto.findAll({ attributes: ['categoria'], raw: true })).map((p) => p.categoria))] }, null, 2));
  } finally { await db.close(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
