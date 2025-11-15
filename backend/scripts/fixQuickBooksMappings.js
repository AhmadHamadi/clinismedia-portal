/**
 * Script to fix QuickBooks Customer Mappings
 * - Drops old indexes (clinicId, clinimediaCustomerId)
 * - Removes documents with null values
 * - Ensures proper indexes are in place
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const QuickBooksCustomerMapping = require('../models/QuickBooksCustomerMapping');

async function fixMappings() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');

    // Get the collection
    const collection = mongoose.connection.collection('quickbookscustomermappings');
    
    // List all indexes
    const indexes = await collection.indexes();
    console.log('📋 Current indexes:', indexes.map(idx => idx.name));

    // Drop old indexes if they exist
    try {
      await collection.dropIndex('clinicId_1_clinimediaCustomerId_1');
      console.log('✅ Dropped old index: clinicId_1_clinimediaCustomerId_1');
    } catch (err) {
      if (err.code !== 27) { // 27 = index not found
        console.log('ℹ️  Old index not found or already dropped');
      }
    }

    try {
      await collection.dropIndex('clinicId_1');
      console.log('✅ Dropped old index: clinicId_1');
    } catch (err) {
      if (err.code !== 27) {
        console.log('ℹ️  Old index not found or already dropped');
      }
    }

    try {
      await collection.dropIndex('clinimediaCustomerId_1');
      console.log('✅ Dropped old index: clinimediaCustomerId_1');
    } catch (err) {
      if (err.code !== 27) {
        console.log('ℹ️  Old index not found or already dropped');
      }
    }

    // Remove any documents with null portalCustomerId or null quickbooksCustomerId
    const result = await QuickBooksCustomerMapping.deleteMany({
      $or: [
        { portalCustomerId: null },
        { quickbooksCustomerId: null },
        { portalCustomerId: { $exists: false } },
        { quickbooksCustomerId: { $exists: false } }
      ]
    });
    console.log(`✅ Removed ${result.deletedCount} invalid mapping documents`);

    // Drop existing portalCustomerId index if it exists (might not be unique)
    try {
      await collection.dropIndex('portalCustomerId_1');
      console.log('✅ Dropped existing portalCustomerId_1 index');
    } catch (err) {
      if (err.code !== 27) { // 27 = index not found
        console.log('ℹ️  portalCustomerId_1 index not found or already dropped');
      }
    }

    // Create the unique index with a specific name
    try {
      await collection.createIndex(
        { portalCustomerId: 1 },
        { unique: true, name: 'portalCustomerId_unique' }
      );
      console.log('✅ Created unique index on portalCustomerId');
    } catch (err) {
      if (err.code === 85) { // Index already exists
        console.log('✅ Unique index on portalCustomerId already exists');
      } else {
        throw err;
      }
    }

    // List final indexes
    const finalIndexes = await collection.indexes();
    console.log('📋 Final indexes:', finalIndexes.map(idx => idx.name));

    console.log('✅ Fix completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing mappings:', error);
    process.exit(1);
  }
}

fixMappings();

