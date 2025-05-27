const express = require("express");
const connectDB = require("./config/db");
require("dotenv").config();

const app = express();
connectDB();

app.use(express.json());

const authRoutes = require("./routes/auth");
console.log("✅ auth routes mounted on /api/auth"); // Debug log added
app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("CliniMedia Portal API is running.");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
