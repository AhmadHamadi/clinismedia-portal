const crypto = require('crypto');
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('../config/db');
const User = require('../models/User');

async function backfillCustomerWebhookTokens() {
  await connectDB();

  const customers = await User.find({ role: 'customer', $or: [{ webhookToken: { $exists: false } }, { webhookToken: null }, { webhookToken: '' }] })
    .select('+webhookToken name email');

  for (const customer of customers) {
    customer.webhookToken = crypto.randomBytes(32).toString('hex');
    await customer.save();
    console.log(`Backfilled webhook token for ${customer.name} (${customer.email})`);
  }

  console.log(`Backfilled ${customers.length} customer webhook token(s).`);
  await mongoose.disconnect();
}

backfillCustomerWebhookTokens().catch(async (error) => {
  console.error('Failed to backfill customer webhook tokens:', error);
  await mongoose.disconnect();
  process.exit(1);
});
