const mongoose = require('mongoose');

const assignedInvoiceSchema = new mongoose.Schema({
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
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

module.exports = mongoose.model('AssignedInvoice', assignedInvoiceSchema); 