const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  type: {
    type: String,
    enum: ['weather_alert', 'price_alert', 'scheme_update', 'emergency', 'crop_advisory', 'general'],
    required: [true, 'Notification type is required'],
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  read: {
    type: Boolean,
    default: false,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  },
}, {
  timestamps: true,
});

// Compound index for efficient querying of user notifications
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

// TTL index - MongoDB will automatically delete documents when expiresAt is reached
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Notification', notificationSchema);
