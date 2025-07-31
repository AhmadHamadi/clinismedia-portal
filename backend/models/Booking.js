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
  photographer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  declinedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  notes: {
    type: String,
    trim: true
  },
  adminMessage: {
    type: String,
    trim: true
  },
  employeeMessage: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Prevent double bookings with a compound index
bookingSchema.index({ date: 1, status: 1 }, { 
  unique: true,
  partialFilterExpression: { status: { $in: ['pending', 'accepted'] } }
});

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking; 