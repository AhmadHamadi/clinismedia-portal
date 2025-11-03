const mongoose = require('mongoose');

const GoogleBusinessInsightsSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  locationId: {
    type: String,
    required: true,
    index: true
  },
  businessProfileName: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  metrics: {
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
  period: {
    start: { type: String, required: true },
    end: { type: String, required: true },
    days: { type: Number, required: true }
  },
  rawApiData: {
    type: mongoose.Schema.Types.Mixed,
    required: false // Store raw API response for debugging
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate entries for same customer/date/period
GoogleBusinessInsightsSchema.index({ 
  customerId: 1, 
  date: 1, 
  'period.start': 1, 
  'period.end': 1 
}, { unique: true });

// Index for efficient queries by customer and date range
GoogleBusinessInsightsSchema.index({ customerId: 1, date: -1 });

module.exports = mongoose.model('GoogleBusinessInsights', GoogleBusinessInsightsSchema);

