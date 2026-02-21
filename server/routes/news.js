const express = require('express');
const router = express.Router();
const { getNews, getNewsById, generateAiNews } = require('../controllers/newsController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', getNews);
router.get('/:id', getNewsById);
router.post('/generate', protect, authorize('admin'), generateAiNews);

module.exports = router;
