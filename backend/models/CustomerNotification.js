const mongoose = require('mongoose');

const customerNotificationSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
  },
  instagramInsights: {
    unreadCount: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },
  callLogs: {
    lastViewed: { type: Date, default: null } // Track when customer last viewed Call Logs page
  }
}, { timestamps: true });

// Index for efficient queries (unique index)
customerNotificationSchema.index({ customerId: 1 }, { unique: true });

module.exports = mongoose.model('CustomerNotification', customerNotificationSchema);
