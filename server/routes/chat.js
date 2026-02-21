const express = require('express');
const router = express.Router();
const { sendMessage, translateContent, getTTSAudio, getSTTToken } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

router.post('/', protect, sendMessage);
router.post('/translate', protect, translateContent);
router.post('/tts', protect, getTTSAudio);
router.get('/stt-token', protect, getSTTToken);

module.exports = router;
