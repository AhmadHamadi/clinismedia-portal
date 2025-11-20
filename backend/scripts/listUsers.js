require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function listUsers() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // List all users
    const allUsers = await User.find({}).select('name email username role quickbooksConnected');
    
    console.log('📋 All Users in Database:');
    console.log('='.repeat(80));
    
    allUsers.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.name || 'N/A'}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   QuickBooks Connected: ${user.quickbooksConnected ? '✅ YES' : '❌ NO'}`);
      if (user.quickbooksConnected) {
        console.log(`   ⚠️  This user has QuickBooks connected!`);
      }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(`\nTotal users: ${allUsers.length}`);
    
    // Show QuickBooks connected users
    const qbConnected = allUsers.filter(u => u.quickbooksConnected);
    if (qbConnected.length > 0) {
      console.log(`\n⚠️  Users with QuickBooks connected: ${qbConnected.length}`);
      qbConnected.forEach(user => {
        console.log(`   - ${user.email} (${user.name})`);
      });
    } else {
      console.log('\n✅ No users with QuickBooks connected');
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listUsers();

