// backend/server.js
const express = require("express");
const cors = require("cors");           // Add CORS
const connectDB = require("./config/db");
const ScheduledEmailService = require("./services/scheduledEmailService");
const { sessionManager } = require("./middleware/sessionManager");
require("dotenv").config();

const app = express();

// Enable CORS for your frontend origin
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

connectDB();

app.use(express.json());

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
const emailNotificationSettingsRoutes = require('./routes/emailNotificationSettings');
const customerNotificationsRoutes = require('./routes/customerNotifications');

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
app.use('/api/email-notification-settings', emailNotificationSettingsRoutes);
app.use('/api/customer-notifications', customerNotificationsRoutes);
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
  ScheduledEmailService.sendDailyReminders();
  ScheduledEmailService.sendProactiveBookingReminders();
});