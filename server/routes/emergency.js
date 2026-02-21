const express = require('express');
const router = express.Router();
const { createAlert, getAlerts, getAlertStats, deleteAlert } = require('../controllers/emergencyController');
const { protect, authorize } = require('../middleware/auth');

router.post('/alert', protect, authorize('admin'), createAlert);
router.get('/alerts', protect, getAlerts);
router.get('/stats', protect, authorize('admin'), getAlertStats);
router.delete('/alerts/:id', protect, authorize('admin'), deleteAlert);

module.exports = router;
