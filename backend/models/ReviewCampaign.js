const mongoose = require('mongoose');

const reviewCampaignSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  clinicName: {
    type: String,
    required: true,
    trim: true
  },
  googleReviewUrl: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  experienceHighlights: [{
    label: { type: String, required: true, trim: true },
    category: { type: String, enum: ['staff', 'clinic', 'process', 'provider', 'service'], default: 'staff' },
    sentences: [{ type: String, trim: true }]
  }],
  adminEmail: {
    type: String,
    trim: true
  },
  logoUrl: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// slug index already created by `unique: true` on the field
reviewCampaignSchema.index({ customerId: 1 });

// Auto-generate slug from clinicName if not provided
reviewCampaignSchema.pre('validate', function(next) {
  if (!this.slug && this.clinicName) {
    this.slug = this.clinicName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  next();
});

const ReviewCampaign = mongoose.model('ReviewCampaign', reviewCampaignSchema);

module.exports = ReviewCampaign;
