const mongoose = require('mongoose');

const galleryItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model('GalleryItem', galleryItemSchema); 