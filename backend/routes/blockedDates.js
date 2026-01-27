const express = require('express');
const router = express.Router();
const BlockedDate = require('../models/BlockedDate');
const Booking = require('../models/Booking');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');
const allowBookingAccess = require('../middleware/allowBookingAccess');

// Utility functions
const checkDateAvailability = async (date) => {
  // Normalize date to start of day for comparison
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  
  const dayEnd = new Date(checkDate);
  dayEnd.setHours(23, 59, 59, 999);

  // Check if date is already booked
  const existingBooking = await Booking.findOne({
    date: { $gte: checkDate, $lte: dayEnd },
    status: { $in: ['pending', 'accepted'] }
  });
  if (existingBooking) {
    throw new Error('Cannot block date that is already booked');
  }

  // Check if date is already blocked (for ALL customers)
  const existingBlock = await BlockedDate.findOne({
    date: { $gte: checkDate, $lte: dayEnd }
  });
  if (existingBlock) {
    throw new Error('Date is already blocked');
  }
};

// Get all blocked dates (Admin, Customer, Employee, or Receptionist with canBookMediaDay)
// Automatic blocks are created when bookings are accepted (one media day per day rule)
router.get('/', authenticateToken, allowBookingAccess, async (req, res) => {
  try {
    // Get ALL blocked dates (both manual and automatic)
    // Automatic blocks prevent double-booking across all customers
    const blockedDates = await BlockedDate.find()
      .populate('bookingId', 'customer status')
      .sort({ date: 1 });
    res.json(blockedDates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new blocked date (Admin only)
router.post('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { date } = req.body;

    await checkDateAvailability(date);

    const blockedDate = new BlockedDate({ 
      date, 
      isManualBlock: true 
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