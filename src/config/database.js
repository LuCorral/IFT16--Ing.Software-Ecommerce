const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('node:fs');

require('dotenv').config({
 path: path.resolve(__dirname, '../../.env'),
});

const storagePath = path.resolve(
 __dirname,
 '../..',
 process.env.DB_STORAGE || './ecommerce.sqlite',
);
fs.mkdirSync(path.dirname(storagePath), { recursive: true });

const sequelize = new Sequelize({
 dialect: process.env.DB_DIALECT || 'sqlite',
 storage: storagePath,
 logging: false
});

module.exports = sequelize;
