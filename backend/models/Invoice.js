const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: { type: String, required: true }, // PDF file path or link
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Invoice', invoiceSchema); 