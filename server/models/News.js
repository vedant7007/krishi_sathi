const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  summary: String,
  category: {
    type: String,
    required: true,
    enum: ['weather', 'market', 'policy', 'technology', 'advisory', 'schemes'],
    index: true,
  },
  source: String,
  imageUrl: String,
  language: {
    type: String,
    enum: ['en', 'hi', 'te'],
    default: 'en',
  },
  isAiGenerated: {
    type: Boolean,
    default: false,
  },
  tags: [String],
  region: String,
  publishedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

newsSchema.index({ category: 1, publishedAt: -1 });
newsSchema.index({ language: 1 });

module.exports = mongoose.model('News', newsSchema);
