const mongoose = require('mongoose');

const QuickBooksCustomerMappingSchema = new mongoose.Schema(
  {
    portalCustomerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      // Don't use index: true here to avoid duplicate with schema.index()
    },
    quickbooksCustomerId: {
      type: String,
      required: true,
      index: true,
    },
    quickbooksCustomerDisplayName: {
      type: String,
    },
  },
  { timestamps: true }
);

// Unique index on portalCustomerId to prevent duplicate mappings
QuickBooksCustomerMappingSchema.index(
  { portalCustomerId: 1 },
  { unique: true, name: 'portalCustomerId_unique' }
);

// Drop any old indexes that might exist (clinicId, clinimediaCustomerId)
// This will be handled on first save if needed
QuickBooksCustomerMappingSchema.on('index', function(error) {
  if (error && error.message && error.message.includes('clinicId')) {
    console.log('[QuickBooksCustomerMapping] Old index detected, will be cleaned up');
  }
});

module.exports = mongoose.model('QuickBooksCustomerMapping', QuickBooksCustomerMappingSchema);

