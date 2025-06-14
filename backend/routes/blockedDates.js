const express = require('express');
const router = express.Router();
const BlockedDate = require('../models/BlockedDate');
const Booking = require('../models/Booking');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

// Get all blocked dates (Admin only)
router.get('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const blockedDates = await BlockedDate.find()
      .populate('blockedBy', 'name email')
      .sort({ date: 1 });
    
    res.json(blockedDates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new blocked date (Admin only)
router.post('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { date, reason } = req.body;

    // Check if date is already booked
    const existingBooking = await Booking.findOne({ date });
    if (existingBooking) {
      return res.status(400).json({ message: 'Cannot block date that is already booked' });
    }

    // Check if date is already blocked
    const existingBlock = await BlockedDate.findOne({ date });
    if (existingBlock) {
      return res.status(400).json({ message: 'Date is already blocked' });
    }

    const blockedDate = new BlockedDate({
      date,
      reason,
      blockedBy: req.user._id,
    });

    const savedBlockedDate = await blockedDate.save();
    res.status(201).json(savedBlockedDate);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Remove a blocked date (Admin only)
router.delete('/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const blockedDate = await BlockedDate.findById(req.params.id);
    if (!blockedDate) {
      return res.status(404).json({ message: 'Blocked date not found' });
    }

    await blockedDate.deleteOne();
    res.json({ message: 'Blocked date removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 