const { DataTypes } = require('sequelize');
module.exports = {
  async up(qi, transaction) {
    const columns = await qi.describeTable('notificaciones_correo', { transaction });
    const fields = {
      eventKey: { type: DataTypes.STRING(64), allowNull: true },
      deliveryStatus: { type: DataTypes.STRING, allowNull: false, defaultValue: 'legado' },
      attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      lastError: { type: DataTypes.STRING, allowNull: true },
      previewUrl: { type: DataTypes.TEXT, allowNull: true },
      sentAt: { type: DataTypes.DATE, allowNull: true },
    };
    for (const [name, definition] of Object.entries(fields)) if (!columns[name]) await qi.addColumn('notificaciones_correo', name, definition, { transaction });
    const indexes = await qi.showIndex('notificaciones_correo', { transaction });
    if (!indexes.some((i) => i.name === 'mail_event_unique')) await qi.addIndex('notificaciones_correo', ['eventKey'], { unique: true, name: 'mail_event_unique', transaction });
  },
};
