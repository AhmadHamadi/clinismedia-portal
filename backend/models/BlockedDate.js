const mongoose = require('mongoose');

const blockedDateSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true,
    index: true // Add index for better query performance
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: false,
    index: true // Add index for better query performance
  },
  isManualBlock: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true // Add timestamps for better tracking
});

// Compound index for efficient queries
blockedDateSchema.index({ date: 1, bookingId: 1 });

const BlockedDate = mongoose.model('BlockedDate', blockedDateSchema);

module.exports = BlockedDate; 