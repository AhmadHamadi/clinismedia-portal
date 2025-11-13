const nodemailer = require('nodemailer');
require('dotenv').config();

// Email configuration - uses environment variables for production security
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'mail.clinimedia.ca',
  port: parseInt(process.env.EMAIL_PORT) || 465, // Use 465 for SSL, or 587 for TLS
  secure: process.env.EMAIL_PORT === '587' ? false : true, // true for 465 (SSL), false for 587 (TLS)
  auth: {
    user: process.env.EMAIL_USER || 'notifications@clinimedia.ca',
    pass: process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD, // Support both EMAIL_PASS and EMAIL_PASSWORD
  },
});

module.exports = transporter; 