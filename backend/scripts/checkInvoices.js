require('dotenv').config();
const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const AssignedInvoice = require('../models/AssignedInvoice');
const User = require('../models/User');

async function checkInvoices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check all invoices
    const invoices = await Invoice.find();
    console.log('\n📋 All invoices in database:');
    invoices.forEach(invoice => {
      console.log(`- Name: ${invoice.name}`);
      console.log(`  URL: ${invoice.url}`);
      console.log(`  ID: ${invoice._id}`);
      console.log('');
    });

    // Check assigned invoices
    const assigned = await AssignedInvoice.find().populate('invoiceId clinicId');
    console.log('\n📋 All assigned invoices:');
    assigned.forEach(assignment => {
      console.log(`- Invoice: ${assignment.invoiceId.name}`);
      console.log(`  Clinic: ${assignment.clinicId.name || assignment.clinicId}`);
      console.log(`  Current: ${assignment.isCurrent}`);
      console.log(`  URL: ${assignment.invoiceId.url}`);
      console.log('');
    });

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkInvoices(); 