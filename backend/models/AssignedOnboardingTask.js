const mongoose = require('mongoose');

const assignedOnboardingTaskSchema = new mongoose.Schema({
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OnboardingTask',
    required: true,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ['not_started', 'pending', 'completed'],
    default: 'not_started',
  },
  completedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('AssignedOnboardingTask', assignedOnboardingTaskSchema); 