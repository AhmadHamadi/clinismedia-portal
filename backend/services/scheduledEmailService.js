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
          await EmailService.sendBookingReminder(clinicName, bookingDate);
          
          // Send photographer reminder if assigned
          if (booking.photographer) {
            const photographer = booking.photographer;
            const photographerName = photographer.name || 'Photographer';
            
            // For now, using placeholder values for location and time
            // These can be updated when you add these fields to the booking model
            const location = 'TBD'; // Can be updated when location field is added
            const time = 'TBD'; // Can be updated when time field is added
            
            await EmailService.sendPhotographerReminder(photographerName, clinicName, bookingDate, location, time);
          }
        } catch (error) {
          console.error(`Failed to send reminder for booking ${booking._id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in sendDailyReminders:', error);
    }
  }
}

module.exports = ScheduledEmailService; 