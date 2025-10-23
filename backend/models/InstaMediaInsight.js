const mongoose = require('mongoose');

const instaMediaInsightSchema = new mongoose.Schema({
  account_id: { 
    type: String, 
    required: true,
    index: true 
  },
  media_id: { 
    type: String, 
    required: true,
    index: true 
  },
  media_type: {
    type: String,
    required: true
  },
  caption: {
    type: String,
    default: ''
  },
  permalink: {
    type: String,
    default: ''
  },
  posted_at: { 
    type: Date, 
    required: true,
    index: true 
  },
  metrics: {
    reach: {
      type: Number,
      default: 0
    },
    impressions: {
      type: Number,
      default: 0
    },
    likes: {
      type: Number,
      default: 0
    },
    comments: {
      type: Number,
      default: 0
    },
    saves: {
      type: Number,
      default: 0
    },
    engagement: {
      type: Number,
      default: 0
    },
    plays: {
      type: Number,
      default: 0
    }
  },
  customer_id: { 
    type: String, 
    required: true,
    index: true 
  },
  source: {
    type: String,
    default: 'instagram_media'
  },
  idem: { 
    type: String, 
    unique: true,
    required: true
  }
}, { 
  timestamps: true 
});

// Compound indexes for efficient dashboard queries
instaMediaInsightSchema.index({ customer_id: 1, posted_at: -1, media_id: 1 });
instaMediaInsightSchema.index({ account_id: 1, posted_at: -1 });

const InstaMediaInsight = mongoose.model('InstaMediaInsight', instaMediaInsightSchema);

module.exports = InstaMediaInsight;
