const Pedido = require('../models/Pedido');

module.exports = {
  async up(queryInterface, transaction) {
    const tableName = Pedido.getTableName();
    const indexes = await queryInterface.showIndex(tableName, { transaction });
    if (indexes.some((index) => index.name === 'pedidos_cliente_idx')) return;

    await queryInterface.addIndex(tableName, ['cliente'], {
      name: 'pedidos_cliente_idx',
      transaction,
    });
  },
};
