/**
 * Script to fix all Twilio voice settings in the database
 * 
 * This script will:
 * 1. Set all clinic twilioVoice fields to null (so they use the hardcoded default)
 * 2. OR set them all to 'Google.en-US-Chirp3-HD-Aoede'
 * 
 * Run with: node backend/scripts/fix-twilio-voices.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const TTS_VOICE = 'Google.en-US-Chirp3-HD-Aoede';

async function fixTwilioVoices() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/clinismedia';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find all customer/clinic users
    const clinics = await User.find({ role: 'customer' });
    console.log(`\n📋 Found ${clinics.length} clinics`);

    let updated = 0;
    let alreadyCorrect = 0;
    let cleared = 0;

    for (const clinic of clinics) {
      const oldVoice = clinic.twilioVoice;
      
      // Option 1: Set to null (will use hardcoded default)
      // clinic.twilioVoice = null;
      
      // Option 2: Set to the correct voice explicitly
      clinic.twilioVoice = TTS_VOICE;
      
      await clinic.save();
      
      if (oldVoice === TTS_VOICE) {
        alreadyCorrect++;
      } else if (oldVoice) {
        console.log(`  ✅ Updated ${clinic.name || clinic._id}: "${oldVoice}" → "${TTS_VOICE}"`);
        updated++;
      } else {
        console.log(`  ✅ Set ${clinic.name || clinic._id}: null → "${TTS_VOICE}"`);
        cleared++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Cleared (null → voice): ${cleared}`);
    console.log(`   Already correct: ${alreadyCorrect}`);
    console.log(`   Total: ${clinics.length}`);
    console.log(`\n✅ All clinics now use: ${TTS_VOICE}`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixTwilioVoices();

