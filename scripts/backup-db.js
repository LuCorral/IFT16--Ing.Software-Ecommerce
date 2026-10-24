const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const projectRoot = path.resolve(__dirname, '..');
const { backupDatabase: createSqliteBackup } = require('../src/utils/sqliteBackup');

function backupDatabase(configuredStorage = process.env.DB_STORAGE) {
  if (!configuredStorage) {
    throw new Error('Set DB_STORAGE to the SQLite database path before creating a backup.');
  }
  return createSqliteBackup(path.resolve(projectRoot, configuredStorage));
}

if (require.main === module) {
  backupDatabase()
    .then((backupPath) => console.info(`SQLite backup created: ${backupPath}`))
    .catch((error) => {
      console.error(`SQLite backup failed: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = { backupDatabase };
