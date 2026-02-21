const axios = require('axios');
const WeatherCache = require('../models/WeatherCache');

const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

/**
 * Generate mock weather data when no API key is configured.
 */
const generateMockData = (location) => {
  const baseTemp = 32;
  const baseHumidity = 65;
  const conditions = ['Clear', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Sunny'];

  const current = {
    temp: baseTemp,
    humidity: baseHumidity,
    windSpeed: 12,
    rainfall: 0,
    condition: 'Partly Cloudy',
    icon: '02d',
    description: 'partly cloudy',
  };

  const forecast = [];
  for (let i = 1; i <= 7; i++) {
    const tempVariation = Math.round((Math.random() - 0.5) * 8);
    const humidityVariation = Math.round((Math.random() - 0.5) * 20);
    const conditionIndex = Math.floor(Math.random() * conditions.length);
    const rainProbability = Math.round(Math.random() * 100);
    const rainfall = rainProbability > 60 ? Math.round(Math.random() * 20) : 0;

    const date = new Date();
    date.setDate(date.getDate() + i);

    forecast.push({
      date,
      tempMax: baseTemp + tempVariation + 3,
      tempMin: baseTemp + tempVariation - 5,
      humidity: Math.max(20, Math.min(100, baseHumidity + humidityVariation)),
      windSpeed: Math.max(0, 12 + Math.round((Math.random() - 0.5) * 15)),
      rainfall,
      rainProbability,
      condition: conditions[conditionIndex],
      icon: rainfall > 0 ? '10d' : '01d',
      description: conditions[conditionIndex].toLowerCase(),
    });
  }

  return { current, forecast };
};

/**
 * Generate farming action recommendations based on weather thresholds.
 */
const getFarmingActions = (current, forecast) => {
  const actions = [];

  // Check current conditions
  if (current.humidity > 80) {
    actions.push({
      type: 'warning',
      action: 'High humidity - watch for fungal diseases',
      detail: `Current humidity is ${current.humidity}%. Apply fungicides preventively if needed.`,
    });
  }

  if (current.windSpeed > 40) {
    actions.push({
      type: 'caution',
      action: 'Do not spray pesticides',
      detail: `Wind speed is ${current.windSpeed} km/h. Spraying will be ineffective and wasteful.`,
    });
  }

  if (current.temp > 42) {
    actions.push({
      type: 'critical',
      action: 'Provide shade to nursery plants',
      detail: `Temperature is ${current.temp}°C. Extreme heat can damage young plants.`,
    });
  }

  if (current.temp < 5) {
    actions.push({
      type: 'critical',
      action: 'Protect crops from frost',
      detail: `Temperature is ${current.temp}°C. Cover sensitive crops with mulch or plastic sheets.`,
    });
  }

  // Check next 2 days of forecast for rain
  const next2Days = forecast.slice(0, 2);
  const rainExpected = next2Days.some(
    (day) => day.rainProbability > 60 || day.rainfall > 0
  );

  if (rainExpected) {
    actions.push({
      type: 'info',
      action: 'Skip irrigation today',
      detail: 'Rain is expected in the next 2 days. Save water and let nature irrigate.',
    });
  }

  // Additional forecast-based recommendations
  const highHumidityDays = forecast.filter((day) => day.humidity > 80).length;
  if (highHumidityDays >= 3) {
    actions.push({
      type: 'warning',
      action: 'Prolonged high humidity expected',
      detail: `${highHumidityDays} days of high humidity ahead. Increase vigilance for crop diseases.`,
    });
  }

  // Always provide at least some baseline farming actions
  if (actions.length === 0) {
    actions.push(
      {
        action: 'Good conditions for field work',
        type: 'info',
        severity: 'low',
      },
      {
        action: 'Regular irrigation recommended',
        type: 'info',
        severity: 'low',
      },
      {
        action: 'Monitor crops for pest activity',
        type: 'caution',
        severity: 'medium',
      }
    );
  }

  // Ensure every action has a severity field
  return actions.map((a) => ({
    ...a,
    severity: a.severity || (a.type === 'critical' ? 'high' : a.type === 'warning' ? 'medium' : 'low'),
  }));
};

/**
 * Fetch weather from OpenWeatherMap API.
 */
const fetchFromOpenWeatherMap = async (location) => {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  // Get coordinates via geocoding - try with India first, fallback to global
  let geoRes = await axios.get(
    `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)},IN&limit=1&appid=${apiKey}`
  );

  // If not found in India, try global search
  if (!geoRes.data || geoRes.data.length === 0) {
    geoRes = await axios.get(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${apiKey}`
    );
  }

  if (!geoRes.data || geoRes.data.length === 0) {
    throw new Error(`Location not found: ${location}`);
  }

  const { lat, lon } = geoRes.data[0];

  // Fetch current weather
  const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
  const currentRes = await axios.get(currentUrl);
  const cData = currentRes.data;

  const current = {
    temp: Math.round(cData.main.temp),
    humidity: cData.main.humidity,
    windSpeed: Math.round(cData.wind.speed * 3.6), // m/s to km/h
    rainfall: cData.rain ? cData.rain['1h'] || cData.rain['3h'] || 0 : 0,
    condition: cData.weather[0].main,
    icon: cData.weather[0].icon,
    description: cData.weather[0].description,
  };

  // Fetch 7-day forecast
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
  const forecastRes = await axios.get(forecastUrl);

  // Group forecast by day (API returns 3-hour intervals)
  const dailyMap = {};
  forecastRes.data.list.forEach((entry) => {
    const dateKey = entry.dt_txt.split(' ')[0];
    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = {
        temps: [],
        humidities: [],
        windSpeeds: [],
        rainfalls: [],
        conditions: [],
        icons: [],
        descriptions: [],
        pops: [],
      };
    }
    dailyMap[dateKey].temps.push(entry.main.temp);
    dailyMap[dateKey].humidities.push(entry.main.humidity);
    dailyMap[dateKey].windSpeeds.push(entry.wind.speed * 3.6);
    dailyMap[dateKey].rainfalls.push(
      entry.rain ? entry.rain['3h'] || 0 : 0
    );
    dailyMap[dateKey].conditions.push(entry.weather[0].main);
    dailyMap[dateKey].icons.push(entry.weather[0].icon);
    dailyMap[dateKey].descriptions.push(entry.weather[0].description);
    dailyMap[dateKey].pops.push((entry.pop || 0) * 100);
  });

  const forecast = Object.entries(dailyMap)
    .slice(0, 7)
    .map(([dateStr, data]) => ({
      date: new Date(dateStr),
      tempMax: Math.round(Math.max(...data.temps)),
      tempMin: Math.round(Math.min(...data.temps)),
      humidity: Math.round(
        data.humidities.reduce((a, b) => a + b, 0) / data.humidities.length
      ),
      windSpeed: Math.round(
        data.windSpeeds.reduce((a, b) => a + b, 0) / data.windSpeeds.length
      ),
      rainfall: Math.round(data.rainfalls.reduce((a, b) => a + b, 0) * 10) / 10,
      rainProbability: Math.round(Math.max(...data.pops)),
      condition: data.conditions[Math.floor(data.conditions.length / 2)],
      icon: data.icons[Math.floor(data.icons.length / 2)],
      description: data.descriptions[Math.floor(data.descriptions.length / 2)],
    }));

  return { current, forecast, lat, lon };
};

// GET /api/weather?location=Hyderabad
exports.getWeather = async (req, res, next) => {
  try {
    const { location } = req.query;

    if (!location) {
      return res.status(400).json({
        success: false,
        message: 'Location parameter is required',
      });
    }

    const locationKey = location.toLowerCase().trim();

    // Check cache (3h TTL)
    const cached = await WeatherCache.findOne({
      location: locationKey,
      fetchedAt: { $gte: new Date(Date.now() - CACHE_TTL_MS) },
    });

    if (cached) {
      const farmingActions = getFarmingActions(cached.current, cached.forecast);

      return res.json({
        success: true,
        data: {
          location: location,
          current: cached.current,
          forecast: cached.forecast,
          farmingActions,
          source: 'cache',
          fetchedAt: cached.fetchedAt,
        },
        message: 'Weather data retrieved from cache',
      });
    }

    // Cache miss: fetch fresh data
    let weatherData;
    let source;

    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (apiKey) {
      try {
        weatherData = await fetchFromOpenWeatherMap(location);
        source = 'openweathermap';
      } catch (apiError) {
        // Fall back to mock if API fails
        console.error('OpenWeatherMap API error:', apiError.message);
        weatherData = generateMockData(location);
        source = 'mock';
      }
    } else {
      weatherData = generateMockData(location);
      source = 'mock';
    }

    // Store in cache (upsert by location)
    await WeatherCache.findOneAndUpdate(
      { location: locationKey },
      {
        location: locationKey,
        lat: weatherData.lat || null,
        lon: weatherData.lon || null,
        current: weatherData.current,
        forecast: weatherData.forecast,
        fetchedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    const farmingActions = getFarmingActions(
      weatherData.current,
      weatherData.forecast
    );

    res.json({
      success: true,
      data: {
        location: location,
        current: weatherData.current,
        forecast: weatherData.forecast,
        farmingActions,
        source,
        fetchedAt: new Date(),
      },
      message: 'Weather data retrieved successfully',
    });
  } catch (error) {
    next(error);
  }
};
