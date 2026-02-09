const mongoose = require('mongoose');
const crypto = require('crypto');

const reviewSessionSchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReviewCampaign',
    required: true
  },
  sessionToken: {
    type: String,
    required: true,
    unique: true
  },
  patientName: {
    type: String,
    trim: true
  },
  selectedHighlights: [{
    type: String,
    trim: true
  }],
  freeText: {
    type: String,
    trim: true,
    maxlength: 120
  },
  staffName: {
    type: String,
    trim: true,
    maxlength: 60
  },
  reviewLength: {
    type: String,
    enum: ['short', 'medium'],
    default: 'medium'
  },
  pathSelected: {
    type: String,
    enum: ['great', 'concern']
  },
  googleClicked: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['started', 'review_generated', 'copied', 'concern_submitted', 'abandoned'],
    default: 'started'
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  generationCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

reviewSessionSchema.index({ campaignId: 1, createdAt: -1 });
// sessionToken index already created by `unique: true` on the field
reviewSessionSchema.index({ ipAddress: 1, createdAt: -1 });

// Auto-generate session token
reviewSessionSchema.pre('validate', function(next) {
  if (!this.sessionToken) {
    this.sessionToken = crypto.randomBytes(32).toString('hex');
  }
  next();
});

const ReviewSession = mongoose.model('ReviewSession', reviewSessionSchema);

module.exports = ReviewSession;
