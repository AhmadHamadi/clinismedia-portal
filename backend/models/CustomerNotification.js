const mongoose = require('mongoose');

const customerNotificationSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['meta_insights', 'invoice', 'gallery'],
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  contentTitle: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
customerNotificationSchema.index({ customer: 1, type: 1, isRead: 1 });

const CustomerNotification = mongoose.model('CustomerNotification', customerNotificationSchema);

module.exports = CustomerNotification; 