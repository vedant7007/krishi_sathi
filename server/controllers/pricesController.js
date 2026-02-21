const MarketPrice = require('../models/MarketPrice');
const CropRule = require('../models/CropRule');
const WeatherCache = require('../models/WeatherCache');

// GET /api/prices?crop=cotton&state=telangana
exports.getPrices = async (req, res, next) => {
  try {
    const { crop, state, district, mandi } = req.query;

    const filter = {};
    if (crop) filter.crop = crop.toLowerCase();
    if (state) filter.state = new RegExp(state, 'i');
    if (district) filter.district = new RegExp(district, 'i');
    if (mandi) filter.mandi = new RegExp(mandi, 'i');

    // Get latest prices from each mandi (most recent date per mandi)
    const pipeline = [];
    if (Object.keys(filter).length > 0) {
      pipeline.push({ $match: filter });
    }
    pipeline.push(
      { $sort: { date: -1 } },
      {
        $group: {
          _id: { mandi: '$mandi', crop: '$crop' },
          crop: { $first: '$crop' },
          mandi: { $first: '$mandi' },
          state: { $first: '$state' },
          district: { $first: '$district' },
          price: { $first: '$price' },
          minPrice: { $first: '$minPrice' },
          maxPrice: { $first: '$maxPrice' },
          unit: { $first: '$unit' },
          date: { $first: '$date' },
          source: { $first: '$source' },
        },
      },
      { $sort: { price: -1 } },
      { $limit: 50 }
    );

    const prices = await MarketPrice.aggregate(pipeline);

    res.json({
      success: true,
      data: {
        prices,
        count: prices.length,
        query: { crop: crop || null, state: state || null, district: district || null, mandi: mandi || null },
      },
      message: prices.length > 0
        ? `Found ${prices.length} mandi prices${crop ? ` for ${crop}` : ''}`
        : 'No prices found for the given filters',
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/prices/history?crop=cotton&mandi=Warangal&days=14
exports.getPriceHistory = async (req, res, next) => {
  try {
    const { crop, mandi, days } = req.query;

    if (!crop || !mandi) {
      return res.status(400).json({
        success: false,
        message: 'Crop and mandi parameters are required',
      });
    }

    const numDays = parseInt(days, 10) || 14;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - numDays);

    const rawHistory = await MarketPrice.find({
      crop: crop.toLowerCase(),
      mandi: new RegExp(mandi, 'i'),
      date: { $gte: startDate },
    })
      .sort({ date: 1 })
      .select('price minPrice maxPrice date mandi unit')
      .lean();

    // Format history for Recharts compatibility (date as string, numeric values)
    const history = rawHistory.map((h) => ({
      date: h.date ? new Date(h.date).toISOString().split('T')[0] : null,
      price: h.price,
      minPrice: h.minPrice,
      maxPrice: h.maxPrice,
      mandi: h.mandi,
      unit: h.unit,
    }));

    // Calculate statistics
    let stats = null;
    if (history.length > 0) {
      const prices = history.map((h) => h.price);
      const sum = prices.reduce((a, b) => a + b, 0);
      stats = {
        avgPrice: Math.round(sum / prices.length),
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        priceChange: prices.length >= 2
          ? Math.round(prices[prices.length - 1] - prices[0])
          : 0,
        priceChangePercent: prices.length >= 2
          ? Math.round(((prices[prices.length - 1] - prices[0]) / prices[0]) * 100 * 100) / 100
          : 0,
        dataPoints: prices.length,
      };
    }

    res.json({
      success: true,
      data: {
        history,
        stats,
        query: { crop, mandi, days: numDays },
      },
      message: `Price history for ${crop} at ${mandi} over ${numDays} days`,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/prices/sell-recommendation?crop=cotton&mandi=Warangal
exports.getSellRecommendation = async (req, res, next) => {
  try {
    const { crop, mandi, location } = req.query;

    if (!crop || !mandi) {
      return res.status(400).json({
        success: false,
        message: 'Crop and mandi parameters are required',
      });
    }

    const cropLower = crop.toLowerCase();

    // Get last 7 days of price data for this crop at this mandi
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const priceHistory = await MarketPrice.find({
      crop: cropLower,
      mandi: new RegExp(mandi, 'i'),
      date: { $gte: sevenDaysAgo },
    })
      .sort({ date: -1 })
      .select('price date');

    if (priceHistory.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No recent price data found for ${crop} at ${mandi}`,
      });
    }

    const reasons = [];
    let score = 0;

    const currentPrice = priceHistory[0].price;

    // Condition 1: Current price > 7-day average by 3%
    const prices7d = priceHistory.map((p) => p.price);
    const avg7d = prices7d.reduce((a, b) => a + b, 0) / prices7d.length;
    const aboveAvgPercent = ((currentPrice - avg7d) / avg7d) * 100;

    if (aboveAvgPercent > 3) {
      score++;
      reasons.push(
        `Current price (${currentPrice}) is ${aboveAvgPercent.toFixed(1)}% above 7-day average (${Math.round(avg7d)})`
      );
    } else {
      reasons.push(
        `Current price (${currentPrice}) is only ${aboveAvgPercent.toFixed(1)}% vs 7-day average (${Math.round(avg7d)}). Needs >3%`
      );
    }

    // Condition 2: Current price > MSP by 5%
    const cropRule = await CropRule.findOne({ crop: cropLower });
    if (cropRule && cropRule.msp && cropRule.msp.price) {
      const msp = cropRule.msp.price;
      const aboveMspPercent = ((currentPrice - msp) / msp) * 100;

      if (aboveMspPercent > 5) {
        score++;
        reasons.push(
          `Current price (${currentPrice}) is ${aboveMspPercent.toFixed(1)}% above MSP (${msp})`
        );
      } else {
        reasons.push(
          `Current price (${currentPrice}) is only ${aboveMspPercent.toFixed(1)}% vs MSP (${msp}). Needs >5%`
        );
      }
    } else {
      reasons.push('MSP data not available for this crop - condition skipped');
    }

    // Condition 3: 3-day uptrend (each day higher than previous)
    if (priceHistory.length >= 3) {
      const last3 = priceHistory.slice(0, 3).reverse(); // oldest to newest
      const isUptrend =
        last3[1].price > last3[0].price && last3[2].price > last3[1].price;

      if (isUptrend) {
        score++;
        reasons.push(
          `3-day uptrend detected: ${last3.map((p) => p.price).join(' → ')}`
        );
      } else {
        reasons.push(
          `No 3-day uptrend: ${last3.map((p) => p.price).join(' → ')}`
        );
      }
    } else {
      reasons.push('Insufficient data for 3-day trend analysis');
    }

    // Condition 4: No rain in next 2 days
    let rainCheck = true; // Default: assume no rain if no weather data
    const locationKey = location ? location.toLowerCase().trim() : null;

    if (locationKey) {
      const weatherCache = await WeatherCache.findOne({
        location: locationKey,
        fetchedAt: { $gte: new Date(Date.now() - 3 * 60 * 60 * 1000) },
      });

      if (weatherCache && weatherCache.forecast && weatherCache.forecast.length >= 2) {
        const next2Days = weatherCache.forecast.slice(0, 2);
        const rainExpected = next2Days.some(
          (day) => day.rainProbability > 60 || day.rainfall > 5
        );

        if (rainExpected) {
          rainCheck = false;
          reasons.push('Rain expected in next 2 days - prices may drop post-harvest');
        } else {
          reasons.push('No significant rain expected in next 2 days');
        }
      } else {
        reasons.push('Weather data not available - assuming clear weather');
      }
    } else {
      reasons.push('No location provided for weather check - assuming no rain');
    }

    if (rainCheck) {
      score++;
    }

    const shouldSell = score >= 3;

    res.json({
      success: true,
      data: {
        shouldSell,
        score,
        maxScore: 4,
        reasons,
        currentPrice,
        avg7d: Math.round(avg7d),
        recommendation: shouldSell
          ? 'Market conditions are favorable. Consider selling now.'
          : 'Hold your stock. Market conditions are not optimal yet.',
        query: { crop, mandi, location },
      },
      message: shouldSell
        ? `Sell recommendation: YES (${score}/4 conditions met)`
        : `Sell recommendation: HOLD (${score}/4 conditions met)`,
    });
  } catch (error) {
    next(error);
  }
};
