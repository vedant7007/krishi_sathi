const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: 100,
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian phone number'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false,
  },
  aadhaarNumber: {
    type: String,
    match: [/^\d{12}$/, 'Aadhaar number must be exactly 12 digits'],
  },
  role: {
    type: String,
    enum: ['farmer', 'admin'],
    default: 'farmer',
  },
  district: { type: String, trim: true },
  state: { type: String, trim: true },
  location: {
    lat: { type: Number },
    lon: { type: Number },
    address: { type: String },
  },
  primaryCrop: {
    type: String,
    enum: [
      'cotton', 'rice', 'wheat', 'maize', 'tomato', 'groundnut', 'soybean',
      'sugarcane', 'onion', 'chilli', 'potato', 'mustard', 'jowar', 'bajra',
      'ragi', 'turmeric', 'ginger', 'garlic', 'brinjal', 'cabbage',
      'cauliflower', 'peas', 'lentil', 'chickpea', 'pigeon_pea', 'green_gram',
      'black_gram', 'sesame', 'sunflower', 'jute', 'tea', 'coffee', 'coconut',
      'banana', 'mango', 'papaya', 'guava', 'pomegranate', 'grape', 'watermelon',
    ],
  },
  soilType: {
    type: String,
    enum: ['black', 'red', 'alluvial', 'laterite', 'sandy', 'clay', 'loamy', 'saline', 'peaty', 'forest', 'mountainous'],
  },
  landHolding: { type: Number, min: 0 },
  faceImage: {
    type: String,
  },
  faceEncoding: {
    type: [Number],
    select: false,
  },
  webauthnCredentials: [{
    credentialID: { type: String, required: true },
    credentialPublicKey: { type: String, required: true },
    counter: { type: Number, default: 0 },
    transports: [String],
  }],
  language: {
    type: String,
    enum: ['en', 'hi', 'te'],
    default: 'en',
  },
  alertPreferences: {
    sms: { type: Boolean, default: true },
    whatsapp: { type: Boolean, default: false },
    voice: { type: Boolean, default: false },
    push: { type: Boolean, default: false },
  },
}, {
  timestamps: true,
});

userSchema.index({ district: 1, state: 1 });
userSchema.index({ primaryCrop: 1 });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
