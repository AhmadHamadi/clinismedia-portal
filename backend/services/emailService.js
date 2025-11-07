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
          289-946-6865 | notifications@clinimedia.ca
        </p>
      </div>
    `;
  }

  // Common email sending function - all emails sent FROM notifications@clinimedia.ca
  static async sendEmail(subject, content, toEmail, errorMessage, fromEmail = 'notifications@clinimedia.ca') {
    try {
      await transporter.sendMail({
        from: fromEmail,
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

      console.log(`📧 Email sent (${subject}) -> ${toEmail}`);
    } catch (error) {
      console.error(errorMessage, error);
      throw error;
    }
  }

  static async sendBookingConfirmation(customerName, requestedDate, customerEmail) {
    const content = `
      <p>Hi ${customerName},</p>
      <p>We've received your Media Day request for <strong>${requestedDate}</strong>. It's pending approval.</p>
      <p>Check status at <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a></p>
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
      <p>Hi ${customerName},</p>
      <p>Your Media Day on <strong>${bookingDate}</strong> is confirmed.</p>
      <p>View details at <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a></p>
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
      <p>Hi ${customerName},</p>
      <p>Your Media Day request for <strong>${requestedDate}</strong> was declined.</p>
      <p>Book a new date at <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a></p>
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
      <p>New Media Day session available!</p>
      <p><strong>Clinic:</strong> ${clinicName}<br/>
      <strong>Date:</strong> ${bookingDate}</p>
      <p>Accept at <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a></p>
    `;
    
    // Send to notifications email for admin visibility
    await EmailService.sendEmail(
      `New Media Day Session Available – ${bookingDate}`,
      content,
      'notifications@clinimedia.ca', // Send to notifications email
      'Failed to send photographer notification email:'
      // FROM defaults to notifications@clinimedia.ca
    );
  }

  static async sendPhotographerNotificationToAll(clinicName, bookingDate) {
    const content = `
      <p>Hi photographer,</p>
      <p>New Media Day session available!</p>
      <p><strong>Clinic:</strong> ${clinicName}<br/>
      <strong>Date:</strong> ${bookingDate}</p>
      <p>Accept at <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a></p>
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
      <p>You've secured the Media Day session for <strong>${clinicName}</strong> on <strong>${bookingDate}</strong>.</p>
      <p>View details at <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a></p>
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
      <p>Reminder: Your Media Day is tomorrow, <strong>${bookingDate}</strong>.</p>
      <p>View details at <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a></p>
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
      <p>Reminder: Media Day session tomorrow, <strong>${bookingDate}</strong>.</p>
      <p><strong>Clinic:</strong> ${clinicName}<br/>
      <strong>Location:</strong> ${location}<br/>
      <strong>Time:</strong> ${time}</p>
      <p>View details at <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a></p>
    `;
    
    await EmailService.sendEmail(
      `Reminder: Media Day Session Tomorrow – ${bookingDate}`,
      content,
      photographerEmail,
      'Failed to send photographer reminder email:'
    );
  }

  static async sendProactiveBookingReminder(customerName, customerEmail, periodName, timing) {
    let subject = '';
    let content = '';

    if (timing === 'two-weeks-before') {
      subject = `Your Media Day window opens soon – ${periodName}`;
      content = `
        <p>Hi ${customerName},</p>
        <p>Your next Media Day window opens in two weeks on <strong>${periodName}</strong>.</p>
        <p>Start thinking about the best date and get ready to book at <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a>.</p>
      `;
    } else if (timing === 'period-start') {
      subject = `Reminder: Media Day window opens today – ${periodName}`;
      content = `
        <p>Hi ${customerName},</p>
        <p>Your Media Day window opens today for <strong>${periodName}</strong>.</p>
        <p>Lock in your preferred date at <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a>.</p>
      `;
    } else if (timing === 'day-10') {
      subject = `Reminder: Media Day window is open – ${periodName}`;
      content = `
        <p>Hi ${customerName},</p>
        <p>Your Media Day window opened earlier this month (${periodName}) and spots can fill up quickly.</p>
        <p>Book now at <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a>.</p>
      `;
    } else if (timing === 'day-15') {
      subject = `Final reminder: Book your Media Day – ${periodName}`;
      content = `
        <p>Hi ${customerName},</p>
        <p>We're halfway through <strong>${periodName}</strong>. If you haven't booked your Media Day yet, please do so asap.</p>
        <p>Reserve your spot at <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a>.</p>
      `;
    } else {
      // Fallback for any legacy timing types
      subject = `Reminder: Book your Media Day for ${periodName}`;
      content = `
        <p>Hi ${customerName},</p>
        <p>Reminder to book your Media Day for <strong>${periodName}</strong>.</p>
        <p>Book at <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a></p>
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
      'notifications@clinimedia.ca', // Admin notifications go to notifications email
      'Failed to send admin booking notification:'
      // FROM defaults to notifications@clinimedia.ca
    );
  }

  static async sendNewContentNotification(customerName, customerEmail, contentType, contentLink, contentName = '') {
    const content = `
      <p>Hi ${customerName},</p>
      <p>New ${contentType} content available!</p>
      ${contentName ? `<p><strong>${contentName}</strong></p>` : ''}
      <p>View at <a href="${contentLink}" style="color: #98c6d5; text-decoration: none;">${contentLink}</a> or <a href="https://clinimediaportal.ca" style="color: #98c6d5; text-decoration: none;">clinimediaportal.ca</a></p>
    `;
    
    await EmailService.sendEmail(
      `New ${contentType} Content Available - ${contentName || 'Portal'}`,
      content,
      customerEmail,
      'Failed to send new content notification:'
    );
  }
}

module.exports = EmailService; 