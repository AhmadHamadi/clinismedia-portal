const mongoose = require('mongoose');

const metaLeadSubjectMappingSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  emailSubject: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  // Case-insensitive matching support
  emailSubjectLower: {
    type: String,
    required: true,
    index: true,
    lowercase: true
  },
  // Active status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  // Notes
  notes: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Ensure one mapping per subject
metaLeadSubjectMappingSchema.index({ emailSubject: 1 }, { unique: true });

module.exports = mongoose.model('MetaLeadSubjectMapping', metaLeadSubjectMappingSchema);

