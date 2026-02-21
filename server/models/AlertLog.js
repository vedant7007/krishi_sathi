const mongoose = require('mongoose');

const alertLogSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['cyclone', 'flood', 'frost', 'heatwave', 'pest_outbreak', 'drought', 'heavy_rain', 'other'],
  },
  severity: {
    type: String,
    required: true,
    enum: ['CRITICAL', 'WARNING', 'INFO'],
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  affectedDistricts: [String],
  affectedStates: [String],
  affectedCrops: [String],
  channels: {
    sms: { type: Boolean, default: true },
    whatsapp: { type: Boolean, default: false },
    voice: { type: Boolean, default: false },
  },
  recipientCount: {
    type: Number,
    default: 0,
  },
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'sending', 'sent', 'failed'],
    default: 'pending',
  },
}, {
  timestamps: true,
});

alertLogSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('AlertLog', alertLogSchema);
