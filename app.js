const express = require('express');
const bodyParser = require('body-parser');
const sequelize = require('./config/database');
const User = require('./models/User');
const Cryptocurrency = require('./models/Cryptocurrency');
const Wallet = require('./models/Wallet');
const ExchangeRate = require('./models/ExchangeRate');
const Decimal = require('decimal.js');

const app = express();
app.use(bodyParser.json());

app.post('/admin/cryptocurrency', async (req, res) => {
    const { name } = req.body;
    const existingCryptocurrency = await Cryptocurrency.findOne({ where: { name } });
    if (existingCryptocurrency) {
        return res.status(400).json({ error: 'Cryptocurrency already exists' });
    }
    try {
        const cryptocurrency = await Cryptocurrency.create({ name });
        res.json(cryptocurrency);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/admin/exchange-rate', async (req, res) => {
    const { fromCurrencyId, toCurrencyId, rate } = req.body;

    if (!fromCurrencyId || !toCurrencyId || !rate) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    if (rate <= 0) {
        return res.status(400).json({ error: 'Rate must be a positive number' });
    }
    if (fromCurrencyId === toCurrencyId) {
        return res.status(400).json({ error: 'From and To currencies must be different' });
    }

    try {
        const existingRate = await ExchangeRate.findOne({
            where: { fromCurrencyId, toCurrencyId }
        });
        if (existingRate) {
            return res.status(409).json({ error: 'Exchange rate already exists' });
        }

        const exchangeRate = await ExchangeRate.create({ fromCurrencyId, toCurrencyId, rate });
        res.json(exchangeRate);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while creating the exchange rate' });
    }
});

app.post('/admin/wallet', async (req, res) => {
    const { UserId, CryptocurrencyId, amount } = req.body;
    
    try {
        const walletAmount = parseFloat(amount);
        if (isNaN(walletAmount) || walletAmount <= 0) {
            return res.status(400).json({ error: 'Invalid wallet amount' });
        }

        const [user, cryptocurrency] = await Promise.all([
            User.findByPk(UserId),
            Cryptocurrency.findByPk(CryptocurrencyId)
        ]);

        if (!user || !cryptocurrency) {
            return res.status(404).json({ error: 'User or cryptocurrency not found' });
        }

        let wallet = await Wallet.findOne({ where: { UserId, CryptocurrencyId } });
        if (wallet) {
            // Use Decimal.js or similar for precise arithmetic, then format to 2 decimal places
            let newBalance = new Decimal(wallet.balance).plus(walletAmount).toFixed(2);
            wallet.balance = parseFloat(newBalance); // Ensure the balance is a number
            await wallet.save();

            return res.json(wallet);
        }

        wallet = await Wallet.create({ UserId, CryptocurrencyId, balance: walletAmount.toFixed(2) });

        res.json(wallet);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while creating the wallet' });
    }
});

app.post('/user/transfer', async (req, res) => {
    const { fromUserId, toUserId, fromCurrencyId, toCurrencyId, amount } = req.body;

    try {
        // Validate users and their balances
        const fromUserWallet = await Wallet.findOne({ where: { UserId: fromUserId, CryptocurrencyId: fromCurrencyId } });
        const toUserWallet = await Wallet.findOne({ where: { UserId: toUserId, CryptocurrencyId: toCurrencyId } });
        if (!fromUserWallet || new Decimal(fromUserWallet.balance).lessThan(amount)) {
            return res.status(400).json({ error: 'Insufficient balance or user not found' });
        }

        // Get exchange rate
        const exchangeRate = await ExchangeRate.findOne({ where: { fromCurrencyId, toCurrencyId } });
        if (!exchangeRate) {
            return res.status(404).json({ error: 'Exchange rate not found' });
        }

        // Calculate the amount to be received using the exchange rate
        const receivedAmount = new Decimal(amount).mul(exchangeRate.rate).toFixed(2);

        // Update balances atomically
        await sequelize.transaction(async (t) => {
            await Wallet.update(
                { balance: sequelize.literal(`balance - ${amount}`) },
                { where: { UserId: fromUserId, CryptocurrencyId: fromCurrencyId } },
                { transaction: t }
            );

            if (toUserWallet) {
                await Wallet.update(
                    { balance: sequelize.literal(`balance + ${receivedAmount}`) },
                    { where: { UserId: toUserId, CryptocurrencyId: toCurrencyId } },
                    { transaction: t }
                );
            } else {
                // If the receiver doesn't have a wallet for the currency, create one
                await Wallet.create(
                    { UserId: toUserId, CryptocurrencyId: toCurrencyId, balance: receivedAmount },
                    { transaction: t }
                );
            }
        });

        res.json({ message: 'Transfer successful', receivedAmount });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred during the transfer' });
    }
});

app.get('/admin/total-balance', async (req, res) => {
    try {

        const totalBalances = await Wallet.findAll({
            attributes: [
                'cryptocurrencyId',
                [sequelize.fn('sum', sequelize.col('balance')), 'totalBalance']
            ],
            group: 'cryptocurrencyId',
            raw: true
        });

        const enhancedBalances = await Promise.all(totalBalances.map(async (balance) => {
            const cryptocurrency = await Cryptocurrency.findByPk(balance.cryptocurrencyId);
            return {
                cryptocurrency: cryptocurrency ? cryptocurrency.name : 'Unknown',
                totalBalance: balance.totalBalance
            };
        }));

        res.json(enhancedBalances);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while fetching total balances' });
    }
});

app.post('/admin/user', async (req, res) => {
    const { username } = req.body;

    if (!username || typeof username !== 'string' || username.trim().length === 0) {
        return res.status(400).json({ error: 'Invalid or missing username' });
    }

    try {
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        const user = await User.create({ username: username.trim() });
        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while creating the user' });
    }
});

const PORT = process.env.PORT || 3000;
sequelize.sync().then(() => {
    app.listen(PORT, () => {
        // URL-Based on the PORT
        console.log(`Server is running on http://localhost:${PORT}`);
    });
});
