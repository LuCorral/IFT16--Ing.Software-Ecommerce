const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NotificacionCorreo = sequelize.define(
  'NotificacionCorreo',
  {
    eventKey: { type: DataTypes.STRING(64), allowNull: true, unique: true },
    deliveryStatus: { type: DataTypes.STRING, allowNull: false, defaultValue: 'legado' },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lastError: { type: DataTypes.STRING, allowNull: true },
    previewUrl: { type: DataTypes.TEXT, allowNull: true },
    sentAt: { type: DataTypes.DATE, allowNull: true },
    pedido_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    destinatario: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    asunto: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    cuerpo: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    estado_pedido: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    fecha: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'notificaciones_correo',
    timestamps: false,
    indexes: [
      {
        name: 'notificaciones_correo_pedido_idx',
        fields: ['pedido_id'],
      },
    ],
  },
);

module.exports = NotificacionCorreo;
