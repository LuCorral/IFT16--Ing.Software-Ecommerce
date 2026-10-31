const { DataTypes } = require('sequelize');
module.exports = {
  async up(queryInterface, transaction) {
    const columns = await queryInterface.describeTable('Users', { transaction });
    const additions = {
      sessionVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      resetTokenHash: { type: DataTypes.STRING, allowNull: true },
      resetTokenExpires: { type: DataTypes.DATE, allowNull: true },
    };
    for (const [name, definition] of Object.entries(additions)) {
      if (!columns[name]) await queryInterface.addColumn('Users', name, definition, { transaction });
    }
  },
};
