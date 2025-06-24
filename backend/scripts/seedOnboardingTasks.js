require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const OnboardingTask = require('../models/OnboardingTask');

const tasks = [
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
  { category: 'Website & SEO Audit', title: 'Review technical SEO (speed, mobile, indexing)', description: '' },
];

async function seed() {
  require('dotenv').config();
  await mongoose.connect(process.env.MONGODB_URI);
  await OnboardingTask.deleteMany({});
  await OnboardingTask.insertMany(tasks);
  console.log('Seeded onboarding tasks!');
  process.exit();
}

seed(); 