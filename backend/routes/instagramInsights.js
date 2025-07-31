const express = require('express');
const multer = require('multer');
const path = require('path');
const InstagramInsightImage = require('../models/InstagramInsightImage');
const CustomerNotification = require('../models/CustomerNotification');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');
const User = require('../models/User');

const router = express.Router();

// Set up multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/instagram-insights/'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// Admin: Upload Instagram insight image
router.post('/upload', authenticateToken, authorizeRole(['admin']), upload.single('image'), async (req, res) => {
  try {
    const { clinicId, month } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    if (!clinicId || !month) return res.status(400).json({ error: 'Missing clinicId or month' });

    // Save to DB
    const imageUrl = `/uploads/instagram-insights/${req.file.filename}`;
    const image = new InstagramInsightImage({
      clinicId,
      month,
      imageUrl,
    });
    await image.save();

    // Create customer notification
    const notification = new CustomerNotification({
      customer: clinicId,
      type: 'meta_insights',
      contentId: image._id,
      contentTitle: `Instagram Insights for ${month}`,
    });
    await notification.save();

    res.status(201).json({ message: 'Instagram insight image uploaded', image });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Admin: List all images (optionally filter by clinic/month)
router.get('/list', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { clinicId, month } = req.query;
    const filter = {};
    if (clinicId) filter.clinicId = clinicId;
    if (month) filter.month = month;
    const images = await InstagramInsightImage.find(filter).populate('clinicId', 'name email');
    res.json(images);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// Admin: Delete an image
router.delete('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const image = await InstagramInsightImage.findByIdAndDelete(id);
    if (!image) return res.status(404).json({ error: 'Image not found' });
    res.json({ message: 'Image deleted', image });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Customer: List images for their own clinic
router.get('/my', authenticateToken, authorizeRole(['customer']), async (req, res) => {
  try {
    const clinicId = req.user.id;
    const { month } = req.query;
    const filter = { clinicId };
    if (month) filter.month = month;
    const images = await InstagramInsightImage.find(filter);
    res.json(images);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

module.exports = router; 