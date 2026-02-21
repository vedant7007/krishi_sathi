const { generate } = require('../utils/gemini');

// POST /api/chat
exports.sendMessage = async (req, res, next) => {
  try {
    const { message, language, context } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const langName = language === 'hi' ? 'Hindi' : language === 'te' ? 'Telugu' : 'English';

    const systemPrompt = `You are KrishiSathi, an AI farming assistant for Indian farmers.
You can answer questions about ANY crop, farming technique, weather, soil, fertilizers,
pesticides, irrigation, government schemes, market prices, organic farming, and more.

${context?.crop ? `The farmer grows: ${context.crop}` : ''}
${context?.district ? `Location: ${context.district}${context?.state ? ', ' + context.state : ''}` : ''}

Rules:
- Respond in ${langName} language
- Be concise (under 150 words), practical, and farmer-friendly
- Use simple language that rural farmers understand
- Give actionable advice
- If asked about prices, suggest checking the Market Prices section
- If asked about weather, suggest checking the Weather section`;

    const prompt = `${systemPrompt}\n\nFarmer's question: ${message}`;
    const response = await generate(prompt);

    res.json({
      success: true,
      data: { response: response.trim() },
    });
  } catch (error) {
    console.error('Chat error:', error.message);
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
