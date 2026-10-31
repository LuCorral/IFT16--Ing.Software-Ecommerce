const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const sequelize = require("../config/database");

const User = sequelize.define("User", {
    corporateEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    corporateBalanceCents: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    sessionVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    resetTokenHash: { type: DataTypes.STRING, allowNull: true },
    resetTokenExpires: { type: DataTypes.DATE, allowNull: true },
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    apellido: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ""
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    telefono: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            is: /^[0-9]+$/i
        }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "client",
        validate: {
            isIn: [["admin", "client"]]
        }
    },
    carrito: {
        type: DataTypes.TEXT,
        allowNull: true
    }
});

// Antes de crear un usuario, hashea la contraseña
User.beforeCreate(async (user) => {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
});

// Antes de actualizar, solo vuelve a hashear si cambió la contraseña
User.beforeUpdate(async (user) => {
    if (user.changed("password")) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
    }
});

// Método para comparar contraseña ingresada vs contraseña guardada
User.prototype.comparePassword = function (plainPassword) {
    return bcrypt.compare(plainPassword, this.password);
};

module.exports = User;
