const express = require('express');
const router = express.Router();
const {
  getNotifications,
  getUnreadCount,
  generateSmartNotifications,
  markAllAsRead,
  markAsRead,
  deleteNotification,
  createNotification,
} = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.get('/', protect, getNotifications);
router.get('/unread-count', protect, getUnreadCount);
router.post('/generate', protect, generateSmartNotifications);
router.put('/read-all', protect, markAllAsRead);
router.put('/:id/read', protect, markAsRead);
router.delete('/:id', protect, deleteNotification);
router.post('/', protect, authorize('admin'), createNotification);

module.exports = router;
