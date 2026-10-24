const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

require('../src/models');
const sequelize = require('../src/config/database');
const { initializeDatabase } = require('../src/config/migrations');
const User = require('../src/models/User');
const Producto = require('../src/models/Producto');
const demoProducts = require('../src/data/demo-products.json');
const { col, fn, where } = require('sequelize');

function requiredCredentials() {
  const inputs = [
    { email: process.env.DEMO_ADMIN_EMAIL, password: process.env.DEMO_ADMIN_PASSWORD, role: 'admin' },
    { email: process.env.DEMO_CLIENT_EMAIL, password: process.env.DEMO_CLIENT_PASSWORD, role: 'client' },
  ];
  if (inputs.some(({ email, password }) => !email || !password || password.length < 12)) {
    throw new Error('Set both demo emails and passwords of at least 12 characters in the environment.');
  }
  const credentials = inputs.map((account) => ({
    ...account,
    email: account.email.trim().toLowerCase(),
  }));
  if (credentials.some(({ email }) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error('Set valid email addresses for both demo accounts.');
  }
  if (credentials[0].email.trim().toLowerCase() === credentials[1].email.trim().toLowerCase()) {
    throw new Error('Demo administrator and client must use different email addresses.');
  }
  return credentials;
}

async function seedDemo() {
  const credentials = requiredCredentials();
  await initializeDatabase(sequelize);

  await sequelize.transaction(async (transaction) => {
    for (const account of credentials) {
      const { email } = account;
      const existing = await User.findOne({
        where: where(fn('lower', col('email')), email),
        transaction,
      });
      if (existing) {
        if (existing.role !== account.role) {
          throw new Error(`Existing demo account has an incompatible role: ${account.role}.`);
        }
        continue;
      }

      await User.create({
        name: account.role === 'admin' ? 'Demo' : 'Cliente Demo',
        apellido: account.role === 'admin' ? 'Administrador' : 'Ecommerce',
        email,
        password: account.password,
        role: account.role,
      }, { transaction });
    }

    for (const product of demoProducts) {
      await Producto.findOrCreate({
        where: { nombre: product.nombre },
        defaults: {
          nombre: product.nombre,
          precio: product.precio,
          stock: 20,
          categoria: product.categoria,
          descripcion: product.descripcion,
          image: product.image,
          rating: product.rating,
          reviews: product.reviews,
          validFrom: new Date('2020-01-01T00:00:00.000Z'),
          validTo: new Date('2099-12-31T00:00:00.000Z'),
        },
        transaction,
      });
    }
  });

  console.info(`Demo data ready: 2 accounts and ${demoProducts.length} catalog items; existing records were preserved.`);
}

if (require.main === module) {
  seedDemo()
    .catch((error) => {
      console.error(`Demo data initialization failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close());
}

module.exports = { seedDemo };
