const { QueryTypes } = require('sequelize');
async function captureDatabaseState(db) {
  const checks = await db.query('PRAGMA quick_check', { type: QueryTypes.SELECT });
  if (checks.some((row) => Object.values(row)[0] !== 'ok')) throw new Error('SQLite integrity check failed');
  const tables = await db.getQueryInterface().showAllTables();
  const counts = {};
  for (const table of tables) {
    const name = typeof table === 'string' ? table : table.tableName;
    if (['SchemaMigrations', 'sqlite_sequence'].includes(name)) continue;
    const [row] = await db.query(`SELECT COUNT(*) AS total FROM "${name.replace(/"/g, '""')}"`, { type: QueryTypes.SELECT });
    counts[name] = Number(row.total);
  }
  return counts;
}
function verifyDatabaseState(before, after) {
  for (const [table, count] of Object.entries(before)) {
    if (!Object.hasOwn(after, table) || after[table] < count) throw new Error(`Migration audit failed: row count decreased in ${table}`);
  }
}
module.exports = { captureDatabaseState, verifyDatabaseState };
