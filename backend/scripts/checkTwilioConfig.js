/**
 * Quick script to check Twilio configuration
 * Run: node scripts/checkTwilioConfig.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function checkTwilioConfig() {
  try {
    // Connect to database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/clinismedia';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to database');

    // Check environment variables
    console.log('\n📋 Environment Variables:');
    console.log(`   BACKEND_URL: ${process.env.BACKEND_URL || 'NOT SET'}`);
    console.log(`   RAILWAY_PUBLIC_DOMAIN: ${process.env.RAILWAY_PUBLIC_DOMAIN || 'NOT SET'}`);
    console.log(`   TWILIO_ACCOUNT_SID: ${process.env.TWILIO_ACCOUNT_SID ? 'SET' : 'NOT SET'}`);
    console.log(`   TWILIO_API_KEY_SID: ${process.env.TWILIO_API_KEY_SID ? 'SET' : 'NOT SET'}`);
    console.log(`   TWILIO_AUTH_TOKEN: ${process.env.TWILIO_AUTH_TOKEN ? 'SET' : 'NOT SET'}`);

    // Calculate expected webhook URL
    const baseUrl = process.env.BACKEND_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3000';
    let webhookUrl = baseUrl.replace(/\/$/, '');
    if (!webhookUrl.startsWith('http://localhost') && !webhookUrl.startsWith('https://')) {
      webhookUrl = `https://${webhookUrl}`;
    }
    const incomingWebhook = `${webhookUrl}/api/twilio/voice/incoming`;
    const statusWebhook = `${webhookUrl}/api/twilio/voice/status-callback`;

    console.log('\n🔗 Expected Webhook URLs:');
    console.log(`   Incoming: ${incomingWebhook}`);
    console.log(`   Status: ${statusWebhook}`);

    // Check if phone number is configured in database
    const phoneNumber = '+12897783717';
    console.log(`\n🔍 Checking database for phone number: ${phoneNumber}`);
    
    const clinic = await User.findOne({
      twilioPhoneNumber: phoneNumber,
      role: 'customer'
    });

    if (!clinic) {
      console.log('   ❌ No clinic found for this phone number');
      console.log('   → Fix: Connect this phone number to a clinic in Admin Portal');
      
      // List all clinics with Twilio numbers
      const allClinics = await User.find({
        role: 'customer',
        twilioPhoneNumber: { $exists: true, $ne: null }
      });
      
      if (allClinics.length > 0) {
        console.log('\n   Clinics with Twilio numbers:');
        allClinics.forEach(c => {
          console.log(`      - ${c.name}: ${c.twilioPhoneNumber}`);
        });
      } else {
        console.log('   → No clinics have Twilio numbers configured');
      }
    } else {
      console.log(`   ✅ Clinic found: ${clinic.name}`);
      console.log(`   Forward numbers:`);
      console.log(`      twilioForwardNumber: ${clinic.twilioForwardNumber || 'NOT SET'}`);
      console.log(`      twilioForwardNumberNew: ${clinic.twilioForwardNumberNew || 'NOT SET'}`);
      console.log(`      twilioForwardNumberExisting: ${clinic.twilioForwardNumberExisting || 'NOT SET'}`);
      
      const hasForwardNumber = clinic.twilioForwardNumber || 
                               clinic.twilioForwardNumberNew || 
                               clinic.twilioForwardNumberExisting;
      
      if (!hasForwardNumber) {
        console.log('   ❌ No forward number configured');
        console.log('   → Fix: Set a forward number in Admin Portal → Manage Twilio');
      } else {
        console.log('   ✅ Forward number configured');
      }
    }

    // Summary
    console.log('\n📊 Summary:');
    if (!clinic) {
      console.log('   ❌ ISSUE: Phone number not connected to clinic');
      console.log('   → Action: Connect phone number in Admin Portal');
    } else if (!clinic.twilioForwardNumber && !clinic.twilioForwardNumberNew && !clinic.twilioForwardNumberExisting) {
      console.log('   ❌ ISSUE: No forward number configured');
      console.log('   → Action: Set forward number in Admin Portal');
    } else {
      console.log('   ✅ Database configuration looks good');
      console.log('   → Next: Check Twilio Console webhook configuration');
      console.log(`   → Expected webhook URL: ${incomingWebhook}`);
    }

    console.log('\n🔧 Next Steps:');
    console.log('   1. Check Twilio Console → Phone Numbers → +1 289 778 3717');
    console.log('   2. Verify "A CALL COMES IN" webhook URL matches:', incomingWebhook);
    console.log('   3. Check backend logs when making a call');
    console.log('   4. Check Twilio Debugger for webhook errors');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkTwilioConfig();


