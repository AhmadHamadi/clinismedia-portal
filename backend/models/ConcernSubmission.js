const mongoose = require('mongoose');

const concernSubmissionSchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReviewCampaign',
    required: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReviewSession'
  },
  patientName: {
    type: String,
    trim: true
  },
  patientContact: {
    type: String,
    trim: true
  },
  concernText: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['new', 'reviewed', 'resolved'],
    default: 'new'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  }
}, {
  timestamps: true
});

concernSubmissionSchema.index({ campaignId: 1, createdAt: -1 });
concernSubmissionSchema.index({ status: 1 });

const ConcernSubmission = mongoose.model('ConcernSubmission', concernSubmissionSchema);

module.exports = ConcernSubmission;
