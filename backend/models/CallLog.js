const mongoose = require('mongoose');

const CallLogSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  twilioPhoneNumber: {
    type: String,
    required: true,
    index: true
  },
  callSid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  from: {
    type: String,
    required: true
  },
  to: {
    type: String,
    required: true
  },
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    default: 'inbound'
  },
  status: {
    type: String,
    required: true,
    index: true
  },
  dialCallStatus: {
    type: String,
    enum: ['completed', 'answered', 'busy', 'no-answer', 'failed', 'canceled', null],
    default: null,
    index: true // Index for efficient queries to find answered calls
  },
  duration: {
    type: Number, // Duration in seconds
    default: 0
  },
  menuChoice: {
    type: String,
    enum: ['1', '2', null], // 1 = new patient, 2 = existing patient
    default: null
  },
  startedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  endedAt: {
    type: Date,
    default: null
  },
  recordingUrl: {
    type: String,
    default: null
  },
  recordingSid: {
    type: String,
    default: null
  },
  // Caller Information
  callerName: {
    type: String,
    default: null // CNAM lookup result
  },
  callerCity: {
    type: String,
    default: null
  },
  callerState: {
    type: String,
    default: null
  },
  callerZip: {
    type: String,
    default: null
  },
  callerCountry: {
    type: String,
    default: null
  },
  // Call Quality Metrics
  qualityMetrics: {
    jitter: {
      type: Number,
      default: null
    },
    packetLoss: {
      type: Number,
      default: null
    },
    latency: {
      type: Number,
      default: null
    },
    audioQuality: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor', null],
      default: null
    }
  },
  // Call Pricing
  price: {
    type: Number,
    default: null // Cost in USD
  },
  priceUnit: {
    type: String,
    default: 'USD'
  },
  // Call Events
  ringingDuration: {
    type: Number, // in seconds
    default: null
  },
  answerTime: {
    type: Date,
    default: null
  },
  // Transcription (legacy - kept for backward compatibility)
  transcriptUrl: {
    type: String,
    default: null
  },
  transcriptSid: {
    type: String,
    default: null,
    index: true // Index for CI webhook lookups
  },
  transcriptText: {
    type: String,
    default: null
  },
  // Conversational Intelligence Summary
  summaryText: {
    type: String,
    default: null
  },
  summaryReady: {
    type: Boolean,
    default: false,
    index: true
  },
  // Voicemail (if enabled)
  voicemailUrl: {
    type: String,
    default: null
  },
  voicemailDuration: {
    type: Number, // in seconds
    default: null
  },
  // Appointment Booking Detection
  appointmentBooked: {
    type: Boolean,
    default: null, // null = not analyzed yet, true = appointment booked, false = no appointment
    index: true // Index for efficient queries
  }
}, {
  timestamps: true
});

// Index for efficient queries by customer and date
CallLogSchema.index({ customerId: 1, startedAt: -1 });
CallLogSchema.index({ twilioPhoneNumber: 1, startedAt: -1 });

module.exports = mongoose.model('CallLog', CallLogSchema);

