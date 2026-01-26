const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const GalleryItem = require('../models/GalleryItem');
const AssignedGalleryItem = require('../models/AssignedGalleryItem');
const User = require('../models/User');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

// Set up multer for gallery image uploads
const galleryUploadsDir = path.join(__dirname, '../uploads/gallery');
if (!fs.existsSync(galleryUploadsDir)) {
  fs.mkdirSync(galleryUploadsDir, { recursive: true });
  console.log('✅ Created uploads/gallery directory');
}

const galleryStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, galleryUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const uploadGalleryImage = multer({
  storage: galleryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Get all gallery items (admin only)
router.get('/', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const galleryItems = await GalleryItem.find().sort({ date: -1 });
    res.json(galleryItems);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload gallery image (admin only) - supports file upload
router.post('/upload', authenticateToken, authorizeRole(['admin']), uploadGalleryImage.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const { name } = req.body;
    if (!name) {
      // Delete uploaded file if validation fails
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Name is required' });
    }

    const imageUrl = `/uploads/gallery/${req.file.filename}`;
    const galleryItem = new GalleryItem({ name, url: imageUrl });
    await galleryItem.save();
    
    res.status(201).json(galleryItem);
  } catch (err) {
    // Delete uploaded file if there's an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: err.message });
  }
});

// Create a new gallery item (admin only) - supports URL or file upload
router.post('/', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { name, url } = req.body;
    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL are required' });
    }
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
    
    // ✅ FIXED: Validate inputs
    if (!clinicId) {
      return res.status(400).json({ error: 'clinicId is required' });
    }
    if (!galleryItemIds || !Array.isArray(galleryItemIds) || galleryItemIds.length === 0) {
      return res.status(400).json({ error: 'galleryItemIds must be a non-empty array' });
    }
    
    // ✅ FIXED: Verify customer exists
    const customer = await User.findById(clinicId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // ✅ FIXED: Verify gallery items exist
    const galleryItems = await GalleryItem.find({ _id: { $in: galleryItemIds } });
    if (galleryItems.length !== galleryItemIds.length) {
      return res.status(400).json({ error: 'One or more gallery items not found' });
    }
    
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
    
    // ✅ FIXED: Filter out assignments for deleted customers (where clinicId is null after populate)
    // Also clean up orphaned assignments in the database
    const validAssignments = [];
    const orphanedAssignmentIds = [];
    
    for (const assignment of assignments) {
      // If clinicId is null or undefined, the customer was deleted
      if (!assignment.clinicId || !assignment.clinicId._id) {
        orphanedAssignmentIds.push(assignment._id);
      } else {
        // ✅ FIXED: Also check if galleryItemId is valid (gallery item might be deleted)
        if (!assignment.galleryItemId || !assignment.galleryItemId._id) {
          // Gallery item was deleted, mark this assignment as orphaned too
          orphanedAssignmentIds.push(assignment._id);
        } else {
          validAssignments.push(assignment);
        }
      }
    }
    
    // Clean up orphaned assignments (non-blocking)
    if (orphanedAssignmentIds.length > 0) {
      AssignedGalleryItem.deleteMany({ _id: { $in: orphanedAssignmentIds } })
        .then(deleted => {
          console.log(`✅ Cleaned up ${deleted.deletedCount} orphaned gallery assignments`);
        })
        .catch(err => {
          console.error('⚠️ Failed to clean up orphaned assignments:', err);
        });
    }
    
    res.json({ clinics, assignments: validAssignments });
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