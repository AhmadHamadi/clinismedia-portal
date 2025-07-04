const mongoose = require('mongoose');

const assignedGalleryItemSchema = new mongoose.Schema({
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  galleryItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GalleryItem',
    required: true,
  },
  isCurrent: {
    type: Boolean,
    default: false,
  },
  assignedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

module.exports = mongoose.model('AssignedGalleryItem', assignedGalleryItemSchema); 