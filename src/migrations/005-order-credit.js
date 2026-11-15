const { DataTypes } = require('sequelize');
module.exports = {
  async up(qi, transaction) {
    const columns = await qi.describeTable('Pedidos', { transaction });
    const fields = {
      creditUsedCents: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
      checkoutRequestId: { type: DataTypes.STRING(64), allowNull: true },
      checkoutFingerprint: { type: DataTypes.STRING(64), allowNull: true },
    };
    for (const [name, definition] of Object.entries(fields)) if (!columns[name]) await qi.addColumn('Pedidos', name, definition, { transaction });
    const indexes = await qi.showIndex('Pedidos', { transaction });
    if (!indexes.some((i) => i.name === 'order_checkout_request_unique')) await qi.addIndex('Pedidos', ['checkoutRequestId'], { unique: true, name: 'order_checkout_request_unique', transaction });
  },
};
