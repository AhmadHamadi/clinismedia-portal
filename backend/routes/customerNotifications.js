const express = require('express');
const router = express.Router();
const CustomerNotification = require('../models/CustomerNotification');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

// Get unread counts for a customer
router.get('/unread-counts', authenticateToken, authorizeRole('customer'), async (req, res) => {
  try {
    let notification = await CustomerNotification.findOne({ customerId: req.user._id });
    
    // If no notification record exists, create one with default values
    if (!notification) {
      notification = new CustomerNotification({ customerId: req.user._id });
      await notification.save();
    }
    
    res.json({
      metaInsights: notification.metaInsights.unreadCount,
      gallery: notification.gallery.unreadCount,
      invoices: notification.invoices.unreadCount,
      onboarding: notification.onboarding.unreadCount
    });
  } catch (error) {
    console.error('Error fetching unread counts:', error);
    res.status(500).json({ message: 'Failed to fetch unread counts' });
  }
});

// Mark a section as read (clear unread count)
router.post('/mark-read/:section', authenticateToken, authorizeRole('customer'), async (req, res) => {
  try {
    const { section } = req.params;
    const validSections = ['metaInsights', 'gallery', 'invoices', 'onboarding'];
    
    if (!validSections.includes(section)) {
      return res.status(400).json({ message: 'Invalid section' });
    }
    
    let notification = await CustomerNotification.findOne({ customerId: req.user._id });
    
    if (!notification) {
      notification = new CustomerNotification({ customerId: req.user._id });
    }
    
    // Clear the unread count for the specified section
    notification[section].unreadCount = 0;
    notification[section].lastUpdated = new Date();
    
    await notification.save();
    
    res.json({ message: `${section} marked as read`, unreadCount: 0 });
  } catch (error) {
    console.error('Error marking section as read:', error);
    res.status(500).json({ message: 'Failed to mark section as read' });
  }
});

// Mark all sections as read (for notifications page)
router.post('/mark-all-read', authenticateToken, authorizeRole('customer'), async (req, res) => {
  try {
    let notification = await CustomerNotification.findOne({ customerId: req.user._id });
    
    if (!notification) {
      notification = new CustomerNotification({ customerId: req.user._id });
    }
    
    // Clear all unread counts
    notification.metaInsights.unreadCount = 0;
    notification.gallery.unreadCount = 0;
    notification.invoices.unreadCount = 0;
    notification.onboarding.unreadCount = 0;
    
    // Update timestamps
    const now = new Date();
    notification.metaInsights.lastUpdated = now;
    notification.gallery.lastUpdated = now;
    notification.invoices.lastUpdated = now;
    notification.onboarding.lastUpdated = now;
    
    await notification.save();
    
    res.json({ message: 'All sections marked as read' });
  } catch (error) {
    console.error('Error marking all sections as read:', error);
    res.status(500).json({ message: 'Failed to mark all sections as read' });
  }
});

// Admin endpoint: Increment unread count for a customer section
router.post('/increment/:customerId/:section', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { customerId, section } = req.params;
    const validSections = ['metaInsights', 'gallery', 'invoices', 'onboarding'];
    
    if (!validSections.includes(section)) {
      return res.status(400).json({ message: 'Invalid section' });
    }
    
    let notification = await CustomerNotification.findOne({ customerId });
    
    if (!notification) {
      notification = new CustomerNotification({ customerId });
    }
    
    // Increment the unread count for the specified section
    notification[section].unreadCount += 1;
    notification[section].lastUpdated = new Date();
    
    await notification.save();
    
    res.json({ 
      message: `${section} unread count incremented for customer`,
      unreadCount: notification[section].unreadCount
    });
  } catch (error) {
    console.error('Error incrementing unread count:', error);
    res.status(500).json({ message: 'Failed to increment unread count' });
  }
});

module.exports = router;
