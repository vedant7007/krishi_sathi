const mongoose = require('mongoose');

const cropRuleSchema = new mongoose.Schema({
  crop: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  soilType: {
    type: String,
    enum: ['black', 'red', 'alluvial', 'laterite', 'sandy', 'clay', 'loamy', 'any'],
    default: 'any',
  },
  season: {
    type: String,
    enum: ['kharif', 'rabi', 'zaid', 'any'],
    default: 'any',
  },
  region: {
    type: String,
    default: 'any',
  },
  fertilizer: {
    type: { type: String },
    quantity: String,
    schedule: String,
    notes: String,
  },
  irrigation: {
    method: String,
    frequency: String,
    waterPerAcre: String,
    notes: String,
  },
  pest: {
    commonPests: [String],
    prevention: String,
    treatment: String,
    spraySchedule: String,
  },
  sowing: {
    method: String,
    depth: String,
    spacing: String,
    bestTime: String,
    seedRate: String,
  },
  harvest: {
    timing: String,
    signs: String,
    method: String,
    yield: String,
  },
  msp: {
    price: Number,
    unit: { type: String, default: '₹/quintal' },
    year: String,
  },
}, {
  timestamps: true,
});

cropRuleSchema.index({ crop: 1, soilType: 1, season: 1 });

module.exports = mongoose.model('CropRule', cropRuleSchema);
