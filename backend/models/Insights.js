const mongoose = require('mongoose');

const insightsSchema = new mongoose.Schema({
  locationId: { 
    type: String, 
    required: true,
    index: true 
  },
  title: {
    type: String,
    required: true
  },
  range: { 
    start: { type: Date, required: true },
    end: { type: Date, required: true }
  },
  metrics: {
    type: mongoose.Schema.Types.Mixed, // Store raw API timeSeries OR summarized totals
    required: true
  },
  summary: {
    totalViews: { type: Number, default: 0 },
    totalSearches: { type: Number, default: 0 },
    totalCalls: { type: Number, default: 0 },
    totalDirections: { type: Number, default: 0 },
    totalWebsiteClicks: { type: Number, default: 0 }
  },
  dailyData: [{
    date: { type: String, required: true },
    views: { type: Number, default: 0 },
    searches: { type: Number, default: 0 },
    calls: { type: Number, default: 0 },
    directions: { type: Number, default: 0 },
    websiteClicks: { type: Number, default: 0 }
  }],
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
insightsSchema.index({ locationId: 1, 'range.start': 1, 'range.end': 1 });

module.exports = mongoose.model('Insights', insightsSchema);


