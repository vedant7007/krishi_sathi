const express = require('express');
const router = express.Router();
const { createAlert, getAlerts, getAlertStats } = require('../controllers/emergencyController');
const { protect, authorize } = require('../middleware/auth');

router.post('/alert', protect, authorize('admin'), createAlert);
router.get('/alerts', protect, getAlerts);
router.get('/stats', protect, authorize('admin'), getAlertStats);

module.exports = router;
