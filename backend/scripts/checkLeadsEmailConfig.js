/**
 * Script to check leads email IMAP configuration
 * Run: node scripts/checkLeadsEmailConfig.js
 */

require('dotenv').config();
const Imap = require('imap');

async function checkLeadsEmailConfig() {
  try {
    console.log('🔍 Checking Leads Email IMAP Configuration...\n');

    // Same as metaLeadsEmailService: default leads@clinimedia.ca, password from EMAIL_PASS
    const leadsEmailUser = process.env.LEADS_EMAIL_USER || 'leads@clinimedia.ca';
    const leadsEmailPass = process.env.LEADS_EMAIL_PASS || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
    const leadsEmailHost = process.env.LEADS_EMAIL_HOST || process.env.EMAIL_HOST || 'mail.clinimedia.ca';
    const leadsEmailPort = parseInt(process.env.LEADS_EMAIL_IMAP_PORT) || 993;

    // Check environment variables
    console.log('📋 Environment Variables:');
    console.log(`   EMAIL_HOST: ${process.env.EMAIL_HOST || 'NOT SET (using default)'}`);
    console.log(`   EMAIL_PASS: ${process.env.EMAIL_PASS ? '***SET***' : 'NOT SET'}`);
    console.log(`   EMAIL_PASSWORD: ${process.env.EMAIL_PASSWORD ? '***SET***' : 'NOT SET'}`);
    console.log(`   LEADS_EMAIL_USER: ${process.env.LEADS_EMAIL_USER || 'NOT SET (using default: leads@clinimedia.ca)'}`);
    console.log(`   LEADS_EMAIL_PASS: ${process.env.LEADS_EMAIL_PASS ? '***SET***' : 'NOT SET (will use EMAIL_PASS)'}`);
    console.log(`   LEADS_EMAIL_HOST: ${process.env.LEADS_EMAIL_HOST || 'NOT SET (will use EMAIL_HOST)'}`);
    console.log(`   LEADS_EMAIL_IMAP_PORT: ${process.env.LEADS_EMAIL_IMAP_PORT || 'NOT SET (using default: 993)'}`);

    // Check if password is missing
    if (!leadsEmailPass) {
      console.log('\n❌ ERROR: Leads email password is not set!');
      console.log('   → Fix: Set either EMAIL_PASS, EMAIL_PASSWORD, or LEADS_EMAIL_PASS in .env file');
      process.exit(1);
    }

    // Show configuration
    console.log('\n📊 Leads Email Configuration:');
    console.log(`   User: ${leadsEmailUser}`);
    console.log(`   Host: ${leadsEmailHost}`);
    console.log(`   Port: ${leadsEmailPort} (IMAP)`);
    console.log(`   Password: ${leadsEmailPass ? '***SET***' : '❌ NOT SET'}`);

    // Test IMAP connection
    console.log('\n🧪 Testing IMAP Connection...');
    const imap = new Imap({
      user: leadsEmailUser,
      password: leadsEmailPass,
      host: leadsEmailHost,
      port: leadsEmailPort,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    });

    imap.once('ready', () => {
      console.log('   ✅ IMAP connection successful!');
      
      // Open inbox
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          console.error('   ❌ Error opening inbox:', err.message);
          imap.end();
          process.exit(1);
        }

        console.log(`   ✅ Inbox opened successfully!`);
        console.log(`   📬 Total messages: ${box.messages.total}`);
        console.log(`   📬 Unread messages: ${box.messages.new || 0}`);
        
        // Search for unread emails
        imap.search(['UNSEEN'], (err, results) => {
          if (err) {
            console.error('   ❌ Error searching emails:', err.message);
            imap.end();
            process.exit(1);
          }

          if (results && results.length > 0) {
            console.log(`   📧 Found ${results.length} unread email(s)`);
          } else {
            console.log('   📭 No unread emails found');
          }

          imap.end();
          console.log('\n✅ Leads email IMAP configuration is working correctly!');
          process.exit(0);
        });
      });
    });

    imap.once('error', (err) => {
      console.error('   ❌ IMAP connection failed!');
      console.error(`   Error: ${err.message}`);
      console.log('\n   Possible issues:');
      console.log('   1. Incorrect email credentials (EMAIL_PASS or LEADS_EMAIL_PASS)');
      console.log('   2. Incorrect email host (EMAIL_HOST or LEADS_EMAIL_HOST)');
      console.log('   3. Incorrect email port (LEADS_EMAIL_IMAP_PORT)');
      console.log('   4. IMAP is not enabled for this email account');
      console.log('   5. Firewall blocking connection');
      console.log('   6. Email server is down');
      process.exit(1);
    });

    imap.once('end', () => {
      console.log('   IMAP connection ended');
    });

    imap.connect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkLeadsEmailConfig();

