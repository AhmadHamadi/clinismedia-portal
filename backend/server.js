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
const GoogleAdsTokenRefreshService = require("./services/googleAdsTokenRefreshService");
const GoogleBusinessAdminTokenRefreshService = require("./services/googleBusinessAdminTokenRefreshService");
const { sessionManager } = require("./middleware/sessionManager");

const app = express();

// ✅ FIXED: Trust proxy for correct protocol/host detection in production (Railway, nginx, etc.)
// This ensures req.protocol and req.headers.host are correct when behind a reverse proxy
app.set('trust proxy', true);

// Enable CORS: allow production frontend + localhost (so GB OAuth and API work from both)
// If FRONTEND_URL is unset (e.g. on Railway), origin would be undefined and CORS could block production.
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://www.clinimediaportal.ca',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
].filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. same-origin, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow any subdomain of clinimediaportal.ca (e.g. www, app)
    if (origin.endsWith('.clinimediaportal.ca') || origin === 'https://clinimediaportal.ca') return callback(null, true);
    callback(null, false); // disallow but don't 500
  },
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
app.use('/uploads/gallery', express.static(__dirname + '/uploads/gallery'));

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
  
  // Start Meta leads email monitoring (checks every 3 minutes by default)
  const leadsCheckInterval = parseInt(process.env.META_LEADS_CHECK_INTERVAL, 10) || 3;
  metaLeadsEmailService.startMonitoring(leadsCheckInterval);
  
  // Start QuickBooks token refresh service (runs every 30 seconds - FULLY AUTOMATIC)
  // This ensures tokens are always fresh without any manual intervention
  // Tokens are refreshed proactively 30 minutes before expiry (very proactive)
  // Service runs very frequently (30 seconds) to catch tokens immediately when they need refresh
  console.log('[Server] Starting QuickBooks token refresh service...');
  try {
    QuickBooksTokenRefreshService.start();
    console.log('[Server] ✅ QuickBooks token refresh service started successfully');
  } catch (error) {
    console.error('[Server] ❌ Failed to start QuickBooks token refresh service:', error);
    console.error('[Server] ❌ Token refresh will NOT work until this is fixed!');
  }
  
  // Start Google Ads token refresh service (runs every 30 seconds - FULLY AUTOMATIC)
  // This ensures admin Google Ads tokens are always fresh without any manual intervention
  console.log('[Server] Starting Google Ads token refresh service...');
  try {
    GoogleAdsTokenRefreshService.start();
    console.log('[Server] ✅ Google Ads token refresh service started successfully');
  } catch (error) {
    console.error('[Server] ❌ Failed to start Google Ads token refresh service:', error);
    console.error('[Server] ❌ Google Ads token refresh will NOT work until this is fixed!');
  }
  
  // Start Google Business Profile admin token refresh service (runs every 30 seconds - FULLY AUTOMATIC)
  // This ensures admin Google Business Profile tokens are always fresh without any manual intervention
  console.log('[Server] Starting Google Business Profile admin token refresh service...');
  try {
    GoogleBusinessAdminTokenRefreshService.start();
    console.log('[Server] ✅ Google Business Profile admin token refresh service started successfully');
  } catch (error) {
    console.error('[Server] ❌ Failed to start Google Business Profile admin token refresh service:', error);
    console.error('[Server] ❌ Google Business Profile admin token refresh will NOT work until this is fixed!');
  }
});