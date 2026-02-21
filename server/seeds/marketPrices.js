/**
 * KrishiSathi - Market Price Seed Data Generator
 * Programmatically generates 1500+ price entries across 10 crops, 11 mandis, 14 days
 */

const mandis = [
  { name: 'Warangal', state: 'Telangana', district: 'Warangal' },
  { name: 'Hyderabad', state: 'Telangana', district: 'Hyderabad' },
  { name: 'Nagpur', state: 'Maharashtra', district: 'Nagpur' },
  { name: 'Ahmedabad', state: 'Gujarat', district: 'Ahmedabad' },
  { name: 'Indore', state: 'Madhya Pradesh', district: 'Indore' },
  { name: 'Delhi', state: 'Delhi', district: 'New Delhi' },
  { name: 'Jaipur', state: 'Rajasthan', district: 'Jaipur' },
  { name: 'Pune', state: 'Maharashtra', district: 'Pune' },
  { name: 'Guntur', state: 'Andhra Pradesh', district: 'Guntur' },
  { name: 'Raichur', state: 'Karnataka', district: 'Raichur' },
  { name: 'Khammam', state: 'Telangana', district: 'Khammam' },
];

const crops = [
  { name: 'cotton', basePrice: 7000, variance: 500, minPrice: 6500, maxPrice: 7500 },
  { name: 'rice', basePrice: 2350, variance: 250, minPrice: 2100, maxPrice: 2600 },
  { name: 'wheat', basePrice: 2300, variance: 200, minPrice: 2100, maxPrice: 2500 },
  { name: 'maize', basePrice: 2150, variance: 250, minPrice: 1900, maxPrice: 2400 },
  { name: 'tomato', basePrice: 2150, variance: 1350, minPrice: 800, maxPrice: 3500 },
  { name: 'groundnut', basePrice: 6350, variance: 850, minPrice: 5500, maxPrice: 7200 },
  { name: 'soybean', basePrice: 4700, variance: 500, minPrice: 4200, maxPrice: 5200 },
  { name: 'sugarcane', basePrice: 315, variance: 35, minPrice: 280, maxPrice: 350 },
  { name: 'onion', basePrice: 1900, variance: 1100, minPrice: 800, maxPrice: 3000 },
  { name: 'chilli', basePrice: 13000, variance: 5000, minPrice: 8000, maxPrice: 18000 },
];

// Seeded pseudo-random number generator for reproducible data
function seededRandom(seed) {
  let state = seed;
  return function () {
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    return (state >>> 0) / 0xffffffff;
  };
}

// Mandi-specific price modifiers (some mandis are premium, some discount)
const mandiModifiers = {
  'Warangal': -0.02,
  'Hyderabad': 0.03,
  'Nagpur': 0.00,
  'Ahmedabad': 0.02,
  'Indore': -0.01,
  'Delhi': 0.05,
  'Jaipur': 0.01,
  'Pune': 0.04,
  'Guntur': -0.01,
  'Raichur': -0.03,
  'Khammam': -0.02,
};

// Day-of-week pattern (prices slightly different on different days)
// Index 0 = Sunday ... 6 = Saturday
const dayPatterns = [0.00, 0.01, -0.005, 0.005, 0.01, 0.02, -0.01];

// Trend simulation - some crops trending up, some down over the 14 days
const trendPerDay = {
  'cotton': 5,      // slight upward trend
  'rice': -3,       // slight dip
  'wheat': 2,       // stable to slight up
  'maize': -2,      // slight dip
  'tomato': -30,    // tomato prices falling (oversupply scenario)
  'groundnut': 8,   // rising
  'soybean': 4,     // stable to up
  'sugarcane': 0,   // stable (regulated)
  'onion': 15,      // rising (pre-summer pattern)
  'chilli': -20,    // correction after peak
};

function generateMarketPrices() {
  const prices = [];
  const rng = seededRandom(42);
  const baseDate = new Date('2026-02-21T00:00:00Z');

  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() - dayOffset);
    const dayOfWeek = date.getDay();

    for (const crop of crops) {
      for (const mandi of mandis) {
        // Calculate price with various factors
        const mandiMod = mandiModifiers[mandi.name] || 0;
        const dayMod = dayPatterns[dayOfWeek];
        const trendMod = trendPerDay[crop.name] * (13 - dayOffset); // cumulative trend

        // Random variation (-1 to 1 range)
        const randomFactor = (rng() * 2 - 1) * crop.variance * 0.3;

        // Compute modal price
        let modalPrice = crop.basePrice
          + (crop.basePrice * mandiMod)
          + (crop.basePrice * dayMod)
          + trendMod
          + randomFactor;

        // Clamp to min/max range
        modalPrice = Math.max(crop.minPrice, Math.min(crop.maxPrice, modalPrice));
        modalPrice = Math.round(modalPrice);

        // Min and max prices around modal
        const spread = Math.round(crop.variance * (0.1 + rng() * 0.15));
        let minP = modalPrice - spread;
        let maxP = modalPrice + spread;

        // Ensure min/max within absolute bounds
        minP = Math.max(crop.minPrice, minP);
        maxP = Math.min(crop.maxPrice, maxP);

        // Ensure logical ordering
        if (minP > modalPrice) minP = modalPrice;
        if (maxP < modalPrice) maxP = modalPrice;

        prices.push({
          crop: crop.name,
          mandi: mandi.name,
          state: mandi.state,
          district: mandi.district,
          price: modalPrice,
          minPrice: minP,
          maxPrice: maxP,
          unit: '₹/quintal',
          date: new Date(date),
          source: 'agmarknet',
        });
      }
    }
  }

  return prices;
}

const marketPrices = generateMarketPrices();

module.exports = marketPrices;
