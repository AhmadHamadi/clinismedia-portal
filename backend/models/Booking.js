const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending'
  },
  notes: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient date queries
bookingSchema.index({ date: 1 });

// Prevent double bookings
bookingSchema.index({ date: 1, status: 1 }, { 
  unique: true,
  partialFilterExpression: { status: { $in: ['pending', 'accepted'] } }
});

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking; 