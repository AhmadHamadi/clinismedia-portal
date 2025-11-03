const mongoose = require('mongoose');

const clientNoteSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  note: {
    type: String,
    required: true,
    maxlength: 1000
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  }
});

// Index for efficient queries
clientNoteSchema.index({ customerId: 1, createdAt: -1 });
clientNoteSchema.index({ expiresAt: 1 });

// Virtual for checking if note is expired
clientNoteSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiresAt;
});

module.exports = mongoose.model('ClientNote', clientNoteSchema);
