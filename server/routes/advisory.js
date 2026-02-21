const express = require('express');
const router = express.Router();
const { getAdvisory, getCrops } = require('../controllers/advisoryController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getAdvisory);
router.get('/crops', getCrops);

module.exports = router;
