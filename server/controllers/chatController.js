const { generate } = require('../utils/gemini');
const axios = require('axios');

// POST /api/chat
exports.sendMessage = async (req, res, next) => {
  try {
    const { message, language, context, history } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const langName = language === 'hi' ? 'Hindi' : language === 'te' ? 'Telugu' : 'English';

    const systemPrompt = `You are KrishiSathi — a wise, warm, and deeply knowledgeable AI farming assistant built for Indian farmers.

Personality & Tone:
- You speak like a trusted village elder who has decades of farming wisdom combined with modern agricultural science.
- You are warm, patient, and encouraging. You never talk down to the farmer.
- You use simple, everyday language that even a farmer with minimal formal education can understand easily.
- When speaking in Hindi, you use the kind of spoken Hindi common in rural North India (not overly formal Shudh Hindi).
- You genuinely care about the farmer's well-being and livelihood.

Deep Expertise Areas:
- Crop lifecycle management: sowing seasons (Kharif, Rabi, Zaid), seed selection, nursery preparation, transplanting, flowering, harvesting timelines
- Soil health: NPK ratios, pH management, organic matter, soil testing interpretation, micro-nutrients (zinc, boron, iron)
- Pest & disease identification: common pests by crop (bollworm, stem borer, aphids, whitefly), fungal/bacterial/viral diseases, IPM strategies
- Fertilizer & nutrient management: urea, DAP, MOP, SSP dosing schedules, foliar sprays, vermicompost, jeevamrit, bio-fertilizers
- Irrigation: drip, sprinkler, flood irrigation pros/cons, water scheduling, moisture conservation techniques
- Organic & natural farming: zero-budget natural farming (ZBNF), Subhash Palekar methods, neem-based solutions, panchagavya
- Government schemes: PM-KISAN, PM Fasal Bima Yojana, soil health card, KCC (Kisan Credit Card), MSP updates
- Market intelligence: mandi prices, APMC regulations, when to sell, storage best practices
- Weather-based advisories: what to do before/during/after heavy rain, heatwave, frost, hailstorm
- Livestock integration: dairy, poultry, goat rearing alongside crop farming

${context?.crop ? `Current crop the farmer is growing: ${context.crop}` : ''}
${context?.district ? `Farmer's location: ${context.district}${context?.state ? ', ' + context.state : ''}` : ''}

Response Rules:
- ALWAYS respond in ${langName} language
- Keep responses concise (under 150 words) and highly actionable
- Structure advice in short points when listing steps
- If the farmer describes a plant symptom, try to diagnose and suggest both chemical and organic remedies
- If asked about prices, mention they should check the Market Prices section for live rates
- If asked about weather, mention they should check the Weather section for forecasts
- When you don't know something specific, say so honestly and suggest who they could ask (like their local KVK or agriculture officer)
- End responses with a brief encouraging line when appropriate`;

    // Build multi-turn conversation prompt
    let conversationPrompt = `System: ${systemPrompt}\n\n`;

    // Append conversation history if provided
    if (history && Array.isArray(history) && history.length > 0) {
      for (const turn of history) {
        if (turn.role === 'user') {
          conversationPrompt += `Farmer: ${turn.content}\n`;
        } else if (turn.role === 'assistant') {
          conversationPrompt += `KrishiSathi: ${turn.content}\n`;
        }
      }
      conversationPrompt += '\n';
    }

    // Append the current message
    conversationPrompt += `Farmer: ${message}\nKrishiSathi:`;

    const response = await generate(conversationPrompt);

    res.json({
      success: true,
      data: { response: response.trim() },
    });
  } catch (error) {
    console.error('Chat error:', error.message);
    const { language } = req.body || {};
    // Graceful fallback for rate limits
    if (error.message?.includes('429') || error.message?.includes('quota')) {
      return res.json({
        success: true,
        data: {
          response: language === 'hi'
            ? 'क्षमा करें, AI सेवा अभी व्यस्त है। कृपया थोड़ी देर बाद पुनः प्रयास करें।'
            : language === 'te'
            ? 'క్షమించండి, AI సేవ ప్రస్తుతం బిజీగా ఉంది. దయచేసి కొద్దిసేపటి తర్వాత మళ్ళీ ప్రయత్నించండి.'
            : 'AI service is currently busy. Please try again in a moment.',
        },
      });
    }
    next(error);
  }
};

// POST /api/chat/tts
exports.getTTSAudio = async (req, res, next) => {
  try {
    const { text, language } = req.body;

    if (!text) {
      return res.status(400).json({ success: false, message: 'Text is required' });
    }

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'Deepgram API key not configured' });
    }

    // Deepgram doesn't have Hindi TTS models yet, so we use English TTS as fallback
    const model = 'aura-asteria-en';

    const response = await axios({
      method: 'POST',
      url: `https://api.deepgram.com/v1/speak?model=${model}`,
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      data: { text },
      responseType: 'arraybuffer',
    });

    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error('TTS error:', error.message);
    next(error);
  }
};

// GET /api/chat/stt-token
exports.getSTTToken = async (req, res, next) => {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'Deepgram API key not configured' });
    }

    // For hackathon: return the API key directly
    // In production: generate a temporary scoped key via Deepgram's API
    res.json({
      success: true,
      data: { key: apiKey },
    });
  } catch (error) {
    console.error('STT token error:', error.message);
    next(error);
  }
};

// POST /api/chat/translate
exports.translateContent = async (req, res, next) => {
  try {
    const { texts, targetLang } = req.body;

    if (!texts || !targetLang || targetLang === 'en') {
      return res.json({ success: true, data: { translations: texts } });
    }

    const langName = targetLang === 'hi' ? 'Hindi' : targetLang === 'te' ? 'Telugu' : 'English';

    const prompt = `Translate each text in the following JSON array to ${langName}.
Return ONLY a JSON array of translated strings (same order, same length).
No markdown fences, no explanation.

${JSON.stringify(texts)}`;

    const result = await generate(prompt);
    try {
      const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const translations = JSON.parse(cleaned);
      return res.json({ success: true, data: { translations } });
    } catch {
      return res.json({ success: true, data: { translations: texts } });
    }
  } catch (error) {
    next(error);
  }
};
