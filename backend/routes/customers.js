// routes/customers.js

const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const User = require("../models/User");
const validator = require("validator"); // npm install validator
const jwt = require("jsonwebtoken");

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

// GET customer profile (authenticated)
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const customer = await User.findById(req.user.id).select("-password");
    if (!customer || customer.role !== "customer") {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.status(200).json(customer);
  } catch (err) {
    console.error("❌ Failed to fetch customer profile:", err.message);
    res.status(500).json({ error: "Server error fetching customer profile" });
  }
});

// GET all customers
router.get("/", async (req, res) => {
  try {
    const customers = await User.find({ role: "customer" }).select("name username email _id");
    res.status(200).json(customers);
  } catch (err) {
    console.error("❌ Failed to fetch customers:", err.message);
    res.status(500).json({ error: "Server error fetching customers" });
  }
});

// POST create a new customer
router.post("/", async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ error: "Email already in use" });
      }
      if (existingUser.username === username) {
        return res.status(400).json({ error: "Username already in use" });
      }
      return res.status(400).json({ error: "User with this email or username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newCustomer = new User({
      name,
      username,
      email,
      password: hashedPassword,
      role: "customer",
    });

    await newCustomer.save();
    res.status(201).json({ message: "Customer added successfully" });
  } catch (err) {
    console.error("❌ Error adding customer:", err.message);
    res.status(500).json({ error: "Server error adding customer" });
  }
});

// DELETE a customer by ID
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.status(200).json({ message: "Customer deleted successfully" });
  } catch (err) {
    console.error("❌ Failed to delete customer:", err.message);
    res.status(500).json({ error: "Server error deleting customer" });
  }
});

// UPDATE a customer by ID
router.put("/:id", async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    const updateData = { name, username, email };
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    const updated = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updated) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.status(200).json({ message: "Customer updated successfully" });
  } catch (err) {
    console.error("❌ Failed to update customer:", err.message);
    res.status(500).json({ error: "Server error updating customer" });
  }
});

module.exports = router;
