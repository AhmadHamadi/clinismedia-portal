const Booking = require('../models/Booking');
const User = require('../models/User');
const EmailService = require('./emailService');

// Utility function for consistent date formatting
const formatDateForEmail = (date) => {
  return new Date(date).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

const getNextEligibleMonth = (lastBookingDate, interval) => {
  const lastDate = new Date(lastBookingDate);
  
  if (interval === 1) {
    // Monthly: Next booking must be at start of next month
    return new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 1);
  } else if (interval === 3) {
    // Quarterly: Next booking must be at start of next quarter
    const currentQuarter = Math.floor(lastDate.getMonth() / 3);
    const nextQuarterStartMonth = (currentQuarter + 1) * 3;
    
    // If we're at Q4, move to Q1 of next year
    if (nextQuarterStartMonth >= 12) {
      return new Date(lastDate.getFullYear() + 1, 0, 1); // January 1st
    } else {
      return new Date(lastDate.getFullYear(), nextQuarterStartMonth, 1);
    }
  } else {
    // Fallback to old logic for other intervals
    const next = new Date(lastDate);
    next.setMonth(next.getMonth() + interval);
    next.setDate(1);
    next.setHours(0, 0, 0, 0);
    return next;
  }
};

const hasBookingForMonth = async (customerId, year, month) => {
  // Checks if the customer has an accepted booking for the given year/month
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const booking = await Booking.findOne({
    customer: customerId,
    status: 'accepted',
    date: { $gte: start, $lte: end }
  });
  return !!booking;
};

class ScheduledEmailService {
  static async sendDailyReminders() {
    try {
      // Get tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0); // Start of day
      
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
      
      // Find all accepted bookings for tomorrow
      const upcomingBookings = await Booking.find({
        date: {
          $gte: tomorrow,
          $lt: dayAfterTomorrow
        },
        status: 'accepted'
      }).populate('customer', 'name email')
        .populate('photographer', 'name email');
      
      // Send reminder emails for each booking
      for (const booking of upcomingBookings) {
        try {
          const customer = booking.customer;
          const clinicName = customer.name || 'Customer';
          const bookingDate = formatDateForEmail(booking.date);
          
          // Send customer reminder
          await EmailService.sendBookingReminder(clinicName, bookingDate, customer.email);
          
          // Send photographer reminder if assigned
          if (booking.photographer) {
            const photographer = booking.photographer;
            const photographerName = photographer.name || 'Photographer';
            
            // For now, using placeholder values for location and time
            // These can be updated when you add these fields to the booking model
            const location = 'TBD'; // Can be updated when location field is added
            const time = 'TBD'; // Can be updated when time field is added
            
            await EmailService.sendPhotographerReminder(photographerName, clinicName, bookingDate, photographer.email, location, time);
          }
        } catch (error) {
          console.error(`Failed to send reminder for booking ${booking._id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in sendDailyReminders:', error);
    }
  }

  static async sendProactiveBookingReminders() {
    try {
      const customers = await User.find({ role: 'customer' });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (const customer of customers) {
        const interval = customer.bookingIntervalMonths || 1;
        // Find last accepted booking
        const lastBooking = await Booking.findOne({
          customer: customer._id,
          status: 'accepted'
        }).sort({ date: -1 });
        let nextEligibleMonth;
        if (lastBooking) {
          nextEligibleMonth = getNextEligibleMonth(lastBooking.date, interval);
        } else {
          // If no bookings, allow booking this month
          nextEligibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        }
        const year = nextEligibleMonth.getFullYear();
        const month = nextEligibleMonth.getMonth();
        const monthName = nextEligibleMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
        // Check if customer has already booked for this month
        const alreadyBooked = await hasBookingForMonth(customer._id, year, month);
        if (alreadyBooked) continue;
        // 1 week before eligible month
        const oneWeekBefore = new Date(nextEligibleMonth);
        oneWeekBefore.setDate(oneWeekBefore.getDate() - 7);
        // 1st of eligible month
        const firstOfMonth = new Date(nextEligibleMonth);
        // 2 weeks into month
        const twoWeeksIn = new Date(nextEligibleMonth);
        twoWeeksIn.setDate(twoWeeksIn.getDate() + 13);
        // Send emails at the right times
        if (today.getTime() === oneWeekBefore.getTime()) {
          await EmailService.sendProactiveBookingReminder(customer.name, customer.email, monthName, 'early');
        } else if (today.getTime() === firstOfMonth.getTime()) {
          await EmailService.sendProactiveBookingReminder(customer.name, customer.email, monthName, 'first');
        } else if (today.getTime() === twoWeeksIn.getTime()) {
          await EmailService.sendProactiveBookingReminder(customer.name, customer.email, monthName, 'late');
        }
      }
    } catch (error) {
      console.error('Error in sendProactiveBookingReminders:', error);
    }
  }
}

module.exports = ScheduledEmailService; 