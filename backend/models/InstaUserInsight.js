const mongoose = require('mongoose');

const instaUserInsightSchema = new mongoose.Schema({
  account_id: { 
    type: String, 
    required: true,
    index: true 
  },
  customer_id: { 
    type: String, 
    required: true,
    index: true 
  },
  period: {
    type: String,
    required: true
  },
  metric: { 
    type: String, 
    required: true,
    index: true 
  },
  value: {
    type: Number,
    required: true,
    default: 0
  },
  end_time: { 
    type: Date, 
    required: true,
    index: true 
  },
  source: {
    type: String,
    default: 'instagram_user'
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
instaUserInsightSchema.index({ customer_id: 1, end_time: -1, metric: 1 });
instaUserInsightSchema.index({ account_id: 1, end_time: -1 });

const InstaUserInsight = mongoose.model('InstaUserInsight', instaUserInsightSchema);

module.exports = InstaUserInsight;
