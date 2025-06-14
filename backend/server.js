// backend/server.js
const express = require("express");
const cors = require("cors");           // Add CORS
const connectDB = require("./config/db");
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
const taskRoutes = require("./routes/tasks");
const bookingRoutes = require("./routes/bookings");
const blockedDateRoutes = require("./routes/blockedDates");

app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/blocked-dates", blockedDateRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("CliniMedia Portal API is running.");
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});