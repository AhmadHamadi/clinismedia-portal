const express = require("express");
const cors = require("cors");           // Add CORS
const connectDB = require("./config/db");
require("dotenv").config();

const app = express();

// Enable CORS for your frontend origin (adjust port if needed)
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));

connectDB();

app.use(express.json());

// Import routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");

// Mount routes
app.use("/api/auth", authRoutes);
console.log("✅ auth routes mounted on /api/auth");

app.use("/api/users", userRoutes);
console.log("✅ user routes mounted on /api/users");

// Root route
app.get("/", (req, res) => {
  res.send("CliniMedia Portal API is running.");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
