const express = require('express');
const router = express.Router();
const EmailNotificationSettings = require('../models/EmailNotificationSettings');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

// Get all email notification settings (Admin only)
router.get('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const settings = await EmailNotificationSettings.find().sort({ notificationType: 1 });
    res.json(settings);
  } catch (error) {
    console.error('Error fetching email notification settings:', error);
    res.status(500).json({ message: 'Failed to fetch email notification settings' });
  }
});

// Get specific email notification setting (Admin only)
router.get('/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const setting = await EmailNotificationSettings.findById(req.params.id);
    if (!setting) {
      return res.status(404).json({ message: 'Email notification setting not found' });
    }
    res.json(setting);
  } catch (error) {
    console.error('Error fetching email notification setting:', error);
    res.status(500).json({ message: 'Failed to fetch email notification setting' });
  }
});

// Update email notification setting (Admin only)
router.patch('/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { isEnabled, sendAutomatically, subject, template } = req.body;
    
    const setting = await EmailNotificationSettings.findById(req.params.id);
    if (!setting) {
      return res.status(404).json({ message: 'Email notification setting not found' });
    }

    // Update fields if provided
    if (typeof isEnabled === 'boolean') {
      setting.isEnabled = isEnabled;
    }
    if (typeof sendAutomatically === 'boolean') {
      setting.sendAutomatically = sendAutomatically;
    }
    if (subject) {
      setting.subject = subject;
    }
    if (template) {
      setting.template = template;
    }

    const updatedSetting = await setting.save();
    res.json(updatedSetting);
  } catch (error) {
    console.error('Error updating email notification setting:', error);
    res.status(500).json({ message: 'Failed to update email notification setting' });
  }
});

// Create new email notification setting (Admin only)
router.post('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { notificationType, isEnabled, sendAutomatically, subject, template, description } = req.body;
    
    // Check if setting already exists for this type
    const existingSetting = await EmailNotificationSettings.findOne({ notificationType });
    if (existingSetting) {
      return res.status(400).json({ message: 'Email notification setting already exists for this type' });
    }

    const newSetting = new EmailNotificationSettings({
      notificationType,
      isEnabled: isEnabled ?? true,
      sendAutomatically: sendAutomatically ?? true,
      subject,
      template,
      description
    });

    const savedSetting = await newSetting.save();
    res.status(201).json(savedSetting);
  } catch (error) {
    console.error('Error creating email notification setting:', error);
    res.status(500).json({ message: 'Failed to create email notification setting' });
  }
});

// Delete email notification setting (Admin only)
router.delete('/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const setting = await EmailNotificationSettings.findById(req.params.id);
    if (!setting) {
      return res.status(404).json({ message: 'Email notification setting not found' });
    }

    await setting.deleteOne();
    res.json({ message: 'Email notification setting deleted successfully' });
  } catch (error) {
    console.error('Error deleting email notification setting:', error);
    res.status(500).json({ message: 'Failed to delete email notification setting' });
  }
});

// Manual send email notification (Admin only)
router.post('/:id/send', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const setting = await EmailNotificationSettings.findById(req.params.id);
    if (!setting) {
      return res.status(404).json({ message: 'Email notification setting not found' });
    }

    if (!setting.isEnabled) {
      return res.status(400).json({ message: 'This notification type is disabled' });
    }

    // Get all customers for manual send
    const User = require('../models/User');
    const customers = await User.find({ role: 'customer' });

    // Send email to all customers (for demo purposes)
    const EmailService = require('../services/emailService');
    let sentCount = 0;

    for (const customer of customers) {
      try {
        // Create a sample task for demonstration
        const sampleTask = {
          title: 'Sample Task',
          description: 'This is a manual test email',
          dueDate: new Date().toLocaleDateString()
        };

        // Use the appropriate email service based on notification type
        const OnboardingEmailService = require('../services/onboardingEmailService');
        
        switch (setting.notificationType) {
          case 'onboarding_task_created':
            await OnboardingEmailService.sendTaskCreatedEmail(customer, sampleTask);
            break;
          case 'onboarding_task_pending':
            await OnboardingEmailService.sendTaskPendingEmail(customer, sampleTask);
            break;
          case 'onboarding_task_completed':
            await OnboardingEmailService.sendTaskCompletedEmail(customer, sampleTask);
            break;
          default:
            console.log(`Unknown notification type: ${setting.notificationType}`);
        }
        sentCount++;
      } catch (error) {
        console.error(`Failed to send email to ${customer.name}:`, error);
      }
    }

    res.json({ 
      message: `Manual send completed. Sent ${sentCount} emails to ${customers.length} customers.`,
      sentCount,
      totalCustomers: customers.length
    });
  } catch (error) {
    console.error('Error in manual send:', error);
    res.status(500).json({ message: 'Failed to send emails manually' });
  }
});

// Send custom email notification (Admin only)
router.post('/send-custom', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { clinicId, subject, body, clinicEmail } = req.body;

    if (!clinicId || !subject || !body || !clinicEmail) {
      return res.status(400).json({ message: 'Missing required fields: clinicId, subject, body, clinicEmail' });
    }

    // Send the custom email
    const EmailService = require('../services/emailService');
    
    await EmailService.sendEmail(
      subject,
      body,
      clinicEmail,
      'Failed to send custom email:'
    );

    res.json({ 
      message: `Custom email sent successfully to ${clinicEmail}`,
      subject,
      recipient: clinicEmail
    });
  } catch (error) {
    console.error('Error in custom email send:', error);
    res.status(500).json({ message: 'Failed to send custom email' });
  }
});

module.exports = router; 