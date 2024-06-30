const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Cryptocurrency = require('./Cryptocurrency');

const ExchangeRate = sequelize.define('ExchangeRate', {
    fromCurrencyId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    toCurrencyId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    rate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    }
});

ExchangeRate.belongsTo(Cryptocurrency, { as: 'fromCurrency', foreignKey: 'fromCurrencyId' });
ExchangeRate.belongsTo(Cryptocurrency, { as: 'toCurrency', foreignKey: 'toCurrencyId' });

module.exports = ExchangeRate;