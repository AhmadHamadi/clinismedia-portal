const express = require('express');
const router = express.Router();
const CustomerNotification = require('../models/CustomerNotification');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

// Get customer notifications
router.get('/', authenticateToken, authorizeRole('customer'), async (req, res) => {
  try {
    const notifications = await CustomerNotification.find({ 
      customer: req.user._id,
      isRead: false 
    }).sort({ createdAt: -1 });
    
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get notification counts by type
router.get('/counts', authenticateToken, authorizeRole('customer'), async (req, res) => {
  try {
    const counts = await CustomerNotification.aggregate([
      { $match: { customer: req.user._id, isRead: false } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);
    
    const result = {
      meta_insights: 0,
      invoice: 0,
      gallery: 0
    };
    
    counts.forEach(item => {
      result[item._id] = item.count;
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark notifications as read by type
router.patch('/mark-read/:type', authenticateToken, authorizeRole('customer'), async (req, res) => {
  try {
    const { type } = req.params;
    
    await CustomerNotification.updateMany(
      { 
        customer: req.user._id, 
        type: type,
        isRead: false 
      },
      { isRead: true }
    );
    
    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark specific notification as read
router.patch('/:id/read', authenticateToken, authorizeRole('customer'), async (req, res) => {
  try {
    const notification = await CustomerNotification.findOneAndUpdate(
      { _id: req.params.id, customer: req.user._id },
      { isRead: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 