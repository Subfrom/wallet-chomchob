const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');
const Cryptocurrency = require('./Cryptocurrency');

const Wallet = sequelize.define('Wallet', {
    balance: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
    }
});

Wallet.belongsTo(User);
Wallet.belongsTo(Cryptocurrency);

module.exports = Wallet;