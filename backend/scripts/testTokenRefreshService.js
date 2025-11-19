/**
 * Quick test script to verify token refresh service can find users
 * Run this in the same environment where you're testing (local with ngrok)
 * 
 * Usage: node scripts/testTokenRefreshService.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

async function testTokenRefreshService() {
  try {
    console.log('🔍 Testing Token Refresh Service Setup...\n');
    
    // 1. Check MongoDB connection
    console.log('1️⃣ Checking MongoDB connection...');
    console.log('   MONGODB_URI:', process.env.MONGODB_URI ? 'SET' : 'NOT SET');
    
    if (!process.env.MONGODB_URI) {
      console.error('   ❌ MONGODB_URI not set in .env file!');
      process.exit(1);
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('   ✅ MongoDB connected\n');
    
    // 2. Check for users with quickbooksConnected = true
    console.log('2️⃣ Checking for QuickBooks connected users...');
    const allConnected = await User.find({ quickbooksConnected: true });
    console.log(`   Found ${allConnected.length} user(s) with quickbooksConnected=true`);
    
    if (allConnected.length === 0) {
      console.log('   ⚠️  No users found with quickbooksConnected=true');
      console.log('   💡 Connect QuickBooks first via ngrok/localhost\n');
    } else {
      allConnected.forEach(user => {
        console.log(`   - User: ${user.email || user.name || user._id}`);
        console.log(`     quickbooksConnected: ${user.quickbooksConnected}`);
        console.log(`     hasRefreshToken: ${!!user.quickbooksRefreshToken}`);
        console.log(`     tokenExpiry: ${user.quickbooksTokenExpiry ? user.quickbooksTokenExpiry.toISOString() : 'NOT SET'}`);
        console.log(`     tokenExpiry type: ${typeof user.quickbooksTokenExpiry}`);
        console.log(`     tokenExpiry instanceof Date: ${user.quickbooksTokenExpiry instanceof Date}`);
        console.log('');
      });
    }
    
    // 3. Check for users with both connected AND refresh token
    console.log('3️⃣ Checking for users with refresh tokens...');
    const usersWithRefresh = await User.find({ 
      quickbooksConnected: true,
      quickbooksRefreshToken: { $exists: true, $ne: null }
    });
    console.log(`   Found ${usersWithRefresh.length} user(s) with quickbooksConnected=true AND quickbooksRefreshToken`);
    
    if (usersWithRefresh.length === 0) {
      console.log('   ⚠️  No users found with refresh tokens');
      console.log('   💡 This means the refresh service will find 0 users\n');
    } else {
      console.log('   ✅ Refresh service should find these users!\n');
    }
    
    // 4. Check token expiry
    if (usersWithRefresh.length > 0) {
      console.log('4️⃣ Checking token expiry...');
      const now = new Date();
      usersWithRefresh.forEach(user => {
        const expiryTime = user.quickbooksTokenExpiry ? new Date(user.quickbooksTokenExpiry) : null;
        if (expiryTime) {
          const timeUntilExpiry = expiryTime.getTime() - now.getTime();
          const minutesUntilExpiry = Math.floor(timeUntilExpiry / 60000);
          const bufferTime = 30 * 60 * 1000; // 30 minutes
          const needsRefresh = timeUntilExpiry <= 0 || timeUntilExpiry <= bufferTime;
          
          console.log(`   User: ${user.email || user.name || user._id}`);
          console.log(`     Expiry: ${expiryTime.toISOString()}`);
          console.log(`     Minutes until expiry: ${minutesUntilExpiry}`);
          console.log(`     Needs refresh: ${needsRefresh ? 'YES (within 30 min buffer)' : 'NO (still valid)'}`);
          console.log('');
        } else {
          console.log(`   User: ${user.email || user.name || user._id}`);
          console.log(`     ⚠️  No expiry set - will refresh immediately`);
          console.log('');
        }
      });
    }
    
    // 5. Summary
    console.log('📊 Summary:');
    console.log(`   MongoDB: ${process.env.MONGODB_URI ? 'Connected ✅' : 'Not connected ❌'}`);
    console.log(`   Users with quickbooksConnected=true: ${allConnected.length}`);
    console.log(`   Users with refresh tokens: ${usersWithRefresh.length}`);
    
    if (usersWithRefresh.length > 0) {
      console.log('\n   ✅ Token refresh service should work!');
      console.log('   💡 Check your server logs after 15 minutes to see refresh activity');
    } else {
      console.log('\n   ⚠️  Token refresh service will find 0 users');
      console.log('   💡 Connect QuickBooks first, or check if using wrong database');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Test complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testTokenRefreshService();

