const mongoose = require('mongoose');

const reviewGenerationSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReviewSession',
    required: true
  },
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReviewCampaign',
    required: true
  },
  reviewText: {
    type: String,
    required: true
  },
  sentenceBankDraft: {
    type: String,
    required: true
  },
  aiPolished: {
    type: Boolean,
    default: false
  },
  wordCount: {
    type: Number
  },
  sentenceCount: {
    type: Number
  },
  generationNumber: {
    type: Number,
    required: true,
    default: 1
  },
  wasRegenerated: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

reviewGenerationSchema.index({ sessionId: 1 });

const ReviewGeneration = mongoose.model('ReviewGeneration', reviewGenerationSchema);

module.exports = ReviewGeneration;
