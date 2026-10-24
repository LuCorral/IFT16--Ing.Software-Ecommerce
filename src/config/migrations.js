const fs = require('node:fs');
const path = require('node:path');
const { DataTypes } = require('sequelize');
const { backupDatabase } = require('../utils/sqliteBackup');

const migrationsDirectory = path.resolve(__dirname, '../migrations');
const metadataTable = 'SchemaMigrations';

function migrationFiles() {
  return fs.readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith('.js'))
    .sort();
}

async function getPendingMigrations(sequelize) {
  if (!fs.existsSync(sequelize.options.storage)) return migrationFiles();

  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();
  const tableNames = tables.map((table) => (
    typeof table === 'string' ? table : table.tableName
  ));
  const files = migrationFiles();
  if (!tableNames.includes(metadataTable)) return files;

  const [applied] = await sequelize.query(
    `SELECT name FROM "${metadataTable}"`,
  );
  const appliedNames = new Set(applied.map((migration) => migration.name));
  return files.filter((file) => !appliedNames.has(file));
}

async function runMigrations(sequelize, pending = null) {
  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();
  const tableNames = tables.map((table) => (
    typeof table === 'string' ? table : table.tableName
  ));

  if (!tableNames.includes(metadataTable)) {
    await queryInterface.createTable(metadataTable, {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
      },
      executedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });
  }

  for (const file of pending || await getPendingMigrations(sequelize)) {
    const migration = require(path.join(migrationsDirectory, file));
    await sequelize.transaction(async (transaction) => {
      const [alreadyApplied] = await sequelize.query(
        `SELECT name FROM "${metadataTable}" WHERE name = :name`,
        { replacements: { name: file }, transaction },
      );
      if (alreadyApplied.length > 0) return;

      await migration.up(queryInterface, transaction);
      await queryInterface.bulkInsert(metadataTable, [{
        name: file,
        executedAt: new Date(),
      }], { transaction });
    });
    console.info(`Applied database migration: ${file}`);
  }
}

async function initializeDatabase(sequelize) {
  const pending = await getPendingMigrations(sequelize);
  if (pending.length > 0 && fs.existsSync(sequelize.options.storage)) {
    const backupPath = await backupDatabase(sequelize.options.storage);
    console.info(`Database backup created before pending migrations: ${path.basename(backupPath)}`);
  }

  await sequelize.sync();
  await runMigrations(sequelize, pending);
}

module.exports = { getPendingMigrations, initializeDatabase, runMigrations };
