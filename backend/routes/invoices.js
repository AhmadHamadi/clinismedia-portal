const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Invoice = require('../models/Invoice');
const AssignedInvoice = require('../models/AssignedInvoice');
const User = require('../models/User');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

// Set up multer for PDF uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../uploads/invoices');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Upload a new invoice PDF (admin only)
router.post('/upload', authenticateToken, authorizeRole(['admin']), upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { name } = req.body;
    const url = `/api/invoices/file/${req.file.filename}`;
    const invoice = new Invoice({ name, url });
    await invoice.save();
    res.status(201).json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET invoice file (authenticated)
router.get('/file/:filename', authenticateToken, (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../uploads/invoices', filename);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// GET invoice view (authenticated)
router.get('/view/:filename', authenticateToken, (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../uploads/invoices', filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// Get all invoices (admin only)
router.get('/', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ date: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an invoice (admin only)
router.delete('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    // Delete file from disk
    const filePath = path.join(__dirname, '../uploads/invoices', path.basename(invoice.url));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    // Delete all assignments for this invoice
    await AssignedInvoice.deleteMany({ invoiceId: req.params.id });
    res.json({ message: 'Invoice deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign invoices to a clinic (admin only)
router.post('/assign', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { clinicId, invoiceIds } = req.body;
    // Set all existing assignments for this clinic to not current
    await AssignedInvoice.updateMany(
      { clinicId },
      { isCurrent: false }
    );
    // Create new assignments
    const assignments = [];
    for (const invoiceId of invoiceIds) {
      const assignment = new AssignedInvoice({
        clinicId,
        invoiceId,
        isCurrent: true
      });
      assignments.push(assignment);
    }
    await AssignedInvoice.insertMany(assignments);
    res.json({ message: 'Invoices assigned successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get assigned invoices for a clinic (customer portal)
router.get('/assigned/:clinicId', authenticateToken, authorizeRole(['admin', 'customer']), async (req, res) => {
  try {
    const { clinicId } = req.params;
    const assigned = await AssignedInvoice.find({ clinicId })
      .populate('invoiceId')
      .sort({ assignedAt: -1 });
    res.json(assigned);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all clinics and their assigned invoices (admin overview)
router.get('/assignments/all', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const clinics = await User.find({ role: 'customer' });
    const assignments = await AssignedInvoice.find()
      .populate('invoiceId clinicId')
      .sort({ assignedAt: -1 });
    res.json({ clinics, assignments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update assignment status (admin only)
router.post('/update-assignment', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { clinicId, invoiceId, isCurrent } = req.body;
    if (isCurrent) {
      await AssignedInvoice.updateMany(
        { clinicId },
        { isCurrent: false }
      );
    }
    const assignment = await AssignedInvoice.findOneAndUpdate(
      { clinicId, invoiceId },
      { isCurrent },
      { new: true }
    );
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    res.json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove an assigned invoice from a clinic (admin only)
router.post('/remove-assignment', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { clinicId, invoiceId } = req.body;
    await AssignedInvoice.findOneAndDelete({ clinicId, invoiceId });
    res.json({ message: 'Assignment removed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update an invoice (admin only)
router.put('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { name, date } = req.body;
    const update = { name };
    if (date) update.date = date;
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 