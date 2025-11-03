const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

// Get all customers with their shared folder assignments (admin only)
router.get('/customers', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const customers = await User.find({ role: 'customer' }).select('name email location sharedFolderLink sharedFolderName _id');
    res.json(customers);
  } catch (error) {
    console.error('Error fetching customers with shared folders:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Save shared folder assignment (admin only)
router.post('/assign', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { customerId, folderLink, folderName } = req.body;
  
  try {
    if (!customerId || !folderLink) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const user = await User.findByIdAndUpdate(
      customerId,
      {
        sharedFolderLink: folderLink,
        sharedFolderName: folderName || 'Shared Folder',
      },
      { new: true }
    );
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Send email notification to customer about new shared folder content
    try {
      if (user.email && folderLink) {
        const EmailService = require('../services/emailService');
        await EmailService.sendNewContentNotification(
          user.name,
          user.email,
          'Shared Folder',
          folderLink,
          folderName || 'Shared Folder'
        );
        console.log(`✅ Shared folder notification email sent to ${user.email}`);
      }
    } catch (emailError) {
      console.error('❌ Failed to send shared folder notification email:', emailError);
      // Don't fail the main operation if email fails
    }
    
    console.log(`Successfully assigned shared folder to clinic: ${user.name}`);
    res.json({ message: 'Shared folder assigned successfully!', user });
  } catch (error) {
    console.error('Error assigning shared folder:', error);
    res.status(500).json({ error: 'Failed to assign shared folder' });
  }
});

// Remove shared folder assignment (admin only)
router.post('/remove', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { customerId } = req.body;
  
  try {
    if (!customerId) {
      return res.status(400).json({ error: 'Missing customer ID' });
    }

    const user = await User.findByIdAndUpdate(
      customerId,
      {
        sharedFolderLink: null,
        sharedFolderName: null,
      },
      { new: true }
    );
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    console.log(`Successfully removed shared folder from clinic: ${user.name}`);
    res.json({ message: 'Shared folder removed successfully!', user });
  } catch (error) {
    console.error('Error removing shared folder:', error);
    res.status(500).json({ error: 'Failed to remove shared folder' });
  }
});

// Get customer's shared folder info (customer only)
router.get('/my-folder', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('sharedFolderLink sharedFolderName name');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      folderLink: user.sharedFolderLink,
      folderName: user.sharedFolderName,
      customerName: user.name,
      hasFolder: !!user.sharedFolderLink
    });
  } catch (error) {
    console.error('Error fetching customer shared folder:', error);
    res.status(500).json({ error: 'Failed to fetch shared folder info' });
  }
});

module.exports = router;
