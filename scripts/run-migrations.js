const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

require('../src/models');
const sequelize = require('../src/config/database');
const { initializeDatabase } = require('../src/config/migrations');

async function main() {
  const audit = process.env.DB_DEPLOY_AUDIT === '1';
  const { captureDatabaseState, verifyDatabaseState } = require('./database-deployment-audit');
  const before = audit ? await captureDatabaseState(sequelize) : null;
  if (audit) console.info('Database audit before migrations:', JSON.stringify(before));
  await initializeDatabase(sequelize);
  if (audit) {
    const after = await captureDatabaseState(sequelize);
    verifyDatabaseState(before, after);
    console.info('Database audit after migrations:', JSON.stringify(after));
    console.info('SQLite integrity and preserved row counts verified');
  }
}

main()
  .catch((error) => {
    console.error(`Database migration failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
