const mongoose = require('mongoose');

const governmentSchemeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    index: true,
  },
  shortName: String,
  description: String,
  benefits: String,
  eligibility: {
    landHoldingMax: Number, // acres
    landHoldingMin: Number,
    crops: [String],
    states: [String],
    categories: [String], // ['small', 'marginal', 'all']
  },
  documents: [String],
  applicationUrl: String,
  deadline: Date,
  status: {
    type: String,
    enum: ['active', 'closed', 'upcoming'],
    default: 'active',
  },
  ministry: String,
  category: {
    type: String,
    enum: ['subsidy', 'insurance', 'credit', 'irrigation', 'marketing', 'training', 'other'],
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('GovernmentScheme', governmentSchemeSchema);
