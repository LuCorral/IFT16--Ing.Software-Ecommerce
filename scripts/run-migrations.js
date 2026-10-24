const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

require('../src/models');
const sequelize = require('../src/config/database');
const { initializeDatabase } = require('../src/config/migrations');

async function main() {
  await initializeDatabase(sequelize);
}

main()
  .catch((error) => {
    console.error(`Database migration failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
