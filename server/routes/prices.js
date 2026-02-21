const express = require('express');
const router = express.Router();
const { getPrices, getPriceHistory, getSellRecommendation } = require('../controllers/pricesController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getPrices);
router.get('/history', protect, getPriceHistory);
router.get('/sell-recommendation', protect, getSellRecommendation);

module.exports = router;
