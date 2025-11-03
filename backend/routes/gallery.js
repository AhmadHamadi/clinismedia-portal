const express = require('express');
const router = express.Router();
const GalleryItem = require('../models/GalleryItem');
const AssignedGalleryItem = require('../models/AssignedGalleryItem');
const User = require('../models/User');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

// Get all gallery items (admin only)
router.get('/', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const galleryItems = await GalleryItem.find().sort({ date: -1 });
    res.json(galleryItems);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new gallery item (admin only)
router.post('/', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { name, url } = req.body;
    const galleryItem = new GalleryItem({ name, url });
    await galleryItem.save();
    res.status(201).json(galleryItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a gallery item (admin only)
router.put('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { name, url, date } = req.body;
    const update = { name, url };
    if (date) update.date = date;
    const galleryItem = await GalleryItem.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );
    if (!galleryItem) return res.status(404).json({ error: 'Gallery item not found' });
    res.json(galleryItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a gallery item (admin only)
router.delete('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const galleryItem = await GalleryItem.findByIdAndDelete(req.params.id);
    if (!galleryItem) return res.status(404).json({ error: 'Gallery item not found' });
    
    // Also delete all assignments for this item
    await AssignedGalleryItem.deleteMany({ galleryItemId: req.params.id });
    
    res.json({ message: 'Gallery item deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign gallery items to a clinic (admin only)
router.post('/assign', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { clinicId, galleryItemIds } = req.body;
    
    // First, set all existing assignments for this clinic to not current
    await AssignedGalleryItem.updateMany(
      { clinicId },
      { isCurrent: false }
    );
    
    // Create new assignments
    const assignments = [];
    for (const galleryItemId of galleryItemIds) {
      const assignment = new AssignedGalleryItem({
        clinicId,
        galleryItemId,
        isCurrent: true
      });
      assignments.push(assignment);
    }
    
    await AssignedGalleryItem.insertMany(assignments);
    
    // Automatically increment customer notification count for gallery
    try {
      const CustomerNotification = require('../models/CustomerNotification');
      let notification = await CustomerNotification.findOne({ customerId: clinicId });
      
      if (!notification) {
        notification = new CustomerNotification({ customerId: clinicId });
      }
      
      notification.gallery.unreadCount += 1;
      notification.gallery.lastUpdated = new Date();
      await notification.save();
      
      console.log(`✅ Gallery notification incremented for customer ${clinicId}`);
    } catch (notificationError) {
      console.error('❌ Failed to increment gallery notification:', notificationError);
      // Don't fail the main operation if notification fails
    }
    
    // Send email notification to customer about new gallery content
    try {
      const customer = await User.findById(clinicId);
      if (customer && customer.email) {
        const EmailService = require('../services/emailService');
        const portalLink = `https://clinimediaportal.ca/customer/gallery`;
        await EmailService.sendNewContentNotification(
          customer.name,
          customer.email,
          'Gallery',
          portalLink,
          'New Gallery Items'
        );
        console.log(`✅ Gallery content notification email sent to ${customer.email}`);
      }
    } catch (emailError) {
      console.error('❌ Failed to send gallery content notification email:', emailError);
      // Don't fail the main operation if email fails
    }
    
    res.json({ message: 'Gallery items assigned successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get assigned gallery items for a clinic (customer portal)
router.get('/assigned/:clinicId', authenticateToken, authorizeRole(['admin', 'customer']), async (req, res) => {
  try {
    const { clinicId } = req.params;
    const assigned = await AssignedGalleryItem.find({ clinicId })
      .populate('galleryItemId')
      .sort({ assignedAt: -1 });
    
    res.json(assigned);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all clinics and their assigned gallery items (admin overview)
router.get('/assignments/all', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const clinics = await User.find({ role: 'customer' });
    const assignments = await AssignedGalleryItem.find()
      .populate('galleryItemId clinicId')
      .sort({ assignedAt: -1 });
    
    res.json({ clinics, assignments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update assignment status (admin only)
router.post('/update-assignment', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { clinicId, galleryItemId, isCurrent } = req.body;
    
    if (isCurrent) {
      // Set all other assignments for this clinic to not current
      await AssignedGalleryItem.updateMany(
        { clinicId },
        { isCurrent: false }
      );
    }
    
    const assignment = await AssignedGalleryItem.findOneAndUpdate(
      { clinicId, galleryItemId },
      { isCurrent },
      { new: true }
    );
    
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    res.json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove an assigned gallery item from a clinic (admin only)
router.post('/remove-assignment', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { clinicId, galleryItemId } = req.body;
    await AssignedGalleryItem.findOneAndDelete({ clinicId, galleryItemId });
    res.json({ message: 'Assignment removed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 