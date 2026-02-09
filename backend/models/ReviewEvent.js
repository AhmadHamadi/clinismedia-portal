const mongoose = require('mongoose');

const reviewEventSchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReviewCampaign',
    required: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReviewSession'
  },
  eventType: {
    type: String,
    enum: [
      'session_started',
      'path_selected',
      'review_generated',
      'review_copied',
      'google_clicked',
      'concern_submitted'
    ],
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

reviewEventSchema.index({ campaignId: 1, eventType: 1 });
reviewEventSchema.index({ campaignId: 1, createdAt: -1 });

const ReviewEvent = mongoose.model('ReviewEvent', reviewEventSchema);

module.exports = ReviewEvent;
