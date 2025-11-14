const nodemailer = require('nodemailer');
require('dotenv').config();

// Email configuration - uses environment variables for production security
const emailHost = process.env.EMAIL_HOST || 'mail.clinimedia.ca';
const emailPort = parseInt(process.env.EMAIL_PORT) || 465;
const emailUser = process.env.EMAIL_USER || 'notifications@clinimedia.ca';
const emailPass = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;

// Validate required configuration
if (!emailPass) {
  console.error('❌ ERROR: Email password is not set!');
  console.error('   → Please set either EMAIL_PASS or EMAIL_PASSWORD in your .env file');
  console.error('   → Email functionality will not work without this configuration');
  // Don't exit - allow server to start, but emails will fail
}

// Log configuration status (only in development or if explicitly enabled)
if (process.env.NODE_ENV !== 'production' || process.env.LOG_EMAIL_CONFIG === 'true') {
  console.log('📧 Email Configuration:');
  console.log(`   Host: ${emailHost}${process.env.EMAIL_HOST ? '' : ' (default)'}`);
  console.log(`   Port: ${emailPort}${process.env.EMAIL_PORT ? '' : ' (default)'}`);
  console.log(`   User: ${emailUser}${process.env.EMAIL_USER ? '' : ' (default)'}`);
  console.log(`   Password: ${emailPass ? '***SET***' : '❌ NOT SET'}`);
  console.log(`   Secure: ${emailPort === 587 ? 'false (TLS)' : 'true (SSL)'}`);
}

// Create transporter with configuration
const transporter = nodemailer.createTransport({
  host: emailHost,
  port: emailPort,
  secure: emailPort === 587 ? false : true, // true for 465 (SSL), false for 587 (TLS)
  auth: {
    user: emailUser,
    pass: emailPass,
  },
});

// Verify connection on startup (optional - only if VERIFY_EMAIL_ON_STARTUP is true)
if (process.env.VERIFY_EMAIL_ON_STARTUP === 'true') {
  transporter.verify()
    .then(() => {
      console.log('✅ Email server connection verified successfully');
    })
    .catch((error) => {
      console.error('❌ Email server connection verification failed:');
      console.error(`   ${error.message}`);
      console.error('   → Email functionality may not work correctly');
      console.error('   → Run: node scripts/checkEmailConfig.js to diagnose');
    });
}

module.exports = transporter; 