const express = require('express');
const router = express.Router();
const { sendMessage, translateContent } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

router.post('/', protect, sendMessage);
router.post('/translate', protect, translateContent);

module.exports = router;
