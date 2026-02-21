require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

async function seedAdmin() {
  await connectDB();

  const existing = await User.findOne({ phone: '9999999999' });
  if (existing) {
    console.log('Admin already exists');
    await mongoose.disconnect();
    return;
  }

  await User.create({
    name: 'Admin',
    phone: '9999999999',
    password: 'admin123',
    role: 'admin',
    district: 'Hyderabad',
    state: 'Telangana',
    language: 'en',
  });

  console.log('Admin user created: phone=9999999999, password=admin123');
  await mongoose.disconnect();
}

seedAdmin();
