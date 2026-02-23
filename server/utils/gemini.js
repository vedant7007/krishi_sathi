const { GoogleGenerativeAI } = require('@google/generative-ai');
const translate = require('google-translate-api-x');
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Try multiple models with fallback for rate limits / 404s
const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];
let currentModelIdx = 0;

// ─── Persistent file-based translation cache ───
const CACHE_DIR = path.join(__dirname, '..', '.translation-cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

const memCache = new Map();

function hashStr(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function getCached(key) {
  if (memCache.has(key)) return memCache.get(key);
  const filePath = path.join(CACHE_DIR, `${key}.json`);
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      memCache.set(key, data);
      return data;
    }
  } catch { /* ignore corrupt files */ }
  return null;
}

function setCache(key, value) {
  memCache.set(key, value);
  try {
    fs.writeFileSync(
      path.join(CACHE_DIR, `${key}.json`),
      JSON.stringify(value),
      'utf8'
    );
  } catch { /* ignore write errors */ }
}

// ─── Free Google Translate fallback ───
async function googleTranslateText(text, targetLang) {
  if (!text || text.trim().length === 0) return text;
  try {
    const result = await translate(text, { to: targetLang });
    return result.text;
  } catch (err) {
    console.error('[googleTranslate] Error:', err.message);
    return text;
  }
}

async function googleTranslateBatch(items, fields, targetLang) {
  return Promise.all(
    items.map(async (item) => {
      const copy = { ...item };
      await Promise.all(
        fields.map(async (f) => {
          if (copy[f] && typeof copy[f] === 'string' && copy[f].trim()) {
            copy[f] = await googleTranslateText(copy[f], targetLang);
          }
        })
      );
      return copy;
    })
  );
}

async function googleTranslateObj(obj, targetLang) {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    const result = [];
    for (const item of obj) {
      if (typeof item === 'string' && item.trim()) {
        result.push(await googleTranslateText(item, targetLang));
      } else if (typeof item === 'object' && item !== null) {
        result.push(await googleTranslateObj(item, targetLang));
      } else {
        result.push(item);
      }
    }
    return result;
  }

  const copy = { ...obj };
  for (const key of Object.keys(copy)) {
    if (typeof copy[key] === 'string' && copy[key].trim()) {
      copy[key] = await googleTranslateText(copy[key], targetLang);
    } else if (Array.isArray(copy[key])) {
      copy[key] = await googleTranslateObj(copy[key], targetLang);
    } else if (typeof copy[key] === 'object' && copy[key] !== null) {
      copy[key] = await googleTranslateObj(copy[key], targetLang);
    }
  }
  return copy;
}

// ─── Custom error for rate limits ───
class RateLimitError extends Error {
  constructor() {
    super('RATE_LIMITED');
    this.name = 'RateLimitError';
    this.statusCode = 429;
  }
}
exports.RateLimitError = RateLimitError;

/**
 * Send a prompt to Gemini and get text response.
 * Throws RateLimitError when all models are exhausted.
 */
exports.generate = async (prompt) => {
  const MAX_RETRIES = 2;

  for (let retry = 0; retry < MAX_RETRIES; retry++) {
    for (let i = 0; i < MODELS.length; i++) {
      try {
        const modelName = MODELS[i];
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        if (i !== currentModelIdx) {
          console.log(`[Gemini] Switched to ${modelName}`);
          currentModelIdx = i;
        }
        return result.response.text();
      } catch (err) {
        if (
          err.message?.includes('429') ||
          err.message?.includes('quota') ||
          err.message?.includes('404') ||
          err.message?.includes('not found')
        ) {
          console.log(`[Gemini] ${MODELS[i]} failed (${err.status || '?'}), trying next...`);
          continue;
        }
        throw err;
      }
    }

    if (retry < MAX_RETRIES - 1) {
      console.log(`[Gemini] All models failed, retrying in 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw new RateLimitError();
};

/**
 * Translate a JSON object's string values.
 * Tries Gemini first, falls back to Google Translate.
 */
exports.translateJSON = async (obj, targetLang) => {
  if (!obj || targetLang === 'en') return obj;
  const langName = targetLang === 'hi' ? 'Hindi' : targetLang === 'te' ? 'Telugu' : 'English';

  const cacheKey = 'tj_' + hashStr(JSON.stringify(obj) + ':' + targetLang);
  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`[translateJSON] Cache hit for ${langName}`);
    return cached;
  }

  const prompt = `Translate ALL string values in the following JSON object to ${langName}.
Keep all keys exactly the same. Keep numbers and null values unchanged.
Return ONLY the valid JSON, no markdown fences, no explanation.

${JSON.stringify(obj)}`;

  function didTranslate(original, translated) {
    return JSON.stringify(original) !== JSON.stringify(translated);
  }

  try {
    const result = await exports.generate(prompt);
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    console.log(`[translateJSON] Gemini translated to ${langName}`);
    if (didTranslate(obj, parsed)) setCache(cacheKey, parsed);
    return parsed;
  } catch (geminiErr) {
    console.log(`[translateJSON] Gemini failed, trying Google Translate for ${langName}`);
    try {
      const result = await googleTranslateObj(obj, targetLang);
      if (didTranslate(obj, result)) {
        setCache(cacheKey, result);
        console.log(`[translateJSON] Google Translate succeeded for ${langName}`);
      }
      return result;
    } catch (err) {
      console.error(`[translateJSON] All translation failed for ${langName}:`, err.message);
      return obj;
    }
  }
};

/**
 * Translate an array of objects in a SINGLE call (batch).
 * Tries Gemini first, falls back to Google Translate.
 */
exports.translateBatch = async (items, fields, targetLang) => {
  if (!items || items.length === 0 || targetLang === 'en') return items;

  const langName = targetLang === 'hi' ? 'Hindi' : targetLang === 'te' ? 'Telugu' : 'English';

  const toTranslate = items.map((item, idx) => {
    const obj = { _i: idx };
    fields.forEach((f) => { obj[f] = item[f] || ''; });
    return obj;
  });

  const cacheKey = 'tb_' + hashStr(JSON.stringify(toTranslate) + ':' + targetLang);
  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`[translateBatch] Cache hit for ${langName} (${items.length} items)`);
    return cached;
  }

  const prompt = `Translate ALL string values in the following JSON array to ${langName}.
Keep all keys exactly the same. Keep _i numbers unchanged.
Return ONLY the valid JSON array, no markdown fences, no explanation.

${JSON.stringify(toTranslate)}`;

  try {
    const result = await exports.generate(prompt);
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error('Not an array');

    const merged = items.map((item, idx) => {
      const translated = parsed.find((p) => p._i === idx) || parsed[idx];
      if (!translated) return item;
      const copy = { ...item };
      fields.forEach((f) => { if (translated[f]) copy[f] = translated[f]; });
      return copy;
    });

    console.log(`[translateBatch] Gemini translated ${items.length} items to ${langName}`);
    setCache(cacheKey, merged);
    return merged;
  } catch (geminiErr) {
    console.log(`[translateBatch] Gemini failed, using Google Translate for ${langName}`);
    try {
      const merged = await googleTranslateBatch(items, fields, targetLang);
      console.log(`[translateBatch] Google Translate: ${items.length} items to ${langName}`);
      setCache(cacheKey, merged);
      return merged;
    } catch (err) {
      console.error(`[translateBatch] All translation failed for ${langName}:`, err.message);
      return items;
    }
  }
};

/**
 * Voice AI Agent — Gemini-only with full farmer context.
 */
exports.askFarmingAgent = async (userMessage, farmerContext, language = 'en', conversationHistory = []) => {
  const langName = language === 'hi' ? 'Hindi' : language === 'te' ? 'Telugu' : 'English';
  const farmer = farmerContext?.farmer || {};
  const advisory = farmerContext?.advisory;
  const weather = farmerContext?.weather;
  const prices = farmerContext?.prices || [];
  const schemes = farmerContext?.schemes || [];

  let weatherSummary = 'No weather data available.';
  if (weather?.current) {
    const c = weather.current;
    weatherSummary = `Current: ${c.temp || 'N/A'}\u00b0C, humidity ${c.humidity || 'N/A'}%, wind ${c.windSpeed || 'N/A'} km/h, ${c.condition || c.description || 'N/A'}.`;
    if (weather.forecast?.length > 0) {
      weatherSummary += ' Forecast: ' + weather.forecast.map((f) => {
        const d = f.date ? new Date(f.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '?';
        return `${d}: ${f.tempMin || '?'}-${f.tempMax || '?'}\u00b0C, rain ${f.rainProbability || 0}%`;
      }).join('; ') + '.';
    }
  }

  let advisorySummary = 'No crop advisory data available.';
  if (advisory) {
    const parts = [];
    if (advisory.fertilizer?.type) parts.push(`Fertilizer: ${advisory.fertilizer.type}, ${advisory.fertilizer.quantity || ''}, ${advisory.fertilizer.schedule || ''}`);
    if (advisory.irrigation?.method) parts.push(`Irrigation: ${advisory.irrigation.method}, ${advisory.irrigation.frequency || ''}`);
    if (advisory.pest?.commonPests?.length) parts.push(`Pests: ${advisory.pest.commonPests.join(', ')}. Prevention: ${advisory.pest.prevention || 'N/A'}`);
    if (advisory.sowing?.bestTime) parts.push(`Sowing: ${advisory.sowing.bestTime}, seed rate ${advisory.sowing.seedRate || 'N/A'}`);
    if (advisory.harvest?.timing) parts.push(`Harvest: ${advisory.harvest.timing}`);
    if (advisory.msp?.price) parts.push(`MSP: \u20b9${advisory.msp.price} ${advisory.msp.unit || '/quintal'}`);
    advisorySummary = parts.join('\n') || advisorySummary;
  }

  let pricesSummary = 'No market price data available.';
  if (prices.length > 0) {
    pricesSummary = prices.map((p) => {
      const d = p.date ? new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
      return `${p.mandi || 'Unknown mandi'} (${p.district || p.state || ''}): \u20b9${p.price}/quintal ${p.maxPrice ? `(range \u20b9${p.minPrice}-\u20b9${p.maxPrice})` : ''} ${d}`;
    }).join('\n');
  }

  let schemesSummary = 'No scheme data available.';
  if (schemes.length > 0) {
    schemesSummary = schemes.map((s) => {
      return `${s.name}: ${s.benefits || s.description || 'N/A'}${s.applicationUrl ? ` Apply: ${s.applicationUrl}` : ''}`;
    }).join('\n');
  }

  const systemPrompt = `You are KrishiSathi AI \u2014 a warm, knowledgeable farming assistant for Indian farmers.
You are speaking with ${farmer.name || 'a farmer'} from ${farmer.district || 'India'}${farmer.state ? ', ' + farmer.state : ''}.

FARMER PROFILE:
- Crop: ${farmer.crop || 'Not specified'}
- Soil: ${farmer.soilType || 'Not specified'}
- Land: ${farmer.landHolding || 'Not specified'} acres
- Language: ${langName}

LIVE DATA (answer from this \u2014 do NOT make up numbers):
WEATHER: ${weatherSummary}
CROP ADVISORY: ${advisorySummary}
MARKET PRICES: ${pricesSummary}
GOVERNMENT SCHEMES: ${schemesSummary}

RESPONSE RULES (CRITICAL \u2014 this is VOICE, farmer is listening with ears, not reading):
1. Respond ONLY in ${langName}. Use natural, spoken ${langName} \u2014 like talking to a friend, NOT writing an essay.
2. Keep it SHORT: 1-3 sentences MAX. No bullet points, no lists, no formatting.
3. Use "ji" in Hindi, "garu" in Telugu. Sound warm, human, confident \u2014 like a trusted village elder.
4. Give EXACT numbers from the data above. Never say "check with authorities" \u2014 YOU have the data.
5. If you don't have data, be honest: "Abhi yeh data mere paas nahi hai ji" / "I don't have that right now."
6. End with a VERY brief follow-up ONLY if the conversation just started: "Aur batao?" / "Anything else?"
7. For goodbye words (bas/bye/dhanyavaad/thanks), give warm goodbye + "Jai Kisan!" \u2014 nothing else.
8. NEVER use asterisks, markdown, or special characters. Plain spoken text only.
9. For follow-up questions like "tell me more" or "aur batao", refer to the conversation history and expand.
10. If farmer asks outside farming, briefly redirect: "Main kheti mein madad kar sakta hoon ji."`;

  const fallbacks = {
    hi: 'Maaf keejiye ji, abhi jawab mein thodi dikkat aa rahi hai. Kripya thodi der baad dobara poochiye.',
    te: 'Kshaminchandi garu, ippudu samasyam vachindi. Dayachesi koddisepatiki malli adagandi.',
    en: 'Sorry, I am having trouble responding right now. Please try again in a moment.',
  };

  let historyBlock = '';
  if (conversationHistory.length > 0) {
    historyBlock = '\n\nPrevious conversation:\n' +
      conversationHistory.map((m) => `${m.role === 'user' ? 'Farmer' : 'KrishiSathi'}: ${m.content}`).join('\n') + '\n';
  }
  const prompt = `${systemPrompt}${historyBlock}\nFarmer: ${userMessage}\nKrishiSathi:`;
  try {
    const response = await exports.generate(prompt);
    return response.trim();
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.warn('[askFarmingAgent] Gemini rate limited');
      return fallbacks[language] || fallbacks.en;
    }
    console.error('[askFarmingAgent] Error:', err.message);
    return fallbacks[language] || fallbacks.en;
  }
};

/**
 * Generate crop advisory using Gemini when DB has no data.
 * Throws RateLimitError if Gemini is exhausted.
 */
exports.generateAdvisory = async (crop, soilType, season, targetLang) => {
  const langName = targetLang === 'hi' ? 'Hindi' : targetLang === 'te' ? 'Telugu' : 'English';
  const langInstruction = targetLang && targetLang !== 'en'
    ? `\nIMPORTANT: ALL string values MUST be written in ${langName} language. Translate every text value to ${langName}. Keep JSON keys in English only.`
    : '';
  const prompt = `You are an expert Indian agricultural scientist. Generate detailed farming advisory for:
- Crop: ${crop}
- Soil type: ${soilType || 'general'}
- Season: ${season || 'general'}
${langInstruction}
Return ONLY valid JSON (no markdown fences) with this exact structure:
{
  "fertilizer": {
    "type": "specific fertilizer name and NPK ratio",
    "quantity": "amount per acre",
    "schedule": "application timing",
    "notes": "additional tips"
  },
  "irrigation": {
    "method": "irrigation method",
    "frequency": "how often",
    "waterPerAcre": "water quantity",
    "notes": "tips"
  },
  "pest": {
    "commonPests": ["pest1", "pest2", "pest3"],
    "prevention": "prevention methods",
    "treatment": "treatment details",
    "spraySchedule": "when to spray"
  },
  "sowing": {
    "method": "sowing method",
    "depth": "seed depth",
    "spacing": "plant spacing",
    "bestTime": "best sowing time in India",
    "seedRate": "seed rate per acre"
  },
  "harvest": {
    "timing": "harvest time",
    "signs": "signs of maturity",
    "method": "harvesting method",
    "yield": "expected yield per acre"
  },
  "msp": {
    "price": null,
    "unit": "₹/quintal",
    "year": "2024-25"
  }
}`;

  const result = await exports.generate(prompt);
  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
};
