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
  return await Booking.findById(bookingId).populate('customer', 'name email location');
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

// Calculate next allowed booking date by adding the interval months to the last booking date
// Example: If last booking is January and interval is 3 months, next booking is April (not February)
const getNextEligibleMonth = (lastBookingDate, interval) => {
  const lastDate = new Date(lastBookingDate);
  
  // Simply add the interval months to the last booking date
  // This ensures correct calculation: January + 3 months = April, not February
  const next = new Date(lastDate);
  next.setMonth(next.getMonth() + interval);
  next.setDate(1); // Set to first day of the month
  next.setHours(0, 0, 0, 0); // Reset time to start of day
  return next;
};

// Get count of pending bookings (Admin only)
router.get('/pending-count', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const pendingCount = await Booking.countDocuments({ status: 'pending' });
    res.json({ count: pendingCount });
  } catch (error) {
    console.error('Error fetching pending bookings count:', error);
    res.status(500).json({ message: 'Failed to fetch pending bookings count' });
  }
});

// Get all bookings (Admin only)
router.get('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('customer', 'name email location')
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
      .populate('customer', 'name email location')
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
      .populate('customer', 'name email location')
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

    // Enforce booking interval with start-of-period logic
    const customer = await User.findById(req.user._id);
    const interval = customer.bookingIntervalMonths || 1; // 1 for monthly, 2 for bi-monthly, 3 for quarterly, 4 for 4x/year, 6 for 6x/year
    const lastBooking = await Booking.findOne({
      customer: req.user._id,
      status: 'accepted'
    }).sort({ date: -1 });
    
    if (lastBooking) {
      const nextAllowedDate = getNextEligibleMonth(lastBooking.date, interval);
      
      if (new Date(date) < nextAllowedDate) {
        let intervalText;
        if (interval === 1) intervalText = 'month';
        else if (interval === 2) intervalText = '2 months (bi-monthly)';
        else if (interval === 3) intervalText = 'quarter';
        else if (interval === 4) intervalText = '3 months (4 times/year)';
        else if (interval === 6) intervalText = '2 months (6 times/year)';
        else intervalText = `${interval} months`;
        
        return res.status(400).json({
          message: `You can only book once every ${intervalText}. Next available booking: ${nextAllowedDate.toLocaleDateString()}`
        });
      }
    }

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
      await sendEmailAsync(EmailService.sendBookingConfirmation, clinicName, requestedDate, customer.email);
      
      // Send admin notification email
      await sendEmailAsync(EmailService.sendAdminBookingNotification, clinicName, customer.email, requestedDate, notes);
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

    // Admin can book any date, but still enforce booking intervals
    await checkDateAvailability(date);
    
    // Enforce booking interval with start-of-period logic (same as customer booking)
    const customer = await User.findById(customerId);
    const interval = customer.bookingIntervalMonths || 1; // 1 for monthly, 2 for bi-monthly, 3 for quarterly, 4 for 4x/year, 6 for 6x/year
    const lastBooking = await Booking.findOne({
      customer: customerId,
      status: 'accepted'
    }).sort({ date: -1 });
    
    if (lastBooking) {
      const nextAllowedDate = getNextEligibleMonth(lastBooking.date, interval);
      
      if (new Date(date) < nextAllowedDate) {
        let intervalText;
        if (interval === 1) intervalText = 'month';
        else if (interval === 2) intervalText = '2 months (bi-monthly)';
        else if (interval === 3) intervalText = 'quarter';
        else if (interval === 4) intervalText = '3 months (4 times/year)';
        else if (interval === 6) intervalText = '2 months (6 times/year)';
        else intervalText = `${interval} months`;
        
        return res.status(400).json({
          message: `Customer can only book once every ${intervalText}. Next available booking: ${nextAllowedDate.toLocaleDateString()}`
        });
      }
    }

    const booking = new Booking({
      customer: customerId,
      date,
      notes,
      status: 'accepted' // Admin-created bookings are automatically accepted
    });

    const savedBooking = await booking.save();
    const populatedBooking = await Booking.findById(savedBooking._id)
      .populate('customer', 'name email location');
    
    // Create blocked dates for the next few months since this is an accepted booking
    try {
      const customer = await User.findById(customerId);
      const interval = customer.bookingIntervalMonths || 1; // 1 for monthly, 2 for bi-monthly, 3 for quarterly, 4 for 4x/year, 6 for 6x/year
      
      console.log(`📅 Processing admin-created booking for customer ${customer.name} with interval: ${interval} months`);
      
      // Only create blocked dates for quarterly clinics (interval = 3)
      if (interval === 3) {
        console.log(`🔒 Creating blocked dates for quarterly clinic - blocking entire months of August and September`);
        
        // Create blocked dates for the entire next 2 months (August and September)
        const bookingDate = new Date(date);
        for (let monthOffset = 1; monthOffset <= 2; monthOffset++) {
          const blockedMonth = new Date(bookingDate);
          blockedMonth.setMonth(blockedMonth.getMonth() + monthOffset);
          
          // Block every day in the month
          const year = blockedMonth.getFullYear();
          const month = blockedMonth.getMonth();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          
          console.log(`🔒 Blocking entire month: ${blockedMonth.toLocaleString('default', { month: 'long', year: 'numeric' })} (${daysInMonth} days)`);
          
          for (let day = 1; day <= daysInMonth; day++) {
            const blockedDate = new Date(year, month, day);
            
            // Check if this date is already blocked
            const existingBlock = await BlockedDate.findOne({ date: blockedDate });
            if (!existingBlock) {
              const newBlockedDate = new BlockedDate({
                date: blockedDate,
                bookingId: savedBooking._id,
                isManualBlock: false
              });
              await newBlockedDate.save();
            }
          }
          console.log(`✅ Blocked entire month: ${blockedMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}`);
        }
      } else {
        console.log(`✅ Monthly clinic - no blocked dates created (allows flexible booking)`);
      }
    } catch (blockError) {
      console.error('❌ Error creating blocked dates:', blockError);
      // Don't fail the booking creation if blocking fails
    }
    
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
      .populate('customer', 'name email location')
      .populate('photographer', 'name email');
    
    // Automatic blocked dates removed - now using booking interval logic instead
    console.log(`✅ Booking ${status} - using interval-based restrictions instead of automatic blocking`);
    
    if (false) { // Disabled automatic blocking
      try {
        const customer = await User.findById(booking.customer);
        const interval = customer.bookingIntervalMonths || 1; // 1 for monthly, 2 for bi-monthly, 3 for quarterly, 4 for 4x/year, 6 for 6x/year
        
        console.log(`📅 Processing booking for customer ${customer.name} with interval: ${interval} months`);
        
        if (interval === 1) {
          // For monthly clinics, block the entire next month
          console.log(`🔒 Creating blocked dates for monthly clinic - blocking entire next month`);
          
          const bookingDate = new Date(booking.date);
          const nextMonth = new Date(bookingDate);
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          
          // Block all dates in the next month
          const startOfNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
          const endOfNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0);
          
          console.log(`🔒 Blocking entire month: ${startOfNextMonth.toISOString().split('T')[0]} to ${endOfNextMonth.toISOString().split('T')[0]}`);
          
          // Create blocked dates for each day in the next month
          for (let day = 1; day <= endOfNextMonth.getDate(); day++) {
            const blockedDate = new Date(startOfNextMonth);
            blockedDate.setDate(day);
            
            // Check if this date is already blocked
            const existingBlock = await BlockedDate.findOne({ date: blockedDate });
            if (!existingBlock) {
              const newBlockedDate = new BlockedDate({
                date: blockedDate,
                bookingId: booking._id,
                isManualBlock: false
              });
              await newBlockedDate.save();
              console.log(`✅ Blocked date created: ${blockedDate.toISOString().split('T')[0]}`);
            } else {
              console.log(`⚠️ Date already blocked: ${blockedDate.toISOString().split('T')[0]}`);
            }
          }
        } else if (interval === 3) {
          // For quarterly clinics, block the next 2 months
          console.log(`🔒 Creating blocked dates for quarterly clinic - blocking 2 months after media day`);
          
          // Create blocked dates for the next 2 months only (to prevent immediate double booking)
          const bookingDate = new Date(booking.date);
          for (let i = 1; i <= 2; i++) {
            const blockedDate = new Date(bookingDate);
            blockedDate.setMonth(blockedDate.getMonth() + i);
            
            console.log(`🔒 Creating blocked date: ${blockedDate.toISOString().split('T')[0]} (${i} month(s) after media day)`);
            
            // Check if this date is already blocked
            const existingBlock = await BlockedDate.findOne({ date: blockedDate });
            if (!existingBlock) {
              const newBlockedDate = new BlockedDate({
                date: blockedDate,
                bookingId: booking._id,
                isManualBlock: false
              });
              await newBlockedDate.save();
              console.log(`✅ Blocked date created: ${blockedDate.toISOString().split('T')[0]}`);
            } else {
              console.log(`⚠️ Date already blocked: ${blockedDate.toISOString().split('T')[0]}`);
            }
          }
        } else {
          console.log(`✅ No blocked dates created for interval: ${interval}`);
        }
      } catch (blockError) {
        console.error('❌ Error creating blocked dates:', blockError);
        // Don't fail the booking update if blocking fails
      }
    } // End of disabled automatic blocking
    else if (status === 'declined') {
      // Remove any blocked dates associated with this booking
      try {
        const deletedCount = await BlockedDate.deleteMany({ bookingId: booking._id });
        console.log(`🗑️ Removed ${deletedCount.deletedCount} blocked dates for declined booking`);
      } catch (blockError) {
        console.error('❌ Error removing blocked dates:', blockError);
        // Don't fail the booking update if unblocking fails
      }
    }
    
    res.json(populatedBooking);

    // Automatically block the booked date so it cannot be double-booked
    if (status === 'accepted') {
      try {
        const bookingDay = new Date(booking.date);
        const dayStart = new Date(bookingDay);
        dayStart.setHours(0, 0, 0, 0);

        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const existingBlock = await BlockedDate.findOne({
          date: { $gte: dayStart, $lte: dayEnd },
        });

        if (!existingBlock) {
          const automaticBlock = new BlockedDate({
            date: dayStart,
            bookingId: booking._id,
            isManualBlock: false,
          });

          await automaticBlock.save();
          console.log(`🔒 Automatically blocked ${dayStart.toISOString().split('T')[0]} for booking ${booking._id}`);
        } else if (!existingBlock.bookingId) {
          existingBlock.bookingId = booking._id;
          existingBlock.isManualBlock = false;
          await existingBlock.save();
          console.log(`🔒 Updated existing block for ${existingBlock.date.toISOString().split('T')[0]} with booking ${booking._id}`);
        }
      } catch (blockError) {
        console.error('❌ Error creating automatic blocked date:', blockError);
      }

      // Send email notification based on status
      // Send booking accepted email asynchronously
      (async () => {
        const customer = await User.findById(booking.customer);
        const clinicName = customer.name || 'Customer';
        const bookingDate = formatDateForEmail(booking.date);
        await sendEmailAsync(EmailService.sendBookingAccepted, clinicName, bookingDate, customer.email);
        
        // Also notify photographers about the available session
        await sendEmailAsync(EmailService.sendPhotographerNotificationToAll, clinicName, bookingDate);
        
        // Google Calendar integration removed - keeping it simple!
      })();
    } else if (status === 'declined') {
      // Send booking declined email asynchronously
      (async () => {
        const customer = await User.findById(booking.customer);
        const clinicName = customer.name || 'Customer';
        const requestedDate = formatDateForEmail(booking.date);
        await sendEmailAsync(EmailService.sendBookingDeclined, clinicName, requestedDate, customer.email);
        
        // Google Calendar integration removed - keeping it simple!
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
      .populate('customer', 'name email location')
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
      .populate('customer', 'name email location')
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

// Cancel a pending booking (Customer only)
router.delete('/:id', authenticateToken, authorizeRole('customer'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    // Check if the booking belongs to the customer
    if (booking.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only cancel your own bookings' });
    }
    
    // Only allow cancellation of pending bookings
    if (booking.status !== 'pending') {
      return res.status(400).json({ 
        message: 'You can only cancel pending bookings. Accepted bookings cannot be cancelled.' 
      });
    }
    
    // Delete the booking
    await Booking.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 