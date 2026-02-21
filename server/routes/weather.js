const express = require('express');
const router = express.Router();
const { getWeather } = require('../controllers/weatherController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getWeather);

module.exports = router;
