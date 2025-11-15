// backend/server.js
// Load environment variables FIRST before any other imports
const path = require('path');
const dotenv = require('dotenv');

// Debug: Check what's in process.env BEFORE loading .env
console.log('🔍 BEFORE loading .env:');
console.log('   QUICKBOOKS_ENVIRONMENT (system):', process.env.QUICKBOOKS_ENVIRONMENT);

// Explicitly load .env from backend directory with override enabled
// override: true ensures .env values override any existing system/env variables
const envPath = path.join(__dirname, '.env');
const result = dotenv.config({ 
  path: envPath,
  override: true // IMPORTANT: Override any existing env vars (like from system or Railway)
});

// Debug: Check what's in process.env AFTER loading .env
console.log('🔍 AFTER loading .env:');
console.log('   QUICKBOOKS_ENVIRONMENT (after .env):', process.env.QUICKBOOKS_ENVIRONMENT);

// Debug: Verify environment variables are loaded
console.log('🔍 Server Startup - Environment Check:');
console.log('   .env file path:', envPath);
if (result.error) {
  console.error('   ❌ ERROR loading .env file:', result.error);
} else {
  console.log('   ✅ .env file loaded successfully (with override: true)');
}
console.log('   QUICKBOOKS_ENVIRONMENT:', process.env.QUICKBOOKS_ENVIRONMENT);
console.log('   QUICKBOOKS_CLIENT_ID:', process.env.QUICKBOOKS_CLIENT_ID ? 'SET' : 'NOT SET');
console.log('   NODE_ENV:', process.env.NODE_ENV);

const express = require("express");
const cors = require("cors");           // Add CORS
const connectDB = require("./config/db");
const ScheduledEmailService = require("./services/scheduledEmailService");
const GoogleBusinessDataRefreshService = require("./services/googleBusinessDataRefreshService");
const metaLeadsEmailService = require("./services/metaLeadsEmailService");
const QuickBooksTokenRefreshService = require("./services/quickbooksTokenRefreshService");
const { sessionManager } = require("./middleware/sessionManager");

const app = express();

// Enable CORS for your frontend origin
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

connectDB();

app.use(express.json());
// Support URL-encoded bodies (for Twilio webhooks)
app.use(express.urlencoded({ extended: true }));

// Import routes
const authRoutes = require("./routes/auth");
const customerRoutes = require("./routes/customers");
const employeeRoutes = require("./routes/employees");
const bookingRoutes = require("./routes/bookings");
const blockedDateRoutes = require("./routes/blockedDates");
const onboardingTasksRoutes = require("./routes/onboardingTasks");
const facebookRoutes = require('./routes/facebook');
const googleAdsRoutes = require('./routes/googleAds');
const sharedFoldersRoutes = require('./routes/sharedFolders');
const clientNotesRoutes = require('./routes/clientNotes');
const galleryRoutes = require('./routes/gallery');
const invoicesRoutes = require('./routes/invoices');
const instagramInsightsRoutes = require('./routes/instagramInsights');
const instagramInsightsApiRoutes = require('./routes/instagramInsightsApi');
const instagramInsightsImagesRoutes = require('./routes/instagramInsightsImages');
const emailNotificationSettingsRoutes = require('./routes/emailNotificationSettings');
const customerNotificationsRoutes = require('./routes/customerNotifications');
const googleBusinessRoutes = require('./routes/googleBusiness');
const twilioRoutes = require('./routes/twilio');
const metaLeadsRoutes = require('./routes/metaLeads');
const quickbooksRoutes = require('./routes/quickbooks');

app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/blocked-dates", blockedDateRoutes);
app.use("/api/onboarding-tasks", onboardingTasksRoutes);
app.use('/api/facebook', facebookRoutes);
app.use('/api/google-ads', googleAdsRoutes);
app.use('/api/shared-folders', sharedFoldersRoutes);
app.use('/api/client-notes', clientNotesRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/instagram-insights', instagramInsightsRoutes);
app.use('/api/instagram-insights', instagramInsightsApiRoutes);
app.use('/api/instagram-insights', instagramInsightsImagesRoutes);
app.use('/api/email-notification-settings', emailNotificationSettingsRoutes);
app.use('/api/customer-notifications', customerNotificationsRoutes);
app.use('/api/google-business', googleBusinessRoutes);
app.use('/api/twilio', twilioRoutes);
app.use('/api/meta-leads', metaLeadsRoutes);
app.use('/api/quickbooks', quickbooksRoutes);
app.use('/uploads/instagram-insights', express.static(__dirname + '/uploads/instagram-insights'));
app.use('/uploads/invoices', express.static(__dirname + '/uploads/invoices'));
app.use('/uploads/customer-logos', express.static(__dirname + '/uploads/customer-logos'));

// Root route
app.get("/", (req, res) => {
  res.send("CliniMedia Portal API is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`🌐 Public URL: ${process.env.RAILWAY_PUBLIC_DOMAIN || 'Not set'}`);
  
  // Set up daily Google Business Profile data refresh (runs every day at 8 AM)
  setInterval(async () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Run at 8:00 AM daily
    if (hours === 8 && minutes === 0) {
      await GoogleBusinessDataRefreshService.refreshAllBusinessProfiles();
    }
  }, 60000); // Check every minute
  
  // Set up daily reminder emails (runs every day at 9 AM)
  setInterval(async () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Run at 9:00 AM daily
    if (hours === 9 && minutes === 0) {
      await ScheduledEmailService.sendDailyReminders();
      await ScheduledEmailService.sendProactiveBookingReminders();
    }
  }, 60000); // Check every minute
  
  // Set up session cleanup (runs every hour)
  setInterval(() => {
    sessionManager.cleanupOldSessions();
    sessionManager.forceDailyReset();
    console.log("🧹 Cleaned up old sessions");
  }, 60 * 60 * 1000); // Every hour
  
  // Also run once on server start for testing
  GoogleBusinessDataRefreshService.refreshAllBusinessProfiles();
  ScheduledEmailService.sendDailyReminders();
  ScheduledEmailService.sendProactiveBookingReminders();
  
  // Start Meta leads email monitoring (checks every 5 minutes)
  const leadsCheckInterval = parseInt(process.env.META_LEADS_CHECK_INTERVAL) || 5;
  metaLeadsEmailService.startMonitoring(leadsCheckInterval);
  
  // Start QuickBooks token refresh service (runs every 30 minutes)
  QuickBooksTokenRefreshService.start();
});