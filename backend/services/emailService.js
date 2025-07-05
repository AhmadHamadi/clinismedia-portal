const transporter = require('../config/email_config');
const path = require('path');

class EmailService {
  // Common email template
  static createEmailTemplate(content) {
    return `
      <div style="font-family: Arial, sans-serif; color: #222;">
        ${content}
        <p>Warm regards,<br/>
        CliniMedia</p>
        <img src="cid:clinimedia-logo" alt="Clinimedia Logo" style="display: block; margin: 24px 0; width: 180px;"/>
        <p style="margin: 0; font-size: 14px; color: #222;">
          905-515-7090 | info@clinimedia.ca
        </p>
      </div>
    `;
  }

  // Common email sending function
  static async sendEmail(subject, content, errorMessage) {
    try {
      await transporter.sendMail({
        from: 'info@clinimedia.ca',
        to: 'pauljared48@gmail.com', // Forward all to this email for now
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

  static async sendBookingConfirmation(customerName, requestedDate) {
    const content = `
      <p>Hi ${customerName},</p>
      <p>We've received your Media Day request for <strong>${requestedDate}</strong>.</p>
      <p>It is currently pending approval. Our team is reviewing the details and will follow up soon with a confirmation.</p>
    `;
    
    await EmailService.sendEmail(
      'Media Day Booking Received',
      content,
      'Failed to send booking confirmation email:'
    );
  }

  static async sendBookingAccepted(customerName, bookingDate) {
    const content = `
      <p>Hello ${customerName},</p>
      <p>Your Media Day on ${bookingDate} is confirmed.</p>
      <p>We're looking forward to working with you and capturing what makes your clinic special!</p>
      <p>Please reach out if you have any questions.</p>
    `;
    
    await EmailService.sendEmail(
      `Media Day Booking Confirmed – ${bookingDate}`,
      content,
      'Failed to send booking accepted email:'
    );
  }

  static async sendBookingDeclined(customerName, requestedDate) {
    const content = `
      <p>Hello ${customerName},</p>
      <p>Your Media Day booking request for <strong>${requestedDate}</strong> was unfortunately declined.</p>
      <p>You can view the reason by logging into your account on our website, where you're also able to select another date that works best for you.</p>
      <p>If you have any questions or need assistance, please don't hesitate to reach out.</p>
    `;
    
    await EmailService.sendEmail(
      `Media Day Booking Declined – ${requestedDate}`,
      content,
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
    
    await EmailService.sendEmail(
      `New Media Day Session Available – ${bookingDate}`,
      content,
      'Failed to send photographer notification email:'
    );
  }

  static async sendBookingReminder(customerName, bookingDate) {
    const content = `
      <p>Hi ${customerName},</p>
      <p>Just a quick reminder that your Media Day is scheduled for tomorrow, ${bookingDate}.</p>
      <p>Please have your team and space ready so we can make the most of the session. We're looking forward to a great shoot.</p>
    `;
    
    await EmailService.sendEmail(
      `Reminder: Your Media Day is Tomorrow – ${bookingDate}`,
      content,
      'Failed to send booking reminder email:'
    );
  }

  static async sendPhotographerReminder(photographerName, clinicName, bookingDate, location = 'TBD', time = 'TBD') {
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
      'Failed to send photographer reminder email:'
    );
  }
}

module.exports = EmailService; 