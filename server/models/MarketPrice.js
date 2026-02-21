const mongoose = require('mongoose');

const marketPriceSchema = new mongoose.Schema({
  crop: {
    type: String,
    required: true,
    index: true,
  },
  mandi: {
    type: String,
    required: true,
  },
  state: String,
  district: String,
  price: {
    type: Number,
    required: true,
  },
  minPrice: Number,
  maxPrice: Number,
  unit: {
    type: String,
    default: '₹/quintal',
  },
  date: {
    type: Date,
    required: true,
    index: true,
  },
  source: {
    type: String,
    default: 'agmarknet',
  },
}, {
  timestamps: true,
});

marketPriceSchema.index({ crop: 1, mandi: 1, date: -1 });
marketPriceSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 }); // 24h TTL

module.exports = mongoose.model('MarketPrice', marketPriceSchema);
