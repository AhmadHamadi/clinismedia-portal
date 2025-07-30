require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const OnboardingTask = require('../models/OnboardingTask');
const EmailNotificationSettings = require('../models/EmailNotificationSettings');
const bcrypt = require('bcryptjs');

// Sample data for testing
const sampleUsers = [
  {
    name: 'Admin User',
    username: 'admin',
    email: 'admin@clinimedia.ca',
    password: 'admin123',
    role: 'admin'
  },
  {
    name: 'Test Clinic',
    username: 'testclinic',
    email: 'test@clinic.com',
    password: 'clinic123',
    role: 'customer',
    department: 'Dental',
    bookingIntervalMonths: 3,
    portalVisibility: true
  },
  {
    name: 'Test Employee',
    username: 'employee',
    email: 'employee@clinimedia.ca',
    password: 'employee123',
    role: 'employee',
    department: 'Marketing'
  }
];

const sampleOnboardingTasks = [
  { category: 'Communication & Coordination', title: 'Create and confirm WhatsApp group for all stakeholders', description: '' },
  { category: 'Communication & Coordination', title: 'Set communication protocols and main contacts', description: '' },
  { category: 'Platform Access & Credentials', title: 'Get Instagram credentials for posting and analytics', description: '' },
  { category: 'Platform Access & Credentials', title: 'Request admin access to Facebook Page via info@clinimedia.ca', description: '' },
  { category: 'Platform Access & Credentials', title: 'Set up or access Meta Business/Ads Manager', description: '' },
  { category: 'Platform Access & Credentials', title: 'Get or create Google Business Profile admin access', description: '' },
  { category: 'Platform Access & Credentials', title: 'Set up or access Google Analytics & Search Console', description: '' },
  { category: 'Platform Access & Credentials', title: 'Get CMS login (WordPress, Wix, etc.) with proper roles', description: '' },
  { category: 'Platform Access & Credentials', title: 'Get hosting provider access', description: '' },
  { category: 'Platform Access & Credentials', title: 'Get domain registrar access (if needed)', description: '' },
  { category: 'Platform Access & Credentials', title: 'Confirm admin rights on all platforms', description: '' },
  { category: 'Brand Assets & Guidelines', title: 'Collect logos, brand guidelines, and tone of voice docs', description: '' },
  { category: 'Brand Assets & Guidelines', title: 'Confirm or document brand messaging style', description: '' },
  { category: 'Content Planning & Creation', title: 'Complete content strategy and posting calendar', description: '' },
  { category: 'Content Planning & Creation', title: 'Define content approval and feedback process', description: '' },
  { category: 'Content Planning & Creation', title: 'Develop first-month content plan (stories, highlights, posts)', description: '' },
  { category: 'Content Planning & Creation', title: 'Request extra materials (team photos, treatments, testimonials)', description: '' },
  { category: 'Advertising Setup & Budget', title: 'Confirm ad budget, campaign goals, targeting, and timeline', description: '' },
  { category: 'Advertising Setup & Budget', title: 'Review existing Meta ads and past performance', description: '' },
  { category: 'Website & SEO Audit', title: 'Audit website/socials for SEO and content quality', description: '' },
  { category: 'Website & SEO Audit', title: 'Check for conversion optimization opportunities', description: '' },
  { category: 'Website & SEO Audit', title: 'Review technical SEO (speed, mobile, indexing)', description: '' }
];

const sampleEmailSettings = [
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

async function setupTestDatabase() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear all collections
    console.log('🧹 Clearing existing data...');
    await mongoose.connection.db.dropDatabase();
    console.log('✅ Database cleared');

    // Create users with hashed passwords
    console.log('👥 Creating users...');
    const hashedUsers = await Promise.all(
      sampleUsers.map(async (user) => ({
        ...user,
        password: await bcrypt.hash(user.password, 10)
      }))
    );
    await User.insertMany(hashedUsers);
    console.log(`✅ Created ${hashedUsers.length} users`);

    // Create onboarding tasks
    console.log('📋 Creating onboarding tasks...');
    await OnboardingTask.insertMany(sampleOnboardingTasks);
    console.log(`✅ Created ${sampleOnboardingTasks.length} onboarding tasks`);

    // Create email notification settings
    console.log('📧 Creating email notification settings...');
    await EmailNotificationSettings.insertMany(sampleEmailSettings);
    console.log(`✅ Created ${sampleEmailSettings.length} email notification settings`);

    console.log('\n🎉 Test database setup complete!');
    console.log('\n📝 Login Credentials:');
    console.log('Admin: username=admin, password=admin123');
    console.log('Customer: username=testclinic, password=clinic123');
    console.log('Employee: username=employee, password=employee123');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error setting up test database:', error);
    process.exit(1);
  }
}

// Run the setup
setupTestDatabase(); 