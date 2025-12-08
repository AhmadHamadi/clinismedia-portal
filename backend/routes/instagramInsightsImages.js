const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const InstagramInsightImage = require('../models/InstagramInsightImage');
const User = require('../models/User');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');
const storageService = require('../services/storageService');

// Set up multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/instagram-insights');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
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

// Upload Instagram insight image (admin only)
router.post('/upload', authenticateToken, authorizeRole(['admin']), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const { clinicId, month } = req.body;

    if (!clinicId || !month) {
      // Delete uploaded file if validation fails
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'clinicId and month are required' });
    }

    // Validate month format (YYYY-MM)
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Month must be in YYYY-MM format' });
    }

    // Upload file to Railway Storage Bucket (or local fallback)
    let imageKey;
    
    try {
      const uploadResult = await storageService.uploadInstagramImage(
        req.file.path,
        req.file.originalname,
        req.file.mimetype,
        clinicId
      );
      
      imageKey = uploadResult.key;
      console.log(`✅ Image uploaded to storage: ${imageKey}`);
    } catch (storageError) {
      // Clean up local file if storage upload fails
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      console.error('❌ Error uploading to storage:', storageError);
      return res.status(500).json({ error: 'Failed to upload image to storage' });
    }

    // Check if image already exists for this clinic and month
    const existingImage = await InstagramInsightImage.findOne({
      clinicId,
      month
    });

    if (existingImage) {
      // Delete old image file from storage
      try {
        await storageService.deleteImage(existingImage.imageUrl);
      } catch (err) {
        console.error('Error deleting old image from storage:', err);
      }
      
      // Update existing record with key (not URL)
      existingImage.imageUrl = imageKey;
      existingImage.uploadedAt = new Date();
      await existingImage.save();
      
      // Return with presigned URL for immediate use
      const presignedUrl = await storageService.getImageUrl(imageKey);
      res.json({
        ...existingImage.toObject(),
        url: presignedUrl // Include presigned URL in response
      });
    } else {
      // Create new record with key (not URL)
      const insightImage = new InstagramInsightImage({
        clinicId,
        month,
        imageUrl: imageKey // Store key, not URL
      });
      
      await insightImage.save();
      
      // Return with presigned URL for immediate use
      const presignedUrl = await storageService.getImageUrl(imageKey);
      
      // Increment customer notification count
      try {
        const CustomerNotification = require('../models/CustomerNotification');
        let notification = await CustomerNotification.findOne({ customerId: clinicId });
        
        if (!notification) {
          notification = new CustomerNotification({ customerId: clinicId });
        }
        
        notification.instagramInsights = notification.instagramInsights || { unreadCount: 0, lastUpdated: null };
        notification.instagramInsights.unreadCount += 1;
        notification.instagramInsights.lastUpdated = new Date();
        await notification.save();
      } catch (err) {
        console.error('Error updating notification count:', err);
      }
      
      // Send email notification to customer
      try {
        const customer = await User.findById(clinicId);
        if (customer && customer.email) {
          const EmailService = require('../services/emailService');
          const portalLink = `https://clinimediaportal.ca/customer/instagram-insights`;
          await EmailService.sendNewContentNotification(
            customer.name,
            customer.email,
            'Instagram Insights',
            portalLink,
            `Instagram Insights Report - ${month}`
          );
          console.log(`✅ Instagram insights notification email sent to ${customer.email}`);
        }
      } catch (emailError) {
        console.error('❌ Failed to send Instagram insights notification email:', emailError);
      }
      
      res.status(201).json({
        ...insightImage.toObject(),
        url: presignedUrl // Include presigned URL in response
      });
    }
  } catch (error) {
    // Delete uploaded file if save fails
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupErr) {
        console.warn('⚠️  Could not clean up temp file:', cleanupErr);
      }
    }
    console.error('Error uploading Instagram insight image:', error);
    res.status(500).json({ error: error.message || 'Failed to upload image' });
  }
});

// List Instagram insight images (admin only - with filters)
router.get('/list', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { clinicId, month } = req.query;
    
    const query = {};
    if (clinicId) query.clinicId = clinicId;
    if (month) query.month = month;
    
    const images = await InstagramInsightImage.find(query)
      .populate('clinicId', 'name email')
      .sort({ uploadedAt: -1 });
    
    // Add presigned URLs for Railway Bucket images
    const imagesWithUrls = await Promise.all(
      images.map(async (image) => {
        const imageObj = image.toObject();
        // Generate presigned URL if it's a Railway Bucket key (not local path)
        if (!image.imageUrl.startsWith('/uploads/') && !image.imageUrl.startsWith('http')) {
          try {
            imageObj.url = await storageService.getImageUrl(image.imageUrl);
          } catch (err) {
            console.error('Error generating presigned URL for image:', image._id, err);
            imageObj.url = null;
          }
        }
        return imageObj;
      })
    );
    
    res.json(imagesWithUrls);
  } catch (error) {
    console.error('Error listing Instagram insight images:', error);
    res.status(500).json({ error: 'Failed to list images' });
  }
});

// Get Instagram insight images for current customer (past 3 months)
router.get('/my-images', authenticateToken, authorizeRole(['customer']), async (req, res) => {
  try {
    const customerId = req.user.id;
    
    // Calculate date range for past 3 months
    const today = new Date();
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    
    // Generate month strings for the past 3 months
    const months = [];
    for (let i = 0; i < 3; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.push(monthStr);
    }
    
    const images = await InstagramInsightImage.find({
      clinicId: customerId,
      month: { $in: months }
    })
      .sort({ month: -1, uploadedAt: -1 });
    
    // Add presigned URLs for Railway Bucket images
    const imagesWithUrls = await Promise.all(
      images.map(async (image) => {
        const imageObj = image.toObject();
        // Generate presigned URL if it's a Railway Bucket key (not local path)
        if (!image.imageUrl.startsWith('/uploads/') && !image.imageUrl.startsWith('http')) {
          try {
            imageObj.url = await storageService.getImageUrl(image.imageUrl);
          } catch (err) {
            console.error('Error generating presigned URL for image:', image._id, err);
            imageObj.url = null;
          }
        }
        return imageObj;
      })
    );
    
    res.json(imagesWithUrls);
  } catch (error) {
    console.error('Error fetching customer Instagram insight images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// Get presigned URL for image (Railway Bucket) or serve directly (local)
router.get('/image/:id', async (req, res) => {
  try {
    const image = await InstagramInsightImage.findById(req.params.id);
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // If it's a local file path, serve directly
    if (image.imageUrl.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '..', image.imageUrl);
      if (fs.existsSync(filePath)) {
        return res.sendFile(path.resolve(filePath));
      }
      return res.status(404).json({ error: 'File not found' });
    }
    
    // For Railway Storage Bucket: generate presigned URL
    try {
      const presignedUrl = await storageService.getImageUrl(image.imageUrl);
      return res.redirect(presignedUrl);
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      return res.status(500).json({ error: 'Failed to retrieve image' });
    }
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

// Verify image file exists (admin only)
router.get('/verify/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const image = await InstagramInsightImage.findById(req.params.id);
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found', exists: false });
    }
    
    const exists = await storageService.fileExists(image.imageUrl || '');
    
    res.json({
      imageId: image._id,
      imageUrl: image.imageUrl,
      exists,
      message: exists ? 'File exists in storage' : 'File not found in storage'
    });
  } catch (error) {
    console.error('Error verifying image file:', error);
    res.status(500).json({ error: 'Failed to verify image file', exists: false });
  }
});

// Delete Instagram insight image (admin only)
router.delete('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const image = await InstagramInsightImage.findById(req.params.id);
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Delete image file from storage
    try {
      await storageService.deleteImage(image.imageUrl);
    } catch (err) {
      console.error('Error deleting image file from storage:', err);
      // Continue with database deletion even if file deletion fails
    }
    
    // Delete database record
    await InstagramInsightImage.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting Instagram insight image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

module.exports = router;

