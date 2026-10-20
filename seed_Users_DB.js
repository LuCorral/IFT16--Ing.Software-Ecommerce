require('dotenv').config();

const sequelize = require('./src/config/database');
const { seedDemo } = require('./scripts/seed-demo');

seedDemo()
  .catch((error) => {
    console.error(`Demo user initialization failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
