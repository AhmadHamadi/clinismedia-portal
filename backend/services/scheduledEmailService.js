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

const hasBookingForQuarter = async (customerId, year, quarterStartMonth) => {
  // Checks if the customer has an accepted booking for the given quarter
  const start = new Date(year, quarterStartMonth, 1);
  const end = new Date(year, quarterStartMonth + 3, 0, 23, 59, 59, 999);
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
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of day
      
      // Get tomorrow's date (2 days before reminder)
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Get 1 week from today (1 week before reminder)
      const oneWeekFromToday = new Date(today);
      oneWeekFromToday.setDate(oneWeekFromToday.getDate() + 7);
      
      // Find all accepted bookings for tomorrow (2 days before)
      const tomorrowBookings = await Booking.find({
        date: {
          $gte: tomorrow,
          $lt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)
        },
        status: 'accepted'
      }).populate('customer', 'name email')
        .populate('photographer', 'name email');
      
      // Find all accepted bookings for 1 week from today (1 week before)
      const oneWeekBookings = await Booking.find({
        date: {
          $gte: oneWeekFromToday,
          $lt: new Date(oneWeekFromToday.getTime() + 24 * 60 * 60 * 1000)
        },
        status: 'accepted'
      }).populate('customer', 'name email')
        .populate('photographer', 'name email');
      
      // Send 2-day reminder emails
      for (const booking of tomorrowBookings) {
        try {
          const customer = booking.customer;
          const clinicName = customer.name || 'Customer';
          const bookingDate = formatDateForEmail(booking.date);
          
          // Send customer reminder (2 days before)
          await EmailService.sendBookingReminder(clinicName, bookingDate, customer.email);
          
          // Send photographer reminder if assigned
          if (booking.photographer) {
            const photographer = booking.photographer;
            const photographerName = photographer.name || 'Photographer';
            
            // For now, using placeholder values for location and time
            const location = 'TBD';
            const time = 'TBD';
            
            await EmailService.sendPhotographerReminder(photographerName, clinicName, bookingDate, photographer.email, location, time);
          }
        } catch (error) {
          console.error(`Failed to send 2-day reminder for booking ${booking._id}:`, error);
        }
      }
      
      // Send 1-week reminder emails
      for (const booking of oneWeekBookings) {
        try {
          const customer = booking.customer;
          const clinicName = customer.name || 'Customer';
          const bookingDate = formatDateForEmail(booking.date);
          
          // Send customer reminder (1 week before)
          await EmailService.sendBookingReminder(clinicName, bookingDate, customer.email);
          
          // Send photographer reminder if assigned
          if (booking.photographer) {
            const photographer = booking.photographer;
            const photographerName = photographer.name || 'Photographer';
            
            const location = 'TBD';
            const time = 'TBD';
            
            await EmailService.sendPhotographerReminder(photographerName, clinicName, bookingDate, photographer.email, location, time);
          }
        } catch (error) {
          console.error(`Failed to send 1-week reminder for booking ${booking._id}:`, error);
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
        
        let nextEligiblePeriod;
        if (lastBooking) {
          nextEligiblePeriod = getNextEligibleMonth(lastBooking.date, interval);
        } else {
          // If no bookings, allow booking this month
          nextEligiblePeriod = new Date(today.getFullYear(), today.getMonth(), 1);
        }
        
        // Check if customer has already booked for this period
        let alreadyBooked = false;
        if (interval === 1) {
          // Monthly: check if they have a booking this month
          alreadyBooked = await hasBookingForMonth(customer._id, nextEligiblePeriod.getFullYear(), nextEligiblePeriod.getMonth());
        } else if (interval === 3) {
          // Quarterly: check if they have a booking this quarter
          const quarterStartMonth = Math.floor(nextEligiblePeriod.getMonth() / 3) * 3;
          alreadyBooked = await hasBookingForQuarter(customer._id, nextEligiblePeriod.getFullYear(), quarterStartMonth);
        }
        
        if (alreadyBooked) continue;
        
        // Calculate reminder dates based on booking interval
        let reminderDates = [];
        let periodName = '';
        
        if (interval === 1) {
          // Monthly customers: 2 weeks before, 1st of month, 15th of month
          const twoWeeksBefore = new Date(nextEligiblePeriod);
          twoWeeksBefore.setDate(twoWeeksBefore.getDate() - 14);
          
          const firstOfMonth = new Date(nextEligiblePeriod);
          
          const midMonth = new Date(nextEligiblePeriod);
          midMonth.setDate(15);
          
          periodName = nextEligiblePeriod.toLocaleString('default', { month: 'long', year: 'numeric' });
          
          reminderDates = [
            { date: twoWeeksBefore, type: 'early' },
            { date: firstOfMonth, type: 'first' },
            { date: midMonth, type: 'mid' }
          ];
        } else if (interval === 3) {
          // Quarterly customers: 2 weeks before quarter start, 1st of quarter, 15th of quarter
          const quarterStartMonth = Math.floor(nextEligiblePeriod.getMonth() / 3) * 3;
          const quarterStart = new Date(nextEligiblePeriod.getFullYear(), quarterStartMonth, 1);
          
          const twoWeeksBefore = new Date(quarterStart);
          twoWeeksBefore.setDate(twoWeeksBefore.getDate() - 14);
          
          const firstOfQuarter = new Date(quarterStart);
          
          const midQuarter = new Date(quarterStart);
          midQuarter.setDate(15);
          
          // Get quarter name (Q1, Q2, Q3, Q4)
          const quarterNumber = Math.floor(quarterStartMonth / 3) + 1;
          periodName = `Q${quarterNumber} ${quarterStart.getFullYear()}`;
          
          reminderDates = [
            { date: twoWeeksBefore, type: 'early' },
            { date: firstOfQuarter, type: 'first' },
            { date: midQuarter, type: 'mid' }
          ];
        }
        
        // Send emails at the right times
        for (const reminder of reminderDates) {
          if (today.getTime() === reminder.date.getTime()) {
            await EmailService.sendProactiveBookingReminder(customer.name, customer.email, periodName, reminder.type);
          }
        }
      }
    } catch (error) {
      console.error('Error in sendProactiveBookingReminders:', error);
    }
  }
}

module.exports = ScheduledEmailService; 