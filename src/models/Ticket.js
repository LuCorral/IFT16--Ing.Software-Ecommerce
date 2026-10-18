const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Ticket = sequelize.define('Ticket', {
  id_pedido: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  fecha_emision: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  tipo_factura: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Comprobante no fiscal'
  },
  total: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0
  },
  CAE: {
    type: DataTypes.STRING,
    allowNull: true
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
  },
  cliente: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: ''
  },
  detalles: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '[]'
  },
  metodo_pago: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Tarjeta'
  },
  estado_pago: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Aprobado'
  }
});

module.exports = Ticket;