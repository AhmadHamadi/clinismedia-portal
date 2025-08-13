const mongoose = require('mongoose');

const customerNotificationSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  metaInsights: {
    unreadCount: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },
  gallery: {
    unreadCount: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },
  invoices: {
    unreadCount: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },
  onboarding: {
    unreadCount: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  }
}, { timestamps: true });

// Index for efficient queries
customerNotificationSchema.index({ customerId: 1 });

module.exports = mongoose.model('CustomerNotification', customerNotificationSchema);
