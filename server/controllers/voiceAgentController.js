const { AccessToken } = require('livekit-server-sdk');
const { askFarmingAgent } = require('../utils/gemini');
const { getFarmerContext } = require('../utils/farmerContext');
const { getVoiceConfig } = require('../utils/voiceConfig');
const { sendSMS, sendWhatsApp, broadcastAlert } = require('../utils/twilio');
const User = require('../models/User');
const AlertLog = require('../models/AlertLog');
const axios = require('axios');

// In-memory TTS cache for common responses (greetings, goodbyes)
const ttsCache = new Map();

// ─── POST /api/agent/token — Generate LiveKit Room Token ───
exports.generateToken = async (req, res, next) => {
  try {
    const user = req.user;
    const roomName = `krishisathi-${user._id}`;

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      { identity: user._id.toString(), name: user.name || 'Farmer' }
    );

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    console.log(`[Agent Token] Generated for ${user.name} | room: ${roomName}`);

    res.json({
      success: true,
      data: {
        token,
        roomName,
        wsUrl: process.env.LIVEKIT_URL,
      },
    });
  } catch (error) {
    console.error('[Agent Token] Error:', error.message);
    next(error);
  }
};

// ─── POST /api/agent/context — Load Farmer Context ───
exports.getContext = async (req, res, next) => {
  try {
    const context = await getFarmerContext(req.user);
    res.json({ success: true, data: context });
  } catch (error) {
    console.error('[Agent Context] Error:', error.message);
    next(error);
  }
};

// ─── POST /api/agent/process — Process Voice Query ───
exports.processVoiceQuery = async (req, res, next) => {
  try {
    const { text, language } = req.body;

    if (!text) {
      return res.status(400).json({ success: false, message: 'Text is required' });
    }

    const lang = language || req.user.language || 'en';

    console.log(`[Agent Process] ${req.user.name} (${lang}): "${text}"`);

    // Load context + call AI with a hard 12s timeout so voice agent stays responsive
    const timeoutFallback = {
      hi: 'Maaf keejiye ji, abhi server par load hai. Thodi der mein dobara poochiye.',
      te: 'Kshaminchandi garu, server lo load ekkuva undi. Koddisepatiki malli adagandi.',
      en: 'Sorry, the server is busy right now. Please try again in a moment.',
    };

    let responseText;
    try {
      const result = await Promise.race([
        (async () => {
          const context = await getFarmerContext(req.user);
          return askFarmingAgent(text, context, lang);
        })(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('VOICE_TIMEOUT')), 12000)),
      ]);
      responseText = result;
    } catch (err) {
      console.warn(`[Agent Process] ${err.message === 'VOICE_TIMEOUT' ? 'Timed out after 12s' : err.message}`);
      responseText = timeoutFallback[lang] || timeoutFallback.en;
    }

    // Detect source category from the query
    const lower = text.toLowerCase();
    let source = 'general';
    if (/weather|rain|mausam|barish|vaatavaran/i.test(lower)) source = 'weather';
    else if (/price|mandi|daam|bhav|dhara|market/i.test(lower)) source = 'prices';
    else if (/fertili|pest|khad|spray|sowing|harvest|fasal|panta/i.test(lower)) source = 'advisory';
    else if (/scheme|yojana|subsidy|sarkar|government|pathak/i.test(lower)) source = 'schemes';

    console.log(`[Agent Process] Response (${source}): "${responseText.substring(0, 100)}..."`);

    res.json({
      success: true,
      data: {
        text: responseText,
        source,
        language: lang,
      },
    });
  } catch (error) {
    console.error('[Agent Process] Error:', error.message);
    next(error);
  }
};

// ─── POST /api/agent/tts — Generate Murf TTS Audio ───
exports.generateTTS = async (req, res, next) => {
  try {
    const { text, language } = req.body;

    if (!text) {
      return res.status(400).json({ success: false, message: 'Text is required' });
    }

    const lang = language || 'en';
    const voiceConfig = getVoiceConfig(lang);

    // Check cache for common responses
    const cacheKey = `${lang}:${text.substring(0, 100)}`;
    if (ttsCache.has(cacheKey)) {
      console.log('[TTS] Cache hit');
      const cached = ttsCache.get(cacheKey);
      res.set('Content-Type', 'audio/wav');
      return res.send(cached);
    }

    const murfApiKey = process.env.MURF_API_KEY;
    if (!murfApiKey) {
      // Fallback to Deepgram TTS if Murf key not available
      return fallbackToDeepgramTTS(text, lang, res, next);
    }

    // Call Murf API
    const murfResponse = await axios({
      method: 'POST',
      url: 'https://api.murf.ai/v1/speech/generate',
      headers: {
        'Content-Type': 'application/json',
        'api-key': murfApiKey,
      },
      data: {
        text,
        voiceId: voiceConfig.murfVoiceId,
        style: voiceConfig.murfStyle,
        format: 'WAV',
        sampleRate: 24000,
        channelType: 'MONO',
      },
      responseType: 'arraybuffer',
      timeout: 15000,
    });

    const audioBuffer = Buffer.from(murfResponse.data);

    // Cache common responses (greetings, goodbyes, etc.)
    if (text.length < 200) {
      ttsCache.set(cacheKey, audioBuffer);
      // Limit cache size
      if (ttsCache.size > 100) {
        const firstKey = ttsCache.keys().next().value;
        ttsCache.delete(firstKey);
      }
    }

    res.set('Content-Type', 'audio/wav');
    res.send(audioBuffer);
  } catch (error) {
    console.error('[TTS Murf] Error:', error.message);
    // Fallback to Deepgram TTS
    const { text, language } = req.body;
    return fallbackToDeepgramTTS(text, language || 'en', res, next);
  }
};

async function fallbackToDeepgramTTS(text, language, res, next) {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'No TTS service configured' });
    }

    console.log('[TTS] Falling back to Deepgram');
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
      timeout: 15000,
    });

    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(response.data));
  } catch (err) {
    console.error('[TTS Deepgram Fallback] Error:', err.message);
    next(err);
  }
}

// ─── POST /api/agent/request-callback — "Call Me" Button ───
exports.requestCallback = async (req, res, next) => {
  try {
    const user = req.user;
    const phone = user.phone;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'No phone number on profile' });
    }

    const lang = user.language || 'en';
    const voiceConfig = getVoiceConfig(lang);
    const baseUrl = process.env.BASE_URL;

    if (!baseUrl) {
      return res.status(500).json({ success: false, message: 'BASE_URL not configured' });
    }

    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    // Normalize phone to E.164
    let normalizedPhone = phone.replace(/\s+/g, '');
    if (!normalizedPhone.startsWith('+')) normalizedPhone = '+91' + normalizedPhone;

    // Initiate outbound call — Twilio will hit our IVR webhook
    const call = await client.calls.create({
      to: normalizedPhone,
      from: process.env.TWILIO_PHONE_NUMBER,
      url: `${baseUrl}/api/voice/incoming?userId=${user._id}&lang=${lang}`,
      statusCallback: `${baseUrl}/api/voice/status`,
      statusCallbackEvent: ['completed', 'failed', 'no-answer'],
    });

    console.log(`[Callback] Call initiated to ${normalizedPhone} | SID: ${call.sid}`);

    res.json({
      success: true,
      message: voiceConfig.callMeConfirm,
      data: { callSid: call.sid },
    });
  } catch (error) {
    console.error('[Callback] Error:', error.message);
    next(error);
  }
};

// ─── POST /api/agent/whatsapp-alert — WhatsApp Emergency Alert (Admin) ───
exports.sendWhatsAppAlert = async (req, res, next) => {
  try {
    const { alertType, district, severity, message } = req.body;

    if (!alertType || !district || !message) {
      return res.status(400).json({
        success: false,
        message: 'alertType, district, and message are required',
      });
    }

    // Find farmers in the affected district with alerts enabled
    const farmers = await User.find({
      role: 'farmer',
      district: new RegExp(district, 'i'),
      $or: [
        { 'alertPreferences.whatsapp': true },
        { 'alertPreferences.sms': true },
      ],
    }).lean();

    if (farmers.length === 0) {
      return res.json({
        success: true,
        data: { farmersNotified: 0, farmersReached: 0 },
        message: 'No farmers found in this district with alerts enabled',
      });
    }

    // Create alert log
    const alertLog = await AlertLog.create({
      type: alertType,
      severity: severity || 'WARNING',
      title: `${alertType.toUpperCase()} Alert - ${district}`,
      message,
      affectedDistricts: [district],
      channels: { sms: true, whatsapp: true, voice: false },
      recipientCount: farmers.length,
      sentBy: req.user._id,
      status: 'sending',
    });

    // Broadcast via existing Twilio utility
    const alertPayload = {
      title: alertLog.title,
      message,
      severity: severity || 'WARNING',
      channels: ['whatsapp', 'sms'],
    };

    const result = await broadcastAlert(alertPayload, farmers);

    // Update alert status
    alertLog.status = result.failed === 0 ? 'sent' : 'sent';
    await alertLog.save();

    console.log(`[WhatsApp Alert] ${result.sent} sent, ${result.failed} failed | District: ${district}`);

    res.json({
      success: true,
      data: {
        farmersNotified: farmers.length,
        farmersReached: result.sent,
        failed: result.failed,
        alertId: alertLog._id,
      },
    });
  } catch (error) {
    console.error('[WhatsApp Alert] Error:', error.message);
    next(error);
  }
};
