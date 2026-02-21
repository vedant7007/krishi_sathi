const mongoose = require('mongoose');

const weatherCacheSchema = new mongoose.Schema({
  location: {
    type: String,
    required: true,
    index: true,
  },
  lat: Number,
  lon: Number,
  current: {
    temp: Number,
    humidity: Number,
    windSpeed: Number,
    rainfall: Number,
    condition: String,
    icon: String,
    description: String,
  },
  forecast: [{
    date: Date,
    tempMax: Number,
    tempMin: Number,
    humidity: Number,
    windSpeed: Number,
    rainfall: Number,
    rainProbability: Number,
    condition: String,
    icon: String,
    description: String,
  }],
  fetchedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

weatherCacheSchema.index({ location: 1, fetchedAt: -1 });
weatherCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 10800 }); // 3h TTL

module.exports = mongoose.model('WeatherCache', weatherCacheSchema);
