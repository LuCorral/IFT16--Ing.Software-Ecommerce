const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Pedido = sequelize.define('Pedido', {
  creditUsedCents: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
  checkoutRequestId: { type: DataTypes.STRING(64), allowNull: true, unique: true },
  checkoutFingerprint: { type: DataTypes.STRING(64), allowNull: true },
  cliente: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fecha: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  estado: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pendiente'
  },
  total: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0
  },
  subtotal: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0
  },
  descuento: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0
  },
  cuponCodigo: {
    type: DataTypes.STRING,
    allowNull: true
  }
});

module.exports = Pedido;
