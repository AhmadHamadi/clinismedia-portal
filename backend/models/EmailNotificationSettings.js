const mongoose = require('mongoose');

const emailNotificationSettingsSchema = new mongoose.Schema({
  notificationType: {
    type: String,
    required: true,
    enum: [
      'onboarding_task_created',
      'onboarding_task_pending', 
      'onboarding_task_completed',
      'booking_confirmation',
      'booking_accepted',
      'booking_declined',
      'booking_reminder',
      'proactive_booking_reminder'
    ],
    unique: true
  },
  isEnabled: {
    type: Boolean,
    default: true
  },
  sendAutomatically: {
    type: Boolean,
    default: true
  },
  subject: {
    type: String,
    required: true
  },
  template: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

const EmailNotificationSettings = mongoose.model('EmailNotificationSettings', emailNotificationSettingsSchema);

module.exports = EmailNotificationSettings; 