const router = require('express').Router();
const ivrCtrl = require('../controllers/voiceIVRController');

// Twilio IVR webhooks — NO JWT auth (Twilio calls these directly)

// Entry point for incoming/outbound calls
router.post('/incoming', ivrCtrl.incoming);

// Farmer IVR flow
router.post('/farmer/language', ivrCtrl.farmerLanguage);
router.post('/farmer/agent', ivrCtrl.farmerAgent);

// Admin IVR flow
router.post('/admin/menu', ivrCtrl.adminMenu);
router.post('/admin/emergency-district', ivrCtrl.adminEmergencyDistrict);
router.post('/admin/emergency-type', ivrCtrl.adminEmergencyType);
router.post('/admin/emergency-confirm', ivrCtrl.adminEmergencyConfirm);

// Call status webhook
router.post('/status', ivrCtrl.callStatus);

module.exports = router;
