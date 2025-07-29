const mongoose = require('mongoose');
const EmailNotificationSettings = require('../models/EmailNotificationSettings');
require('dotenv').config();

const defaultSettings = [
  {
    notificationType: 'onboarding_task_created',
    isEnabled: true,
    sendAutomatically: true,
    subject: 'New Onboarding Task: {taskName}',
    template: `Hi {clinicName},

A new onboarding task has been created for your clinic.

Task: {taskName}
Description: {taskDescription}
Due Date: {dueDate}

Please log in to your dashboard to view the full details and complete this task.

Best regards,
CliniMedia Team`,
    description: 'Sent when a new onboarding task is created for a customer'
  },
  {
    notificationType: 'onboarding_task_pending',
    isEnabled: true,
    sendAutomatically: true,
    subject: 'Onboarding Task Pending: {taskName}',
    template: `Hi {clinicName},

Your onboarding task is now pending review.

Task: {taskName}
Status: Pending
Submitted: {submittedDate}

Our team will review your submission and update the status accordingly.

Best regards,
CliniMedia Team`,
    description: 'Sent when an onboarding task status changes to pending'
  },
  {
    notificationType: 'onboarding_task_completed',
    isEnabled: true,
    sendAutomatically: true,
    subject: 'Onboarding Task Completed: {taskName}',
    template: `Hi {clinicName},

Congratulations! Your onboarding task has been completed.

Task: {taskName}
Status: Completed
Completed Date: {completedDate}

Great job! This brings you one step closer to having your clinic fully set up.

Best regards,
CliniMedia Team`,
    description: 'Sent when an onboarding task is marked as completed'
  }
];

async function seedEmailNotificationSettings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing settings
    await EmailNotificationSettings.deleteMany({});
    console.log('Cleared existing email notification settings');

    // Insert default settings
    const result = await EmailNotificationSettings.insertMany(defaultSettings);
    console.log(`✅ Successfully seeded ${result.length} email notification settings`);

    // Log the created settings
    result.forEach(setting => {
      console.log(`- ${setting.notificationType}: ${setting.description}`);
    });

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error seeding email notification settings:', error);
    process.exit(1);
  }
}

// Run the seeding function
seedEmailNotificationSettings(); 