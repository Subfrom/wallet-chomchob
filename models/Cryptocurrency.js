const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Cryptocurrency = sequelize.define('Cryptocurrency', {
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    }
});

module.exports = Cryptocurrency;