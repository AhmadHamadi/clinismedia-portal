const mongoose = require('mongoose');

const blockedDateSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true
  },
  reason: {
    type: String,
    trim: true
  },
  blockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const BlockedDate = mongoose.model('BlockedDate', blockedDateSchema);

module.exports = BlockedDate; 