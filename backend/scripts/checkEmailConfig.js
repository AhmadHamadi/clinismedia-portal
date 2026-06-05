/**
 * Script to check email configuration
 * Run: node scripts/checkEmailConfig.js
 */

const dotenv = require('dotenv');
const path = require('path');

const explicitEnvPath = process.env.EMAIL_ENV_PATH || process.argv[2];
dotenv.config(explicitEnvPath ? { path: explicitEnvPath, override: true } : undefined);
const transporter = require('../config/email_config');

function firstEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && String(value).trim()) {
      return String(value).trim();
    }
  }
  return null;
}

async function checkEmailConfig() {
  try {
    console.log('🔍 Checking Email Configuration...\n');

    // Check environment variables
    console.log('📋 Environment Variables:');
    const emailHost = firstEnv('WEBSITE_EMAIL_HOST', 'SMTP_HOST', 'EMAIL_HOST') || 'mail.clinimedia.ca';
    const emailPort = firstEnv('WEBSITE_EMAIL_PORT', 'SMTP_PORT', 'EMAIL_PORT') || '465';
    const emailUser = firstEnv('WEBSITE_EMAIL_USER', 'SMTP_USER', 'EMAIL_USER') || 'forms@clinimedia.ca';
    const emailPass = firstEnv('WEBSITE_EMAIL_PASS', 'SMTP_PASS', 'EMAIL_PASS', 'EMAIL_PASSWORD');
    const emailFrom = firstEnv('WEBSITE_EMAIL_FROM', 'EMAIL_FROM', 'SMTP_FROM', 'WEBSITE_EMAIL_USER', 'SMTP_USER', 'EMAIL_USER') || 'forms@clinimedia.ca';
    
    console.log(`   WEBSITE_EMAIL_HOST/SMTP_HOST/EMAIL_HOST: ${emailHost}`);
    console.log(`   WEBSITE_EMAIL_PORT/SMTP_PORT/EMAIL_PORT: ${emailPort}`);
    console.log(`   WEBSITE_EMAIL_USER/SMTP_USER/EMAIL_USER: ${emailUser}`);
    console.log(`   WEBSITE_EMAIL_FROM/EMAIL_FROM/SMTP_FROM: ${emailFrom}`);
    console.log(`   WEBSITE_EMAIL_PASS/SMTP_PASS/EMAIL_PASS: ${emailPass ? '***SET***' : '❌ NOT SET'}`);
    console.log(`   EMAIL_PASSWORD: ${process.env.EMAIL_PASSWORD ? '***SET***' : 'NOT SET'}`);

    // Check if password is missing
    if (!emailPass) {
      console.log('\n❌ ERROR: Email password is not set!');
      console.log('   → Fix: Set WEBSITE_EMAIL_PASS, SMTP_PASS, EMAIL_PASS, or EMAIL_PASSWORD in .env file');
      process.exit(1);
    }

    // Check if using defaults vs env variables
    console.log('\n📊 Configuration Status:');
    const usingEnvHost = !!firstEnv('WEBSITE_EMAIL_HOST', 'SMTP_HOST', 'EMAIL_HOST');
    const usingEnvPort = !!firstEnv('WEBSITE_EMAIL_PORT', 'SMTP_PORT', 'EMAIL_PORT');
    const usingEnvUser = !!firstEnv('WEBSITE_EMAIL_USER', 'SMTP_USER', 'EMAIL_USER');
    const usingEnvPass = !!emailPass;

    console.log(`   Using email host from env: ${usingEnvHost ? '✅ Yes' : '⚠️  No (using default)'}`);
    console.log(`   Using email port from env: ${usingEnvPort ? '✅ Yes' : '⚠️  No (using default)'}`);
    console.log(`   Using email user from env: ${usingEnvUser ? '✅ Yes' : '⚠️  No (using default)'}`);
    console.log(`   Using email password from env: ${usingEnvPass ? '✅ Yes' : '❌ No'}`);

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
      console.log('   1. Incorrect email credentials (WEBSITE_EMAIL_USER/SMTP_USER or WEBSITE_EMAIL_PASS/SMTP_PASS)');
      console.log('   2. Incorrect email host (WEBSITE_EMAIL_HOST/SMTP_HOST)');
      console.log('   3. Incorrect email port (WEBSITE_EMAIL_PORT/SMTP_PORT)');
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

