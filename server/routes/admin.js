const express = require('express');
const router = express.Router();
const {
  getCropRules,
  createCropRule,
  updateCropRule,
  deleteCropRule,
  getMarketPrices,
  createMarketPrice,
  getAdminSchemes,
  createScheme,
  updateScheme,
  deleteScheme,
  getAdminNews,
  createNews,
  updateNews,
  deleteNews,
  getUsers,
  deleteUser,
  updateUserRole,
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
router.get('/schemes', getAdminSchemes);
router.post('/schemes', createScheme);
router.put('/schemes/:id', updateScheme);
router.delete('/schemes/:id', deleteScheme);
router.get('/news', getAdminNews);
router.post('/news', createNews);
router.put('/news/:id', updateNews);
router.delete('/news/:id', deleteNews);
router.get('/users', getUsers);
router.delete('/users/:id', deleteUser);
router.put('/users/:id/role', updateUserRole);

module.exports = router;
