const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'mail.clinimedia.ca',
  port: 465, // Use 465 for SSL, or 587 for TLS
  secure: true, // true for 465 (SSL), false for 587 (TLS)
  auth: {
    user: 'info@clinimedia.ca',
    pass: 'Clini$Media@2025',
  },
});

module.exports = transporter; 