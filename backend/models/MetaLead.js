const mongoose = require('mongoose');

const metaLeadSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  emailSubject: {
    type: String,
    required: true,
    index: true
  },
  // Lead information extracted from email
  leadInfo: {
    name: String,
    email: String,
    phone: String,
    message: String,
    // Store raw email content for reference
    rawContent: String,
    // Store parsed fields as flexible object
    fields: mongoose.Schema.Types.Mixed
  },
  // Email metadata
  emailFrom: {
    type: String,
    default: null
  },
  emailDate: {
    type: Date,
    required: true,
    index: true
  },
  emailMessageId: {
    type: String,
    unique: true,
    index: true,
    sparse: true // Allow nulls
  },
  // Lead status tracking
  status: {
    type: String,
    enum: ['new', 'contacted', 'not_contacted'],
    default: 'new',
    index: true
  },
  contactedAt: {
    type: Date,
    default: null,
    index: true
  },
  notContactedAt: {
    type: Date,
    default: null,
    index: true
  },
  notContactedReason: {
    type: String,
    default: null // Reason why lead was not contacted
  },
  // Appointment booking tracking
  appointmentBooked: {
    type: Boolean,
    default: null // null = not set, true = booked, false = not booked
  },
  appointmentBookedAt: {
    type: Date,
    default: null
  },
  appointmentBookingReason: {
    type: String,
    default: null // Reason why appointment was or wasn't booked
  },
  // Notes
  notes: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
metaLeadSchema.index({ customerId: 1, emailDate: -1 });
metaLeadSchema.index({ customerId: 1, status: 1 });
metaLeadSchema.index({ customerId: 1, appointmentBooked: 1 });
metaLeadSchema.index({ emailDate: -1 });

module.exports = mongoose.model('MetaLead', metaLeadSchema);

