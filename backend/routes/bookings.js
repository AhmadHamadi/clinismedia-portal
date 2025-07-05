const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const BlockedDate = require('../models/BlockedDate');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');
const EmailService = require('../services/emailService');
const User = require('../models/User');

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

const populateBookingWithCustomer = async (bookingId) => {
  return await Booking.findById(bookingId).populate('customer', 'name email');
};

const formatDateForEmail = (date) => {
  return new Date(date).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

const sendEmailAsync = async (emailFunction, ...args) => {
  try {
    await emailFunction(...args);
  } catch (error) {
    console.error('Failed to send email:', error);
  }
};

// Get all bookings (Admin only)
router.get('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('customer', 'name email')
      .populate('photographer', 'name email')
      .sort({ date: 1 });
    
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all bookings for employees (Employee only)
router.get('/employee', authenticateToken, authorizeRole('employee'), async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('customer', 'name email')
      .populate('photographer', 'name email')
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
      .populate('photographer', 'name email')
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

    // Send booking confirmation email asynchronously
    (async () => {
      const customer = await User.findById(req.user._id);
      const clinicName = customer.name || 'Customer';
      const requestedDate = formatDateForEmail(date);
      await sendEmailAsync(EmailService.sendBookingConfirmation, clinicName, requestedDate);
    })();
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
    const populatedBooking = await Booking.findById(savedBooking._id)
      .populate('customer', 'name email');
    res.status(201).json(populatedBooking);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update booking status (Admin only)
router.patch('/:id/status', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { status, adminMessage, employeeMessage } = req.body;
    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    booking.status = status;
    
    // Update admin message for both accept and decline
    if (adminMessage !== undefined) {
      booking.adminMessage = adminMessage;
    }
    
    // Update employee message only for accept
    if (status === 'accepted' && employeeMessage !== undefined) {
      booking.employeeMessage = employeeMessage;
    }
    
    const updatedBooking = await booking.save();
    const populatedBooking = await Booking.findById(updatedBooking._id)
      .populate('customer', 'name email')
      .populate('photographer', 'name email');
    
    res.json(populatedBooking);

    // Send email notification based on status
    if (status === 'accepted') {
      // Send booking accepted email asynchronously
      (async () => {
        const customer = await User.findById(booking.customer);
        const clinicName = customer.name || 'Customer';
        const bookingDate = formatDateForEmail(booking.date);
        await sendEmailAsync(EmailService.sendBookingAccepted, clinicName, bookingDate);
        
        // Also notify photographers about the available session
        await sendEmailAsync(EmailService.sendPhotographerNotification, clinicName, bookingDate);
      })();
    } else if (status === 'declined') {
      // Send booking declined email asynchronously
      (async () => {
        const customer = await User.findById(booking.customer);
        const clinicName = customer.name || 'Customer';
        const requestedDate = formatDateForEmail(booking.date);
        await sendEmailAsync(EmailService.sendBookingDeclined, clinicName, requestedDate);
      })();
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update photographer assignment and employee message (Admin only)
router.patch('/:id/photography', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { photographerId, employeeMessage } = req.body;

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Update photographer assignment
    if (photographerId !== undefined) {
      booking.photographer = photographerId;
    }
    
    // Update employee message
    if (employeeMessage !== undefined) {
      booking.employeeMessage = employeeMessage;
    }
    
    const updatedBooking = await booking.save();
    const populatedBooking = await Booking.findById(updatedBooking._id)
      .populate('customer', 'name email')
      .populate('photographer', 'name email');
    res.json(populatedBooking);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Accept photography session (Employee only)
router.patch('/:id/accept-session', authenticateToken, authorizeRole('employee'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if booking is already accepted by another photographer
    if (booking.photographer && booking.photographer.toString() !== req.user._id.toString()) {
      return res.status(400).json({ message: 'This session has already been accepted by another photographer' });
    }

    // Check if booking is in accepted status (admin approved)
    if (booking.status !== 'accepted') {
      return res.status(400).json({ message: 'This session is not available for acceptance' });
    }

    // Update photographer field
    booking.photographer = req.user._id;
    
    const updatedBooking = await booking.save();
    const populatedBooking = await Booking.findById(updatedBooking._id)
      .populate('customer', 'name email')
      .populate('photographer', 'name email');
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

// Get all accepted bookings for a specific date (for all customers)
router.get('/accepted', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }
    
    // Get start and end of the day in UTC
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);

    const bookings = await Booking.find({
      status: 'accepted',
      date: { $gte: start, $lte: end }
    });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 