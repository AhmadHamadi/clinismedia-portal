const mongoose = require('mongoose');

const blockedDateSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true
  }
});

const BlockedDate = mongoose.model('BlockedDate', blockedDateSchema);

module.exports = BlockedDate; 