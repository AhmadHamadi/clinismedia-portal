/**
 * Script to check email configuration
 * Run: node scripts/checkEmailConfig.js
 */

require('dotenv').config();
const transporter = require('../config/email_config');
const path = require('path');

async function checkEmailConfig() {
  try {
    console.log('🔍 Checking Email Configuration...\n');

    // Check environment variables
    console.log('📋 Environment Variables:');
    const emailHost = process.env.EMAIL_HOST || 'mail.clinimedia.ca';
    const emailPort = process.env.EMAIL_PORT || '465';
    const emailUser = process.env.EMAIL_USER || 'notifications@clinimedia.ca';
    const emailPass = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
    
    console.log(`   EMAIL_HOST: ${emailHost}`);
    console.log(`   EMAIL_PORT: ${emailPort}`);
    console.log(`   EMAIL_USER: ${emailUser}`);
    console.log(`   EMAIL_PASS: ${emailPass ? '***SET***' : '❌ NOT SET'}`);
    console.log(`   EMAIL_PASSWORD: ${process.env.EMAIL_PASSWORD ? '***SET***' : 'NOT SET'}`);

    // Check if password is missing
    if (!emailPass) {
      console.log('\n❌ ERROR: Email password is not set!');
      console.log('   → Fix: Set either EMAIL_PASS or EMAIL_PASSWORD in .env file');
      process.exit(1);
    }

    // Check if using defaults vs env variables
    console.log('\n📊 Configuration Status:');
    const usingEnvHost = !!process.env.EMAIL_HOST;
    const usingEnvPort = !!process.env.EMAIL_PORT;
    const usingEnvUser = !!process.env.EMAIL_USER;
    const usingEnvPass = !!emailPass;

    console.log(`   Using EMAIL_HOST from env: ${usingEnvHost ? '✅ Yes' : '⚠️  No (using default)'}`);
    console.log(`   Using EMAIL_PORT from env: ${usingEnvPort ? '✅ Yes' : '⚠️  No (using default)'}`);
    console.log(`   Using EMAIL_USER from env: ${usingEnvUser ? '✅ Yes' : '⚠️  No (using default)'}`);
    console.log(`   Using EMAIL_PASS from env: ${usingEnvPass ? '✅ Yes' : '❌ No'}`);

    // Verify transporter configuration
    console.log('\n🔧 Transporter Configuration:');
    console.log(`   Host: ${transporter.options.host}`);
    console.log(`   Port: ${transporter.options.port}`);
    console.log(`   Secure: ${transporter.options.secure}`);
    console.log(`   User: ${transporter.options.auth.user}`);
    console.log(`   Password: ${transporter.options.auth.pass ? '***SET***' : '❌ NOT SET'}`);

    // Test connection
    console.log('\n🧪 Testing Email Connection...');
    try {
      await transporter.verify();
      console.log('   ✅ Email server connection successful!');
    } catch (error) {
      console.log('   ❌ Email server connection failed!');
      console.log(`   Error: ${error.message}`);
      console.log('\n   Possible issues:');
      console.log('   1. Incorrect email credentials (EMAIL_USER or EMAIL_PASS)');
      console.log('   2. Incorrect email host (EMAIL_HOST)');
      console.log('   3. Incorrect email port (EMAIL_PORT)');
      console.log('   4. Firewall blocking connection');
      console.log('   5. Email server is down');
      process.exit(1);
    }

    // Check if logo file exists
    console.log('\n🖼️  Checking Email Assets...');
    const logoPath = path.join(__dirname, '../assets/CliniMedia_Logo1.png');
    const fs = require('fs');
    if (fs.existsSync(logoPath)) {
      console.log('   ✅ Logo file exists');
    } else {
      console.log('   ⚠️  Logo file not found:', logoPath);
      console.log('   → Emails will work but logo attachment will fail');
    }

    // Test sending an email (optional - to a test email)
    const testEmail = process.env.TEST_EMAIL;
    if (testEmail) {
      console.log(`\n📧 Sending Test Email to ${testEmail}...`);
      try {
        await transporter.sendMail({
          from: emailUser,
          to: testEmail,
          subject: 'Test Email from CliniMedia Portal',
          html: `
            <div style="font-family: Arial, sans-serif; color: #222;">
              <p>This is a test email from the CliniMedia Portal.</p>
              <p>If you receive this, your email configuration is working correctly!</p>
              <p>Best regards,<br/>CliniMedia Portal System</p>
            </div>
          `
        });
        console.log('   ✅ Test email sent successfully!');
        console.log(`   → Check ${testEmail} inbox for the test email`);
      } catch (error) {
        console.log('   ❌ Failed to send test email!');
        console.log(`   Error: ${error.message}`);
        process.exit(1);
      }
    } else {
      console.log('\n📧 Test Email:');
      console.log('   ⚠️  TEST_EMAIL not set - skipping test email send');
      console.log('   → Set TEST_EMAIL in .env to test email sending');
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log('   ✅ Email configuration looks good!');
    console.log('   ✅ Connection verified');
    if (testEmail) {
      console.log('   ✅ Test email sent successfully');
    }
    console.log('\n🔧 Next Steps:');
    console.log('   1. Verify you can receive emails at the configured address');
    console.log('   2. Test booking notifications by creating a test booking');
    console.log('   3. Check email logs in production for any delivery issues');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkEmailConfig();

