/**
 * KrishiSathi - Database Seed Runner
 *
 * Usage:
 *   node seeds/index.js              - Seed all collections
 *   node seeds/index.js --only crops - Seed only crop rules
 *   node seeds/index.js --only prices - Seed only market prices
 *   node seeds/index.js --only schemes - Seed only schemes
 *   node seeds/index.js --only news   - Seed only news
 *   node seeds/index.js --no-clear    - Insert without clearing existing data
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');

// Import models
const CropRule = require('../models/CropRule');
const MarketPrice = require('../models/MarketPrice');
const GovernmentScheme = require('../models/GovernmentScheme');
const News = require('../models/News');

// Import seed data
const cropRules = require('./cropRules');
const marketPrices = require('./marketPrices');
const schemes = require('./schemes');
const news = require('./news');

// Parse CLI arguments
const args = process.argv.slice(2);
const onlyFlag = args.indexOf('--only');
const onlyTarget = onlyFlag !== -1 ? args[onlyFlag + 1] : null;
const noClear = args.includes('--no-clear');

const collections = {
  crops: { model: CropRule, data: cropRules, label: 'Crop Rules' },
  prices: { model: MarketPrice, data: marketPrices, label: 'Market Prices' },
  schemes: { model: GovernmentScheme, data: schemes, label: 'Government Schemes' },
  news: { model: News, data: news, label: 'News Articles' },
};

async function seedCollection(key) {
  const { model, data, label } = collections[key];

  if (!noClear) {
    const deleted = await model.deleteMany({});
    console.log(`  Cleared ${label}: ${deleted.deletedCount} documents removed`);
  }

  const inserted = await model.insertMany(data, { ordered: false });
  console.log(`  Seeded ${label}: ${inserted.length} documents inserted`);

  return inserted.length;
}

async function runSeeder() {
  console.log('\n============================================');
  console.log('  KrishiSathi Database Seeder');
  console.log('============================================\n');

  try {
    // Connect to MongoDB
    await connectDB();
    console.log('');

    const targets = onlyTarget ? [onlyTarget] : Object.keys(collections);
    const results = {};

    // Validate target
    if (onlyTarget && !collections[onlyTarget]) {
      console.error(`Error: Unknown target "${onlyTarget}". Valid targets: ${Object.keys(collections).join(', ')}`);
      process.exit(1);
    }

    for (const key of targets) {
      console.log(`Seeding: ${collections[key].label}...`);
      try {
        results[key] = await seedCollection(key);
      } catch (err) {
        console.error(`  Error seeding ${collections[key].label}:`, err.message);
        results[key] = 0;
      }
    }

    // Summary
    console.log('\n============================================');
    console.log('  Seed Summary');
    console.log('============================================');
    for (const [key, count] of Object.entries(results)) {
      const icon = count > 0 ? '[OK]' : '[FAIL]';
      console.log(`  ${icon} ${collections[key].label}: ${count} documents`);
    }
    const total = Object.values(results).reduce((sum, c) => sum + c, 0);
    console.log(`\n  Total: ${total} documents seeded`);
    console.log('============================================\n');

  } catch (error) {
    console.error('Seeder failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected. Seeding complete.\n');
  }
}

runSeeder();
