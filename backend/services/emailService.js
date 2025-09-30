const transporter = require('../config/email_config');
const path = require('path');

class EmailService {
  // Common email template
  static createEmailTemplate(content) {
    return `
      <div style="font-family: Arial, sans-serif; color: #222;">
        ${content}
        <p>Best regards,<br/>
        CliniMedia</p>
        <img src="cid:clinimedia-logo" alt="Clinimedia Logo" style="display: block; margin: 24px 0; width: 180px;"/>
        <p style="margin: 0; font-size: 14px; color: #222;">
          289-946-6865 | info@clinimedia.ca
        </p>
      </div>
    `;
  }

  // Common email sending function
  static async sendEmail(subject, content, toEmail, errorMessage) {
    try {
      await transporter.sendMail({
        from: 'info@clinimedia.ca',
        to: toEmail, // Send to specific customer email
        subject,
        html: EmailService.createEmailTemplate(content),
        attachments: [
          {
            filename: 'CliniMedia_Logo1.png',
            path: path.join(__dirname, '../assets/CliniMedia_Logo1.png'),
            cid: 'clinimedia-logo'
          }
        ]
      });
    } catch (error) {
      console.error(errorMessage, error);
      throw error;
    }
  }

  static async sendBookingConfirmation(customerName, requestedDate, customerEmail) {
    const content = `
      <p>Hi ${customerName},</p>
      <p>We've received your Media Day request for <strong>${requestedDate}</strong>.</p>
      <p>It is currently pending approval. Our team is reviewing the details and will follow up soon with a confirmation.</p>
      <p>You can check the status of your booking by visiting <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a> or <a href="https://clinimedia.ca" style="color: #98c6d5; text-decoration: none;">clinimedia.ca</a>.</p>
    `;
    
    await EmailService.sendEmail(
      'Media Day Booking Received',
      content,
      customerEmail,
      'Failed to send booking confirmation email:'
    );
  }

  static async sendBookingAccepted(customerName, bookingDate, customerEmail) {
    const content = `
      <p>Hello ${customerName},</p>
      <p>Your Media Day on ${bookingDate} is confirmed.</p>
      <p>We're looking forward to working with you and capturing what makes your clinic special!</p>
      <p>You can view all your booking details and manage your account by visiting <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a> or <a href="https://clinimedia.ca" style="color: #98c6d5; text-decoration: none;">clinimedia.ca</a>.</p>
      <p>Please reach out if you have any questions.</p>
    `;
    
    await EmailService.sendEmail(
      `Media Day Booking Confirmed – ${bookingDate}`,
      content,
      customerEmail,
      'Failed to send booking accepted email:'
    );
  }

  static async sendBookingDeclined(customerName, requestedDate, customerEmail) {
    const content = `
      <p>Hello ${customerName},</p>
      <p>Your Media Day booking request for <strong>${requestedDate}</strong> was unfortunately declined.</p>
      <p>You can view the reason and book a new date by visiting <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a> or <a href="https://clinimedia.ca" style="color: #98c6d5; text-decoration: none;">clinimedia.ca</a>.</p>
      <p>If you have any questions or need assistance, please don't hesitate to reach out.</p>
    `;
    
    await EmailService.sendEmail(
      `Media Day Booking Declined – ${requestedDate}`,
      content,
      customerEmail,
      'Failed to send booking declined email:'
    );
  }

  static async sendPhotographerNotification(clinicName, bookingDate) {
    const content = `
      <p>Hi photographer,</p>
      <p>We have a new Media Day session available and is now ready to be accepted!</p>
      <p><strong>Clinic:</strong> ${clinicName}<br/>
      <strong>Date:</strong> ${bookingDate}</p>
      <p>If you're available and interested, please log in to your dashboard to view the details and accept the session.</p>
      <p>Feel free to reach out if you have any questions.</p>
    `;
    
    // Send to all photographers (first come, first served)
    await EmailService.sendEmail(
      `New Media Day Session Available – ${bookingDate}`,
      content,
      'info@clinimedia.ca', // Updated to send to admin email
      'Failed to send photographer notification email:'
    );
  }

  static async sendPhotographerNotificationToAll(clinicName, bookingDate) {
    const content = `
      <p>Hi photographer,</p>
      <p>We have a new Media Day session available and is now ready to be accepted!</p>
      <p><strong>Clinic:</strong> ${clinicName}<br/>
      <strong>Date:</strong> ${bookingDate}</p>
      <p>If you're available and interested, please log in to your dashboard at <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a> to view the details and accept the session.</p>
      <p>Feel free to reach out if you have any questions.</p>
    `;
    
    try {
      // Get all photographers
      const User = require('../models/User');
      const photographers = await User.find({ role: 'employee' });
      
      // Send email to each photographer
      for (const photographer of photographers) {
        await EmailService.sendEmail(
          `New Media Day Session Available – ${bookingDate}`,
          content,
          photographer.email,
          'Failed to send photographer notification email:'
        );
      }
    } catch (error) {
      console.error('Failed to send photographer notifications:', error);
    }
  }

  static async sendPhotographerBookingSecured(photographerName, clinicName, bookingDate, photographerEmail) {
    const content = `
      <p>Hi ${photographerName},</p>
      <p>Congratulations! You have successfully secured the Media Day session for <strong>${clinicName}</strong> on <strong>${bookingDate}</strong>.</p>
      <p>Please log in to your dashboard at <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a> to view the full details and prepare for the session.</p>
      <p>If you have any questions or need to make changes, please reach out to us.</p>
    `;
    
    await EmailService.sendEmail(
      `Media Day Session Secured – ${bookingDate}`,
      content,
      photographerEmail,
      'Failed to send photographer booking secured email:'
    );
  }

  static async sendBookingReminder(customerName, bookingDate, customerEmail) {
    const content = `
      <p>Hi ${customerName},</p>
      <p>Just a quick reminder that your Media Day is scheduled for tomorrow, ${bookingDate}.</p>
      <p>Please have your team and space ready so we can make the most of the session. We're looking forward to a great shoot.</p>
    `;
    
    await EmailService.sendEmail(
      `Reminder: Your Media Day is Tomorrow – ${bookingDate}`,
      content,
      customerEmail,
      'Failed to send booking reminder email:'
    );
  }

  static async sendPhotographerReminder(photographerName, clinicName, bookingDate, photographerEmail, location = 'TBD', time = 'TBD') {
    const content = `
      <p>Hi ${photographerName},</p>
      <p>Just a reminder that you're scheduled for a Media Day session tomorrow, ${bookingDate}.</p>
      <p><strong>Clinic:</strong> ${clinicName}<br/>
      <strong>Location:</strong> ${location}<br/>
      <strong>Time:</strong> ${time}</p>
      <p>Please be sure to arrive prepared and on time. If anything comes up or you need support, don't hesitate to reach out.</p>
      <p>Thanks again for being part of the team.</p>
    `;
    
    await EmailService.sendEmail(
      `Reminder: Media Day Session Tomorrow – ${bookingDate}`,
      content,
      photographerEmail,
      'Failed to send photographer reminder email:'
    );
  }

  static async sendProactiveBookingReminder(customerName, customerEmail, monthName, timing) {
    let subject = '';
    let content = '';
    if (timing === 'early') {
      subject = `You are now eligible to book your Media Day for ${monthName}`;
      content = `
        <p>Hi ${customerName},</p>
        <p>You are now eligible to book your Media Day for <strong>${monthName}</strong>.</p>
        <p>Book now to secure your preferred date! Visit <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a> or <a href="https://clinimedia.ca" style="color: #98c6d5; text-decoration: none;">clinimedia.ca</a> to get started.</p>
      `;
    } else if (timing === 'first') {
      subject = `Reminder: Book your Media Day for ${monthName}`;
      content = `
        <p>Hi ${customerName},</p>
        <p>This is a reminder to book your Media Day for <strong>${monthName}</strong>.</p>
        <p>Don't miss out—book your session today! Visit <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a> or <a href="https://clinimedia.ca" style="color: #98c6d5; text-decoration: none;">clinimedia.ca</a> to book now.</p>
      `;
    } else if (timing === 'mid') {
      subject = `Don't forget: Book your Media Day for ${monthName}`;
      content = `
        <p>Hi ${customerName},</p>
        <p>We're halfway through <strong>${monthName}</strong> and you haven't booked your Media Day yet.</p>
        <p>Don't miss out—book your session today to ensure availability! Visit <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a> or <a href="https://clinimedia.ca" style="color: #98c6d5; text-decoration: none;">clinimedia.ca</a> to book now.</p>
      `;
    } else if (timing === 'late') {
      subject = `Final reminder: Book your Media Day for ${monthName}`;
      content = `
        <p>Hi ${customerName},</p>
        <p>This is your final reminder to book your Media Day for <strong>${monthName}</strong>.</p>
        <p>Please book as soon as possible to ensure availability! Visit <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a> or <a href="https://clinimedia.ca" style="color: #98c6d5; text-decoration: none;">clinimedia.ca</a> to book now.</p>
      `;
    }
    await EmailService.sendEmail(
      subject,
      content,
      customerEmail,
      'Failed to send proactive booking reminder:'
    );
  }

  static async sendAdminBookingNotification(customerName, customerEmail, bookingDate, notes = '') {
    const content = `
      <p>Hi Admin,</p>
      <p>A new Media Day booking has been requested!</p>
      <p><strong>Clinic:</strong> ${customerName}<br/>
      <strong>Customer Email:</strong> ${customerEmail}<br/>
      <strong>Requested Date:</strong> ${bookingDate}<br/>
      <strong>Notes:</strong> ${notes || 'No additional notes'}</p>
      <p>Please log in to the admin dashboard at <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a> to review and accept/decline this booking.</p>
      <p>Best regards,<br/>CliniMedia Portal System</p>
    `;
    
    await EmailService.sendEmail(
      `New Media Day Booking Request - ${customerName} - ${bookingDate}`,
      content,
      'info@clinimedia.ca', // Admin notifications go to admin email
      'Failed to send admin booking notification:'
    );
  }
}

module.exports = EmailService; 