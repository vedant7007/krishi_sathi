const { askFarmingAgent } = require('../utils/gemini');
const { getFarmerContext } = require('../utils/farmerContext');
const { getVoiceConfig, isGoodbye } = require('../utils/voiceConfig');
const User = require('../models/User');
const AlertLog = require('../models/AlertLog');

/**
 * Escape special XML characters for TwiML.
 */
function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build a TwiML <Say> element with proper voice/language.
 */
function say(text, voiceConfig) {
  return `<Say language="${voiceConfig.twimlLang}" voice="${voiceConfig.twimlVoice}">${escapeXml(text)}</Say>`;
}

/**
 * Build a TwiML <Gather> that listens for speech input, then routes to a URL.
 */
function gatherSpeech(actionUrl, voiceConfig, prompt, timeout = 5) {
  // Escape & to &amp; for valid XML (TwiML is XML)
  const safeUrl = actionUrl.replace(/&/g, '&amp;');
  return `<Gather input="speech" action="${safeUrl}" language="${voiceConfig.twimlLang}" speechTimeout="auto" timeout="${timeout}">
  ${say(prompt, voiceConfig)}
</Gather>`;
}

// ─── POST /api/voice/incoming — Entry point for calls ───
exports.incoming = async (req, res) => {
  try {
    const { From, userId, lang } = { ...req.query, ...req.body };

    // Try to find user by phone or userId
    let user = null;
    if (userId) {
      user = await User.findById(userId);
    }
    if (!user && From) {
      const phone = From.replace('+91', '').replace('+', '');
      user = await User.findOne({ phone: new RegExp(phone.slice(-10) + '$') });
    }

    if (user) {
      const userLang = lang || user.language || 'en';
      const vc = getVoiceConfig(userLang);

      if (user.role === 'admin') {
        // Admin IVR flow
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" numDigits="1" action="/api/voice/admin/menu">
    ${say('Welcome Admin. Press 1 for emergency alert. Press 2 for statistics.', getVoiceConfig('en'))}
  </Gather>
  ${say('No input received. Goodbye.', getVoiceConfig('en'))}
</Response>`;
        res.type('text/xml');
        return res.send(twiml);
      }

      // Farmer flow — start with language selection if no lang override
      if (!lang) {
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" numDigits="1" action="/api/voice/farmer/language?userId=${user._id}">
    ${say('Namaste! KrishiSathi mein aapka swagat hai.', getVoiceConfig('hi'))}
    ${say('Press 1 for Hindi. Press 2 for English. Press 3 for Telugu.', getVoiceConfig('en'))}
  </Gather>
  ${say(vc.callGreeting, vc)}
  <Redirect>/api/voice/farmer/agent?userId=${user._id}&amp;lang=${userLang}</Redirect>
</Response>`;
        res.type('text/xml');
        return res.send(twiml);
      }

      // Direct entry with known language (e.g., from callback)
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${say(vc.callGreeting, vc)}
  <Redirect>/api/voice/farmer/agent?userId=${user._id}&amp;lang=${userLang}</Redirect>
</Response>`;
      res.type('text/xml');
      return res.send(twiml);
    }

    // Unknown caller
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${say('Welcome to KrishiSathi. Please register on our app to use this service. Thank you!', getVoiceConfig('en'))}
  <Hangup/>
</Response>`;
    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('[IVR Incoming] Error:', error.message);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${say('Sorry, there was an error. Please try again later.', getVoiceConfig('en'))}
  <Hangup/>
</Response>`;
    res.type('text/xml');
    res.send(twiml);
  }
};

// ─── POST /api/voice/farmer/language — Language Selection ───
exports.farmerLanguage = async (req, res) => {
  const { Digits, userId } = { ...req.query, ...req.body };
  const langMap = { '1': 'hi', '2': 'en', '3': 'te' };
  const lang = langMap[Digits] || 'hi';
  const vc = getVoiceConfig(lang);

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${say(vc.callGreeting, vc)}
  <Redirect>/api/voice/farmer/agent?userId=${userId}&amp;lang=${lang}</Redirect>
</Response>`;
  res.type('text/xml');
  res.send(twiml);
};

// ─── POST /api/voice/farmer/agent — AI Conversation Loop ───
exports.farmerAgent = async (req, res) => {
  try {
    const { userId, lang } = { ...req.query, ...req.body };
    const speechResult = req.body.SpeechResult || '';
    const vc = getVoiceConfig(lang || 'hi');

    // If no speech yet, prompt the farmer
    if (!speechResult) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${gatherSpeech(`/api/voice/farmer/agent?userId=${userId}&lang=${lang}`, vc, vc.askMore)}
  ${say(vc.goodbye, vc)}
  <Hangup/>
</Response>`;
      res.type('text/xml');
      return res.send(twiml);
    }

    console.log(`[IVR Agent] Farmer ${userId} (${lang}): "${speechResult}"`);

    // Check for goodbye
    if (isGoodbye(speechResult)) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${say(vc.callGoodbye, vc)}
  <Hangup/>
</Response>`;
      res.type('text/xml');
      return res.send(twiml);
    }

    // Load farmer context and get AI response
    let responseText = vc.error;
    try {
      const user = await User.findById(userId);
      if (user) {
        const context = await getFarmerContext(user);
        responseText = await askFarmingAgent(speechResult, context, lang || 'hi');
      }
    } catch (err) {
      console.error('[IVR Agent] AI error:', err.message);
    }

    console.log(`[IVR Agent] Response: "${responseText.substring(0, 100)}..."`);

    // Speak response and loop back for more input
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${gatherSpeech(`/api/voice/farmer/agent?userId=${userId}&lang=${lang}`, vc, responseText, 6)}
  ${say(vc.goodbye, vc)}
  <Hangup/>
</Response>`;
    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('[IVR Agent] Error:', error.message);
    const vc = getVoiceConfig('en');
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${say(vc.error, vc)}
  <Hangup/>
</Response>`;
    res.type('text/xml');
    res.send(twiml);
  }
};

// ─── POST /api/voice/admin/menu — Admin Menu ───
exports.adminMenu = async (req, res) => {
  const { Digits } = req.body || {};
  const vc = getVoiceConfig('en');

  if (Digits === '1') {
    // Emergency alert flow — ask for district
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${gatherSpeech('/api/voice/admin/emergency-district', vc, 'Please say the name of the affected district.')}
  ${say('No input received. Goodbye.', vc)}
  <Hangup/>
</Response>`;
    res.type('text/xml');
    return res.send(twiml);
  }

  if (Digits === '2') {
    // Stats
    try {
      const [farmerCount, alertCount] = await Promise.all([
        User.countDocuments({ role: 'farmer' }),
        AlertLog.countDocuments(),
      ]);

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${say(`System statistics: ${farmerCount} registered farmers. ${alertCount} total alerts sent. Thank you.`, vc)}
  <Hangup/>
</Response>`;
      res.type('text/xml');
      return res.send(twiml);
    } catch {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${say('Unable to fetch statistics right now. Goodbye.', vc)}
  <Hangup/>
</Response>`;
      res.type('text/xml');
      return res.send(twiml);
    }
  }

  // Invalid input
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${say('Invalid option. Goodbye.', vc)}
  <Hangup/>
</Response>`;
  res.type('text/xml');
  res.send(twiml);
};

// ─── POST /api/voice/admin/emergency-district — Capture District ───
exports.adminEmergencyDistrict = async (req, res) => {
  const district = req.body.SpeechResult || '';
  const vc = getVoiceConfig('en');

  if (!district) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${say('I did not catch that. Goodbye.', vc)}
  <Hangup/>
</Response>`;
    res.type('text/xml');
    return res.send(twiml);
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${gatherSpeech(`/api/voice/admin/emergency-type?district=${encodeURIComponent(district)}`, vc, `District is ${district}. Now please say the type of emergency. For example: flood, cyclone, drought, pest outbreak.`)}
  ${say('No input received. Goodbye.', vc)}
  <Hangup/>
</Response>`;
  res.type('text/xml');
  res.send(twiml);
};

// ─── POST /api/voice/admin/emergency-type — Capture Emergency Type ───
exports.adminEmergencyType = async (req, res) => {
  const district = req.query.district || req.body.district || '';
  const emergencyType = req.body.SpeechResult || '';
  const vc = getVoiceConfig('en');

  if (!emergencyType) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${say('I did not catch that. Goodbye.', vc)}
  <Hangup/>
</Response>`;
    res.type('text/xml');
    return res.send(twiml);
  }

  // Map spoken type to enum
  const typeMap = {
    flood: 'flood', cyclone: 'cyclone', frost: 'frost',
    heatwave: 'heatwave', heat: 'heatwave', pest: 'pest_outbreak',
    drought: 'drought', rain: 'heavy_rain', heavy: 'heavy_rain',
  };
  const lower = emergencyType.toLowerCase();
  const mappedType = Object.keys(typeMap).find((k) => lower.includes(k));
  const alertType = mappedType ? typeMap[mappedType] : 'other';

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" numDigits="1" action="/api/voice/admin/emergency-confirm?district=${encodeURIComponent(district)}&amp;type=${alertType}">
    ${say(`Sending ${alertType.replace('_', ' ')} alert to farmers in ${district}. Press 1 to confirm or 2 to cancel.`, vc)}
  </Gather>
  ${say('No input. Alert cancelled. Goodbye.', vc)}
  <Hangup/>
</Response>`;
  res.type('text/xml');
  res.send(twiml);
};

// ─── POST /api/voice/admin/emergency-confirm — Confirm & Send ───
exports.adminEmergencyConfirm = async (req, res) => {
  const { district, type } = { ...req.query, ...req.body };
  const digit = req.body.Digits || '';
  const vc = getVoiceConfig('en');

  if (digit !== '1') {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${say('Alert cancelled. Goodbye.', vc)}
  <Hangup/>
</Response>`;
    res.type('text/xml');
    return res.send(twiml);
  }

  try {
    // Find affected farmers
    const farmers = await User.find({
      role: 'farmer',
      district: new RegExp(district, 'i'),
    }).lean();

    const message = `EMERGENCY: ${type.replace('_', ' ').toUpperCase()} alert for ${district}. Please take immediate precautions. Stay safe. - KrishiSathi`;

    // Create alert log
    const alertLog = await AlertLog.create({
      type,
      severity: 'CRITICAL',
      title: `${type.replace('_', ' ').toUpperCase()} - ${district}`,
      message,
      affectedDistricts: [district],
      channels: { sms: true, whatsapp: true, voice: false },
      recipientCount: farmers.length,
      sentBy: null, // Phone call — no JWT user
      status: 'sending',
    });

    // Broadcast
    const { broadcastAlert } = require('../utils/twilio');
    const result = await broadcastAlert(
      { title: alertLog.title, message, severity: 'CRITICAL', channels: ['sms', 'whatsapp'] },
      farmers
    );

    alertLog.status = 'sent';
    await alertLog.save();

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${say(`Alert sent successfully. ${result.sent} messages delivered to farmers in ${district}. Thank you.`, vc)}
  <Hangup/>
</Response>`;
    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('[IVR Emergency] Error:', error.message);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${say('Failed to send alert. Please try from the app. Goodbye.', vc)}
  <Hangup/>
</Response>`;
    res.type('text/xml');
    res.send(twiml);
  }
};

// ─── POST /api/voice/status — Call Status Webhook ───
exports.callStatus = (req, res) => {
  const { CallSid, CallStatus, To } = req.body || {};
  console.log(`[IVR Status] SID: ${CallSid} | Status: ${CallStatus} | To: ${To}`);
  res.sendStatus(200);
};
