const { DataTypes } = require('sequelize');
const NotificacionCorreo = require('../models/NotificacionCorreo');

const indexName = 'notificaciones_correo_pedido_idx';

module.exports = {
  async up(queryInterface, transaction) {
    const tableName = NotificacionCorreo.getTableName();
    const tables = await queryInterface.showAllTables({ transaction });
    const existingTables = tables.map((table) => (
      typeof table === 'string' ? table : table.tableName
    ));

    if (!existingTables.includes(tableName)) {
      await queryInterface.createTable(tableName, {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        pedido_id: { type: DataTypes.INTEGER, allowNull: false },
        destinatario: { type: DataTypes.STRING, allowNull: false },
        asunto: { type: DataTypes.STRING, allowNull: false },
        cuerpo: { type: DataTypes.TEXT, allowNull: false },
        estado_pedido: { type: DataTypes.STRING, allowNull: false },
        fecha: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      }, { transaction });
    }

    const indexes = await queryInterface.showIndex(tableName, { transaction });
    if (!indexes.some((index) => index.name === indexName)) {
      await queryInterface.addIndex(tableName, ['pedido_id'], {
        name: indexName,
        transaction,
      });
    }
  },
};
