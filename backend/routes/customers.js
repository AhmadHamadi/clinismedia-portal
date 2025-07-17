// routes/customers.js

const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const User = require("../models/User");
const validator = require("validator"); // npm install validator
const authenticateToken = require("../middleware/authenticateToken");
const authorizeRole = require("../middleware/authorizeRole");
const jwt = require("jsonwebtoken");
const GalleryItem = require('../models/GalleryItem');
const Invoice = require('../models/Invoice');

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

// GET all customers (admin only)
router.get("/", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const customers = await User.find({ role: "customer" }).select("name username email location _id facebookPageId facebookPageName facebookAccessToken facebookTokenExpiry");
    res.status(200).json(customers);
  } catch (err) {
    console.error("❌ Failed to fetch customers:", err.message);
    res.status(500).json({ error: "Server error fetching customers" });
  }
});

// POST create a new customer
router.post("/", async (req, res) => {
  try {
    const { name, username, email, password, location } = req.body;

    if (!name || !username || !email || !password || !location) {
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
      location,
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
    const { name, username, email, password, location } = req.body;
    const updateData = { name, username, email, location };
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

// GET visible gallery and invoice items for a customer
router.get('/:id/portal-visibility', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('visibleGalleryItems')
      .populate('visibleInvoices');
    if (!user) return res.status(404).json({ error: 'Customer not found' });

    // Get all global gallery items and invoices
    const allGalleryItems = await GalleryItem.find();
    const allInvoices = await Invoice.find();

    res.json({
      visibleGalleryItems: user.visibleGalleryItems,
      visibleInvoices: user.visibleInvoices,
      allGalleryItems,
      allInvoices,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE visible gallery and invoice items for a customer
router.put('/:id/portal-visibility', async (req, res) => {
  try {
    const { visibleGalleryItems, visibleInvoices } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        visibleGalleryItems,
        visibleInvoices,
      },
      { new: true }
    )
      .populate('visibleGalleryItems')
      .populate('visibleInvoices');
    if (!user) return res.status(404).json({ error: 'Customer not found' });
    res.json({
      message: 'Portal visibility updated',
      visibleGalleryItems: user.visibleGalleryItems,
      visibleInvoices: user.visibleInvoices,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Disconnect Facebook page from a customer (admin only)
router.patch('/:id/facebook-disconnect', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        facebookPageId: null,
        facebookPageName: null,
        facebookAccessToken: null,
        facebookTokenExpiry: null,
      },
      { new: true }
    );
    
    if (!user) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Facebook Page disconnected successfully!', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to disconnect Facebook Page' });
  }
});

module.exports = router;
