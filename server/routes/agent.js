const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const agentCtrl = require('../controllers/voiceAgentController');

// LiveKit token for in-app voice
router.post('/token', protect, agentCtrl.generateToken);
router.post('/context', protect, agentCtrl.getContext);
router.post('/process', protect, agentCtrl.processVoiceQuery);
router.post('/tts', protect, agentCtrl.generateTTS);

// Phone callback
router.post('/request-callback', protect, agentCtrl.requestCallback);

// WhatsApp alerts (admin only)
router.post('/whatsapp-alert', protect, authorize('admin'), agentCtrl.sendWhatsAppAlert);

module.exports = router;
