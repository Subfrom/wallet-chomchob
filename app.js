const express = require('express');
const bodyParser = require('body-parser');
const sequelize = require('./config/database');
const User = require('./models/User');
const Cryptocurrency = require('./models/Cryptocurrency');
const Wallet = require('./models/Wallet');
const ExchangeRate = require('./models/ExchangeRate');

const app = express();
app.use(bodyParser.json());

app.post('/admin/cryptocurrency', async (req, res) => {
    const { name } = req.body;
    const cryptocurrency = await Cryptocurrency.create({ name });
    res.json(cryptocurrency);
});

app.post('/admin/exchange-rate', async (req, res) => {
    const { fromCurrencyId, toCurrencyId, rate } = req.body;
    const exchangeRate = await ExchangeRate.create({ fromCurrencyId, toCurrencyId, rate });
    res.json(exchangeRate);
});

app.post('/admin/wallet', async (req, res) => {
    const { UserId, CryptocurrencyId, amount } = req.body;
    let wallet = await Wallet.findOne({ where: { UserId, CryptocurrencyId } });
    let user = await User.findOne({ where: { id: UserId } });
    let cryptocurrency = await Cryptocurrency.findOne({ where: { id: CryptocurrencyId } });
    if (!user || !cryptocurrency)
        {
            return res.status(400).json({ error: 'User or cryptocurrency not found' });    
        }
    if (!wallet) 
    {
        wallet = await Wallet.create({ UserId, CryptocurrencyId, balance: 0 });
    }
    
    wallet.balance += parseFloat(amount);
    await wallet.save();
    res.json(wallet);
});

app.post('/user/transfer', async (req, res) => {
    const { fromUserId, toUserId, fromCurrencyId, amount, toCurrencyId } = req.body;
    const fromWallet = await Wallet.findOne({ where: { userId: fromUserId, cryptocurrencyId: fromCurrencyId } });
    if (!fromWallet || fromWallet.balance < amount) 
    {
        return res.status(400).json({ error: 'Insufficient balance' });
    }

    let toWallet = await Wallet.findOne({ where: { userId: toUserId, cryptocurrencyId: toCurrencyId} });
    if (!toWallet)
    {
        toWallet = await Wallet.create({ userId: toUserId, cryptocurrencyId: toCurrencyId, balance: 0 });
    }

    let finalAmount = amount;
    if (fromCurrencyId !== toCurrencyId)
    {
        const exchangeRate = await ExchangeRate.findOne({ where: { fromCurrencyId, toCurrencyId } });
        if (!exchangeRate)
        {
            return res.status(400).json({ error: 'Exchange rate not found' });
        }
        finalAmount *= parseFloat(exchangeRate.rate);
    }

    fromWallet.balance -= parseFloat(amount);
    toWallet.balance += parseFloat(finalAmount);

    await fromWallet.save();
    await toWallet.save();

    res.json({ fromWallet, toWallet });
});

app.get('/admin/total-balance', async (req, res) => {
    const totalBalances = await Wallet.findAll({
        attributes: ['cryptocurrencyId', [sequelize.fn('sum', sequelize.col('balance')), 'totalBalance']],
        group: ['cryptocurrencyId']
    });
    res.json(totalBalances);
});

app.post('/admin/user', async (req, res) => {
    const { username } = req.body;
    const user = await User.create({ username });
    res.json(user);
});

const PORT = process.env.PORT || 3000;
sequelize.sync().then(() => {
    app.listen(PORT, () => {
        // URL-Based on the PORT
        console.log(`Server is running on http://localhost:${PORT}`);
    });
});
