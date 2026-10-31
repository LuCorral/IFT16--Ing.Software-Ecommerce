const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface, transaction) {
    const columns = await queryInterface.describeTable('Users', { transaction });
    if (!columns.corporateEnabled) await queryInterface.addColumn('Users', 'corporateEnabled', {
      type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false,
    }, { transaction });
    if (!columns.corporateBalanceCents) await queryInterface.addColumn('Users', 'corporateBalanceCents', {
      type: DataTypes.BIGINT, allowNull: false, defaultValue: 0,
    }, { transaction });
    const tables = await queryInterface.showAllTables({ transaction });
    if (!tables.some((table) => (typeof table === 'string' ? table : table.tableName) === 'CorporateMovements')) {
      await queryInterface.createTable('CorporateMovements', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        userId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL' },
        adminId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL' },
        amountCents: { type: DataTypes.BIGINT, allowNull: false },
        balanceAfterCents: { type: DataTypes.BIGINT, allowNull: false },
        requestId: { type: DataTypes.STRING(64), allowNull: false, unique: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      }, { transaction });
    }
    const indexes = await queryInterface.showIndex('CorporateMovements', { transaction });
    if (!indexes.some((index) => index.name === 'corporate_movements_user_id_id')) {
      await queryInterface.addIndex('CorporateMovements', ['userId', 'id'], { name: 'corporate_movements_user_id_id', transaction });
    }
  },
};
