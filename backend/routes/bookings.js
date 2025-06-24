const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const BlockedDate = require('../models/BlockedDate');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

// Utility functions
const checkDateAvailability = async (date) => {
  // Check if date is blocked
  const blockedDate = await BlockedDate.findOne({ date });
  if (blockedDate) {
    throw new Error('This date is not available');
  }

  // Check if date is already booked
  const existingBooking = await Booking.findOne({
    date,
    status: { $in: ['pending', 'accepted'] }
  });

  if (existingBooking) {
    throw new Error('This date is already booked');
  }
};

const handleBlockedDateForBooking = async (booking, isAccepted) => {
  if (isAccepted) {
    // Create or update blocked date for accepted booking
    try {
      await BlockedDate.create({
        date: booking.date,
        bookingId: booking._id,
        isManualBlock: false
      });
    } catch (error) {
      // If blocked date already exists, update it to link to this booking
      if (error.code === 11000) { // Duplicate key error
        await BlockedDate.findOneAndUpdate(
          { date: booking.date },
          { bookingId: booking._id, isManualBlock: false }
        );
      } else {
        throw error;
      }
    }
  } else {
    // Remove blocked date when booking is no longer accepted
    await BlockedDate.deleteOne({ bookingId: booking._id });
  }
};

const populateBookingWithCustomer = async (bookingId) => {
  return await Booking.findById(bookingId).populate('customer', 'name email');
};

// Get all bookings (Admin only)
router.get('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('customer', 'name email')
      .sort({ date: 1 });
    
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get customer's bookings
router.get('/my-bookings', authenticateToken, authorizeRole('customer'), async (req, res) => {
  try {
    const bookings = await Booking.find({ customer: req.user._id })
      .populate('customer', 'name email')
      .sort({ date: 1 });
    
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new booking
router.post('/', authenticateToken, authorizeRole('customer'), async (req, res) => {
  try {
    const { date, notes } = req.body;

    await checkDateAvailability(date);

    const booking = new Booking({
      customer: req.user._id,
      date,
      notes
    });

    const savedBooking = await booking.save();
    const populatedBooking = await populateBookingWithCustomer(savedBooking._id);
    
    res.status(201).json(populatedBooking);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Create a booking for a customer (Admin only)
router.post('/admin-create', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { customerId, date, notes } = req.body;

    if (!customerId || !date) {
      return res.status(400).json({ message: 'Customer ID and date are required' });
    }

    await checkDateAvailability(date);

    const booking = new Booking({
      customer: customerId,
      date,
      notes,
      status: 'accepted' // Admin-created bookings are automatically accepted
    });

    const savedBooking = await booking.save();
    
    // Create blocked date for accepted booking
    await handleBlockedDateForBooking(savedBooking, true);
    
    const populatedBooking = await populateBookingWithCustomer(savedBooking._id);
    res.status(201).json(populatedBooking);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update booking status (Admin only)
router.patch('/:id/status', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { status, denialReason } = req.body;
    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const oldStatus = booking.status;
    booking.status = status;
    
    if (status === 'declined' && denialReason) {
      booking.denialReason = denialReason;
    }
    
    const updatedBooking = await booking.save();
    
    // Handle automatic blocked date creation/removal
    const isNowAccepted = status === 'accepted' && oldStatus !== 'accepted';
    const wasAcceptedNowDeclined = status === 'declined' && oldStatus === 'accepted';
    
    if (isNowAccepted || wasAcceptedNowDeclined) {
      await handleBlockedDateForBooking(updatedBooking, isNowAccepted);
    }
    
    const populatedBooking = await populateBookingWithCustomer(updatedBooking._id);
    res.json(populatedBooking);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get available dates
router.get('/available-dates', authenticateToken, authorizeRole('customer'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Get all bookings in the date range
    const bookings = await Booking.find({
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      status: { $in: ['pending', 'accepted'] }
    });

    // Get all blocked dates in the range
    const blockedDates = await BlockedDate.find({
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    });

    // Combine and format the unavailable dates
    const unavailableDates = [
      ...bookings.map(booking => booking.date),
      ...blockedDates.map(blocked => blocked.date)
    ];

    res.json({ unavailableDates });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 