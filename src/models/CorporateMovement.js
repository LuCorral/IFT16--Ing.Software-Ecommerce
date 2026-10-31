const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

module.exports = sequelize.define('CorporateMovement', {
  userId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL' },
  adminId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL' },
  amountCents: { type: DataTypes.BIGINT, allowNull: false },
  balanceAfterCents: { type: DataTypes.BIGINT, allowNull: false },
  requestId: { type: DataTypes.STRING(64), allowNull: false, unique: true },
}, { indexes: [{ fields: ['userId', 'id'] }] });
