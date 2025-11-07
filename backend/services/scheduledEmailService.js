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
  } else if (interval === 2) {
    // Bi-monthly: Every 2 months (Jan, Mar, May, Jul, Sep, Nov)
    const next = new Date(lastDate);
    next.setMonth(next.getMonth() + 2);
    next.setDate(1);
    next.setHours(0, 0, 0, 0);
    return next;
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
  } else if (interval === 4) {
    // 4 times per year: Every 3 months (Jan, Apr, Jul, Oct)
    const next = new Date(lastDate);
    next.setMonth(next.getMonth() + 3);
    next.setDate(1);
    next.setHours(0, 0, 0, 0);
    return next;
  } else if (interval === 6) {
    // 6 times per year: Every 2 months (Jan, Mar, May, Jul, Sep, Nov)
    const next = new Date(lastDate);
    next.setMonth(next.getMonth() + 2);
    next.setDate(1);
    next.setHours(0, 0, 0, 0);
    return next;
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

  // Get the period name for display in emails based on the eligible start date
  static getPeriodNameFromStart(periodStart, interval) {
    if (interval === 3) {
      const quarterNumber = Math.floor(periodStart.getMonth() / 3) + 1;
      return `Q${quarterNumber} ${periodStart.getFullYear()}`;
    }

    if (interval === 4) {
      return periodStart.toLocaleString('default', { month: 'long', year: 'numeric' });
    }

    // Default to standard month name (covers monthly, bi-monthly, 6x per year, etc.)
    return periodStart.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  static async sendProactiveBookingReminders() {
    try {
      const customers = await User.find({ role: 'customer' });
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const customer of customers) {
        try {
          const interval = customer.bookingIntervalMonths || 1;

          // Only send reminders to clinics that have previously submitted at least one booking request
          const hasSubmittedBooking = await Booking.exists({ customer: customer._id });
          if (!hasSubmittedBooking) {
            continue;
          }

          // Find last accepted booking
          const lastBooking = await Booking.findOne({
            customer: customer._id,
            status: 'accepted'
          }).sort({ date: -1 });

          let periodStart;

          if (lastBooking) {
            periodStart = getNextEligibleMonth(lastBooking.date, interval);

            // Ensure we always look at a future (or current upcoming) period start
            let safetyCounter = 0;
            while (periodStart.getTime() < today.getTime() && safetyCounter < 24) {
              const nextStart = getNextEligibleMonth(periodStart, interval);
              if (nextStart.getTime() === periodStart.getTime()) {
                break;
              }

              periodStart = nextStart;
              safetyCounter += 1;
            }
          } else {
            // If no booking yet, start reminders for the upcoming month
            periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
            periodStart.setHours(0, 0, 0, 0);

            if (periodStart.getTime() < today.getTime()) {
              periodStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            }
          }

          periodStart.setHours(0, 0, 0, 0);

          const twoWeeksBefore = new Date(periodStart);
          twoWeeksBefore.setDate(twoWeeksBefore.getDate() - 14);
          twoWeeksBefore.setHours(0, 0, 0, 0);

          const firstOfPeriod = new Date(periodStart);
          const tenthOfPeriod = new Date(periodStart);
          tenthOfPeriod.setDate(10);
          tenthOfPeriod.setHours(0, 0, 0, 0);

          const fifteenthOfPeriod = new Date(periodStart);
          fifteenthOfPeriod.setDate(15);
          fifteenthOfPeriod.setHours(0, 0, 0, 0);

          // Determine if the customer already has an accepted booking for this period
          let alreadyBooked = false;
          const periodYear = periodStart.getFullYear();
          const periodMonth = periodStart.getMonth();

          const hasBookingForPeriod = async () => {
            if (interval === 1) {
              return await hasBookingForMonth(customer._id, periodYear, periodMonth);
            } else if (interval === 2 || interval === 6) {
              let booked = await hasBookingForMonth(customer._id, periodYear, periodMonth);

              if (!booked) {
                const secondMonth = new Date(periodYear, periodMonth + 1, 1);
                booked = await hasBookingForMonth(customer._id, secondMonth.getFullYear(), secondMonth.getMonth());
              }

              return booked;
            } else if (interval === 3 || interval === 4) {
              const quarterStartMonth = Math.floor(periodMonth / 3) * 3;
              return await hasBookingForQuarter(customer._id, periodYear, quarterStartMonth);
            }

            return await hasBookingForMonth(customer._id, periodYear, periodMonth);
          };

          if (await hasBookingForPeriod()) {
            continue;
          }

          const periodName = this.getPeriodNameFromStart(periodStart, interval);

          if (today.getTime() === twoWeeksBefore.getTime()) {
            await EmailService.sendProactiveBookingReminder(
              customer.name,
              customer.email,
              periodName,
              'two-weeks-before'
            );
            console.log(`✅ Sent two-weeks reminder to ${customer.name} for ${periodName}`);
          }

          if (today.getTime() === firstOfPeriod.getTime() && !(await hasBookingForPeriod())) {
            await EmailService.sendProactiveBookingReminder(
              customer.name,
              customer.email,
              periodName,
              'period-start'
            );
            console.log(`✅ Sent period-start reminder to ${customer.name} for ${periodName}`);
          }

          if (today.getTime() === tenthOfPeriod.getTime() && !(await hasBookingForPeriod())) {
            await EmailService.sendProactiveBookingReminder(
              customer.name,
              customer.email,
              periodName,
              'day-10'
            );
            console.log(`✅ Sent day-10 reminder to ${customer.name} for ${periodName}`);
          }

          if (today.getTime() === fifteenthOfPeriod.getTime() && !(await hasBookingForPeriod())) {
            await EmailService.sendProactiveBookingReminder(
              customer.name,
              customer.email,
              periodName,
              'day-15'
            );
            console.log(`✅ Sent day-15 reminder to ${customer.name} for ${periodName}`);
          }
        } catch (error) {
          console.error(`Failed to send proactive reminder to ${customer.name}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in sendProactiveBookingReminders:', error);
    }
  }
}

module.exports = ScheduledEmailService; 