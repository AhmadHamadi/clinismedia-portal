const express = require('express');
const router = express.Router();
const { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } = require('../controllers/notificationController');
const authenticateToken = require('../middleware/authenticateToken'); // Correct middleware name
const authorizeRole = require('../middleware/authorizeRole'); // Assuming you have an authorizeRole middleware

// Get notifications for the authenticated user
router.get('/', authenticateToken, getNotifications);

// Mark a notification as read
router.put('/:id/read', authenticateToken, markNotificationAsRead);

// Mark all notifications as read
router.put('/mark-all-read', authenticateToken, markAllNotificationsAsRead);

module.exports = router; 