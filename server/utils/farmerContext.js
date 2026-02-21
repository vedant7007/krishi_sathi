const CropRule = require('../models/CropRule');
const WeatherCache = require('../models/WeatherCache');
const MarketPrice = require('../models/MarketPrice');
const GovernmentScheme = require('../models/GovernmentScheme');

/**
 * Load all relevant farming context for a user in parallel.
 * Each query is wrapped in try-catch so one failure doesn't break the rest.
 */
async function getFarmerContext(user) {
  const crop = user.primaryCrop || 'rice';
  const district = user.district || '';
  const state = user.state || '';
  const soilType = user.soilType || 'any';
  const landHolding = user.landHolding || 0;

  const [cropRule, weather, prices, schemes] = await Promise.all([
    // 1. Crop advisory
    (async () => {
      try {
        // Try exact match first, then relaxed
        let rule = await CropRule.findOne({ crop, soilType }).lean();
        if (!rule) rule = await CropRule.findOne({ crop }).lean();
        return rule;
      } catch (err) {
        console.error('[farmerContext] CropRule error:', err.message);
        return null;
      }
    })(),

    // 2. Weather for their district
    (async () => {
      try {
        if (!district) return null;
        const cached = await WeatherCache.findOne({ location: new RegExp(district, 'i') })
          .sort({ fetchedAt: -1 })
          .lean();
        return cached;
      } catch (err) {
        console.error('[farmerContext] WeatherCache error:', err.message);
        return null;
      }
    })(),

    // 3. Latest market prices for their crop
    (async () => {
      try {
        const query = { crop: new RegExp(crop, 'i') };
        if (state) query.state = new RegExp(state, 'i');
        const priceList = await MarketPrice.find(query)
          .sort({ date: -1 })
          .limit(5)
          .lean();
        return priceList;
      } catch (err) {
        console.error('[farmerContext] MarketPrice error:', err.message);
        return [];
      }
    })(),

    // 4. Eligible government schemes
    (async () => {
      try {
        const activeSchemes = await GovernmentScheme.find({ status: 'active' }).lean();
        // Filter by eligibility
        return activeSchemes.filter((scheme) => {
          const elig = scheme.eligibility || {};
          // State check
          if (elig.states && elig.states.length > 0 && state) {
            const stateMatch = elig.states.some(
              (s) => s.toLowerCase() === 'all' || s.toLowerCase() === state.toLowerCase()
            );
            if (!stateMatch) return false;
          }
          // Crop check
          if (elig.crops && elig.crops.length > 0) {
            const cropMatch = elig.crops.some(
              (c) => c.toLowerCase() === 'all' || c.toLowerCase() === crop.toLowerCase()
            );
            if (!cropMatch) return false;
          }
          // Land holding check
          if (elig.landHoldingMax && landHolding > elig.landHoldingMax) return false;
          if (elig.landHoldingMin && landHolding < elig.landHoldingMin) return false;
          return true;
        });
      } catch (err) {
        console.error('[farmerContext] GovernmentScheme error:', err.message);
        return [];
      }
    })(),
  ]);

  // Format context for the AI prompt
  const context = {
    farmer: {
      name: user.name,
      district,
      state,
      crop,
      soilType,
      landHolding,
      language: user.language || 'en',
    },
    advisory: null,
    weather: null,
    prices: [],
    schemes: [],
  };

  // Format crop advisory
  if (cropRule) {
    context.advisory = {
      crop: cropRule.crop,
      fertilizer: cropRule.fertilizer || {},
      irrigation: cropRule.irrigation || {},
      pest: cropRule.pest || {},
      sowing: cropRule.sowing || {},
      harvest: cropRule.harvest || {},
      msp: cropRule.msp || {},
    };
  }

  // Format weather
  if (weather) {
    context.weather = {
      current: weather.current || {},
      forecast: (weather.forecast || []).slice(0, 3).map((f) => ({
        date: f.date,
        tempMax: f.tempMax,
        tempMin: f.tempMin,
        rainfall: f.rainfall,
        rainProbability: f.rainProbability,
        condition: f.condition,
      })),
      fetchedAt: weather.fetchedAt,
    };
  }

  // Format prices
  if (prices && prices.length > 0) {
    context.prices = prices.map((p) => ({
      mandi: p.mandi,
      price: p.price,
      minPrice: p.minPrice,
      maxPrice: p.maxPrice,
      date: p.date,
      state: p.state,
      district: p.district,
    }));
  }

  // Format schemes
  if (schemes && schemes.length > 0) {
    context.schemes = schemes.slice(0, 5).map((s) => ({
      name: s.name,
      benefits: s.benefits,
      description: s.description,
      applicationUrl: s.applicationUrl,
      deadline: s.deadline,
      category: s.category,
    }));
  }

  return context;
}

module.exports = { getFarmerContext };
