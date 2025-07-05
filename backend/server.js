// backend/server.js
const express = require("express");
const cors = require("cors");           // Add CORS
const connectDB = require("./config/db");
const ScheduledEmailService = require("./services/scheduledEmailService");
require("dotenv").config();

const app = express();

// Enable CORS for your frontend origin (adjust port if needed)
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
}));

connectDB();

app.use(express.json());

// Import routes
const authRoutes = require("./routes/auth");
const customerRoutes = require("./routes/customers");
const employeeRoutes = require("./routes/employees");
const notificationRoutes = require("./routes/notifications");
const bookingRoutes = require("./routes/bookings");
const blockedDateRoutes = require("./routes/blockedDates");
const onboardingTasksRoutes = require("./routes/onboardingTasks");
const facebookRoutes = require('./routes/facebook');

app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/blocked-dates", blockedDateRoutes);
app.use("/api/onboarding-tasks", onboardingTasksRoutes);
app.use('/api/facebook', facebookRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("CliniMedia Portal API is running.");
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  
  // Set up daily reminder emails (runs every day at 9 AM)
  setInterval(async () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Run at 9:00 AM daily
    if (hours === 9 && minutes === 0) {
      await ScheduledEmailService.sendDailyReminders();
    }
  }, 60000); // Check every minute
  
  // Also run once on server start for testing
  ScheduledEmailService.sendDailyReminders();
});