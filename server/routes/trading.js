
const router = require('express').Router();
const mongoose = require('mongoose');

const Portfolio = require('../models/Portfolio');
const Order = require('../models/Order');
const authenticate = require('../middleware/auth');

const PRICES = {
  RELIANCE: 1420,
  TCS: 3250,
  INFY: 1580,
  AAPL: 18500,
  BTC: 5800000,
  ETH: 245000,
  'USD/INR': 83.5,
  'EUR/INR': 90.2,
  GOLD: 7200,
  SILVER: 88,
};

async function getPortfolio(userId) {
  let portfolio = await Portfolio.findOne({ userId });

  if (!portfolio) {
    portfolio = await Portfolio.create({
      userId,
      cash: 1000000,
      holdings: {},
    });
  }

  return portfolio;
}

router.use(authenticate);

// Get portfolio
router.get('/portfolio', async (req, res) => {
  try {
    const portfolio = await getPortfolio(req.userId);

    res.json({
      cash: portfolio.cash,
      holdings: portfolio.holdings instanceof Map
        ? Object.fromEntries(portfolio.holdings)
        : portfolio.holdings || {},
    });
  } catch (error) {
    console.error('Portfolio error:', error);
    res.status(500).json({ message: 'Unable to load portfolio.' });
  }
});

// Get order history
router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json(orders.map(order => ({
      id: String(order._id),
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      price: order.price,
      total: order.total,
      time: order.createdAt,
    })));
  } catch (error) {
    console.error('Orders error:', error);
    res.status(500).json({ message: 'Unable to load orders.' });
  }
});

// Buy or sell
router.post('/order', async (req, res) => {
  try {
    const symbol = String(req.body.symbol || '').toUpperCase();
    const side = String(req.body.side || '').toUpperCase();
    const quantity = Number(req.body.quantity);
    const price = PRICES[symbol];

    if (!price || !['BUY', 'SELL'].includes(side)) {
      return res.status(400).json({
        message: 'Invalid asset or order side.',
      });
    }

    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1e9) {
      return res.status(400).json({
        message: 'Enter a valid quantity greater than zero.',
      });
    }

    const total = price * quantity;

    if (!Number.isFinite(total)) {
      return res.status(400).json({
        message: 'Invalid order value.',
      });
    }

    const portfolio = await getPortfolio(req.userId);

    const holdings = portfolio.holdings instanceof Map
      ? Object.fromEntries(portfolio.holdings)
      : { ...(portfolio.holdings || {}) };

    const current = holdings[symbol] || {
      quantity: 0,
      averagePrice: 0,
    };

    const currentQuantity = Number(current.quantity) || 0;
    const currentAverage = Number(current.averagePrice) || 0;

    if (side === 'BUY') {
      if (total > portfolio.cash) {
        return res.status(400).json({
          message: 'Not enough virtual cash.',
        });
      }

      const newQuantity = currentQuantity + quantity;

      holdings[symbol] = {
        quantity: newQuantity,
        averagePrice:
          ((currentQuantity * currentAverage) + total) / newQuantity,
      };

      portfolio.cash -= total;
    } else {
      if (quantity > currentQuantity) {
        return res.status(400).json({
          message: 'Not enough units to sell.',
        });
      }

      const remaining = currentQuantity - quantity;

      if (remaining <= 0.00000001) {
        delete holdings[symbol];
      } else {
        holdings[symbol] = {
          quantity: remaining,
          averagePrice: currentAverage,
        };
      }

      portfolio.cash += total;
    }

    portfolio.holdings = holdings;
    await portfolio.save();

    const order = await Order.create({
      userId: req.userId,
      symbol,
      side,
      quantity,
      price,
      total,
    });

    console.log(`${side} ${quantity} ${symbol}: ₹${total}`);

    return res.status(201).json({
      message: `${side} order completed successfully.`,
      cash: portfolio.cash,
      holdings,
      order: {
        id: String(order._id),
        symbol,
        side,
        quantity,
        price,
        total,
        time: order.createdAt,
      },
    });
  } catch (error) {
    console.error('Trade error:', error);

    return res.status(500).json({
      message: 'Trade failed. Check the backend terminal for details.',
    });
  }
});

module.exports = router;
