
const mongoose = require('mongoose');

const portfolioSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
  },
  cash: {
    type: Number,
    default: 1000000,
    min: 0,
  },
  holdings: {
    type: Map,
    of: new mongoose.Schema({
      quantity: { type: Number, default: 0, min: 0 },
      averagePrice: { type: Number, default: 0, min: 0 },
    }, { _id: false }),
    default: {},
  },
}, { timestamps: true });

module.exports = mongoose.model('Portfolio', portfolioSchema);
