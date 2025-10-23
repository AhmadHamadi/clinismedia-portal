const express = require('express');
const router = express.Router();
const ClientNote = require('../models/ClientNote');
const User = require('../models/User');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

// Create a new client note (customer only)
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { note } = req.body;
    
    if (!note || !note.trim()) {
      return res.status(400).json({ error: 'Note is required' });
    }

    if (note.length > 1000) {
      return res.status(400).json({ error: 'Note must be 1000 characters or less' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create note with 30-day expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const clientNote = new ClientNote({
      customerId: req.user.id,
      customerName: user.name,
      note: note.trim(),
      expiresAt: expiresAt
    });

    await clientNote.save();

    res.json({ 
      message: 'Note submitted successfully!',
      note: clientNote
    });
  } catch (error) {
    console.error('Error creating client note:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// Get customer's own notes (customer only)
router.get('/my-notes', authenticateToken, async (req, res) => {
  try {
    const notes = await ClientNote.find({
      customerId: req.user.id,
      expiresAt: { $gt: new Date() } // Only non-expired notes
    })
    .sort({ createdAt: -1 })
    .limit(10); // Limit to last 10 notes

    res.json(notes);
  } catch (error) {
    console.error('Error fetching customer notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Get all client notes for admin (admin only)
router.get('/all', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    
    let query = {
      expiresAt: { $gt: new Date() } // Only non-expired notes
    };

    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const notes = await ClientNote.find(query)
      .populate('customerId', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ClientNote.countDocuments(query);

    res.json({
      notes,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching all client notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Get unread notes count for admin (admin only)
router.get('/unread-count', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const count = await ClientNote.countDocuments({
      isRead: false,
      expiresAt: { $gt: new Date() }
    });

    res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Mark note as read (admin only)
router.patch('/mark-read/:noteId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const note = await ClientNote.findByIdAndUpdate(
      req.params.noteId,
      { 
        isRead: true,
        readAt: new Date()
      },
      { new: true }
    );

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ message: 'Note marked as read', note });
  } catch (error) {
    console.error('Error marking note as read:', error);
    res.status(500).json({ error: 'Failed to mark note as read' });
  }
});

// Mark all notes as read (admin only)
router.patch('/mark-all-read', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    await ClientNote.updateMany(
      { 
        isRead: false,
        expiresAt: { $gt: new Date() }
      },
      { 
        isRead: true,
        readAt: new Date()
      }
    );

    res.json({ message: 'All notes marked as read' });
  } catch (error) {
    console.error('Error marking all notes as read:', error);
    res.status(500).json({ error: 'Failed to mark all notes as read' });
  }
});

// Delete expired notes (admin only) - can be called periodically
router.delete('/cleanup-expired', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const result = await ClientNote.deleteMany({
      expiresAt: { $lte: new Date() }
    });

    res.json({ 
      message: `Deleted ${result.deletedCount} expired notes`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error cleaning up expired notes:', error);
    res.status(500).json({ error: 'Failed to cleanup expired notes' });
  }
});

module.exports = router;
