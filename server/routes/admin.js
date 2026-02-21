const express = require('express');
const router = express.Router();
const {
  getCropRules,
  createCropRule,
  updateCropRule,
  deleteCropRule,
  getMarketPrices,
  createMarketPrice,
  createScheme,
  updateScheme,
  deleteScheme,
  createNews,
  updateNews,
  deleteNews,
  getDashboardStats
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/stats', getDashboardStats);
router.get('/crop-rules', getCropRules);
router.post('/crop-rules', createCropRule);
router.put('/crop-rules/:id', updateCropRule);
router.delete('/crop-rules/:id', deleteCropRule);
router.get('/prices', getMarketPrices);
router.post('/prices', createMarketPrice);
router.post('/schemes', createScheme);
router.put('/schemes/:id', updateScheme);
router.delete('/schemes/:id', deleteScheme);
router.post('/news', createNews);
router.put('/news/:id', updateNews);
router.delete('/news/:id', deleteNews);

module.exports = router;
