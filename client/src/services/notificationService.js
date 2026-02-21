import api from './api';

/**
 * Get notifications with optional filters.
 * @param {object} params - { unreadOnly, page, limit }
 */
export const getNotifications = (params = {}) =>
  api.get('/notifications', { params }).then((res) => res.data);

/**
 * Get count of unread notifications.
 */
export const getUnreadCount = () =>
  api.get('/notifications/unread-count').then((res) => res.data);

/**
 * Mark a single notification as read.
 * @param {string} id - Notification ID
 */
export const markAsRead = (id) =>
  api.put(`/notifications/${id}/read`).then((res) => res.data);

/**
 * Mark all notifications as read.
 */
export const markAllAsRead = () =>
  api.put('/notifications/read-all').then((res) => res.data);

/**
 * Delete a single notification.
 * @param {string} id - Notification ID
 */
export const deleteNotification = (id) =>
  api.delete(`/notifications/${id}`).then((res) => res.data);

/**
 * Generate smart notifications based on user's farm data.
 */
export const generateSmartNotifications = () =>
  api.post('/notifications/generate').then((res) => res.data);

/**
 * Create a notification manually (admin).
 * @param {object} data - { title, message, type, priority, ... }
 */
export const createNotification = (data) =>
  api.post('/notifications', data).then((res) => res.data);
