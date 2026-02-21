const mongoose = require('mongoose');

const newsCacheSchema = new mongoose.Schema({
  cacheKey: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  articles: [{
    title: String,
    content: String,
    summary: String,
    category: String,
    source: String,
    language: String,
    isAiGenerated: Boolean,
    publishedAt: Date,
  }],
  fetchedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

newsCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 21600 }); // 6h TTL

module.exports = mongoose.model('NewsCache', newsCacheSchema);
