const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Try multiple models with fallback for rate limits / 404s
const MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
];
let currentModelIdx = 0;

function getModel() {
  return genAI.getGenerativeModel({ model: MODELS[currentModelIdx] });
}

/**
 * Send a prompt to Gemini and get text response.
 */
exports.generate = async (prompt) => {
  // Try each model, rotating on rate limit errors
  for (let attempt = 0; attempt < MODELS.length; attempt++) {
    try {
      const model = getModel();
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      if (err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('404') || err.message?.includes('not found')) {
        currentModelIdx = (currentModelIdx + 1) % MODELS.length;
        continue;
      }
      throw err;
    }
  }
  throw new Error('All Gemini models rate limited. Please try again later.');
};

/**
 * Translate a JSON object's string values to target language using Gemini.
 * Used for translating advisory content, scheme descriptions, etc.
 */
exports.translateJSON = async (obj, targetLang) => {
  if (!obj || targetLang === 'en') return obj;
  const langName = targetLang === 'hi' ? 'Hindi' : targetLang === 'te' ? 'Telugu' : 'English';

  const prompt = `Translate ALL string values in the following JSON object to ${langName}.
Keep all keys exactly the same. Keep numbers and null values unchanged.
Return ONLY the valid JSON, no markdown fences, no explanation.

${JSON.stringify(obj)}`;

  const result = await exports.generate(prompt);
  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return obj;
  }
};

/**
 * Generate crop advisory using Gemini when DB has no data.
 */
exports.generateAdvisory = async (crop, soilType, season) => {
  const prompt = `You are an expert Indian agricultural scientist. Generate detailed farming advisory for:
- Crop: ${crop}
- Soil type: ${soilType || 'general'}
- Season: ${season || 'general'}

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
