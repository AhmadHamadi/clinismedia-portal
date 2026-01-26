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
const multer = require('multer');
const path = require('path');

// Set up multer storage for customer logos
const fs = require('fs');
const uploadsDir = path.join(__dirname, '../uploads/customer-logos/');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created uploads/customer-logos directory');
}

const logoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});
const uploadLogo = multer({ 
  storage: logoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

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
    // Check if we should include admins (for Google Business Profile management)
    const includeAdmins = req.query.includeAdmins === 'true';
    
    let query = { role: "customer" };
    if (includeAdmins) {
      query = { role: { $in: ["customer", "admin"] } };
    }
    
    const customers = await User.find(query).select("name username email location address _id role facebookPageId facebookPageName facebookAccessToken facebookTokenExpiry facebookUserAccessToken facebookUserTokenExpiry bookingIntervalMonths googleAdsAccessToken googleAdsRefreshToken googleAdsTokenExpiry googleAdsCustomerId googleBusinessProfileId googleBusinessProfileName googleBusinessAccessToken googleBusinessRefreshToken googleBusinessTokenExpiry twilioPhoneNumber twilioForwardNumber twilioForwardNumberNew twilioForwardNumberExisting twilioMenuMessage");
    res.status(200).json(customers);
  } catch (err) {
    console.error("❌ Failed to fetch customers:", err.message);
    res.status(500).json({ error: "Server error fetching customers" });
  }
});

// POST create a new customer
router.post('/', uploadLogo.single('logo'), async (req, res) => {
  try {
    const { name, username, email, password, location, address, bookingIntervalMonths } = req.body;
    const logoUrl = req.file ? `/uploads/customer-logos/${req.file.filename}` : '';

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

    const user = new User({
      name,
      username,
      email,
      password: await bcrypt.hash(password, 10),
      location,
      address,
      bookingIntervalMonths,
      customerSettings: { logoUrl },
    });
    await user.save();
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE a customer by ID
router.delete("/:id", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const customerId = req.params.id;
    const customer = await User.findByIdAndDelete(customerId);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    
    // ✅ FIXED: Clean up all related data when deleting a customer
    try {
      // Delete all assigned gallery items for this customer
      const AssignedGalleryItem = require('../models/AssignedGalleryItem');
      const deletedAssignments = await AssignedGalleryItem.deleteMany({ clinicId: customerId });
      console.log(`✅ Deleted ${deletedAssignments.deletedCount} assigned gallery items for customer ${customerId}`);
      
      // Delete customer notifications
      const CustomerNotification = require('../models/CustomerNotification');
      await CustomerNotification.deleteMany({ customerId });
      console.log(`✅ Deleted customer notifications for customer ${customerId}`);
      
      // Delete client notes
      const ClientNote = require('../models/ClientNote');
      await ClientNote.deleteMany({ customerId });
      console.log(`✅ Deleted client notes for customer ${customerId}`);
      
      // Delete bookings
      const Booking = require('../models/Booking');
      await Booking.deleteMany({ customerId });
      console.log(`✅ Deleted bookings for customer ${customerId}`);
      
      // Delete blocked dates
      const BlockedDate = require('../models/BlockedDate');
      await BlockedDate.deleteMany({ customerId });
      console.log(`✅ Deleted blocked dates for customer ${customerId}`);
      
      // Delete onboarding tasks
      const AssignedOnboardingTask = require('../models/AssignedOnboardingTask');
      await AssignedOnboardingTask.deleteMany({ customerId });
      console.log(`✅ Deleted onboarding tasks for customer ${customerId}`);
      
      // Delete invoices
      const Invoice = require('../models/Invoice');
      await Invoice.deleteMany({ customerId });
      console.log(`✅ Deleted invoices for customer ${customerId}`);
      
      // Delete assigned invoices
      const AssignedInvoice = require('../models/AssignedInvoice');
      await AssignedInvoice.deleteMany({ customerId });
      console.log(`✅ Deleted assigned invoices for customer ${customerId}`);
      
      // Delete email notification settings
      const EmailNotificationSettings = require('../models/EmailNotificationSettings');
      await EmailNotificationSettings.deleteMany({ customerId });
      console.log(`✅ Deleted email notification settings for customer ${customerId}`);
      
    } catch (cleanupError) {
      console.error('⚠️ Error during customer cleanup (non-critical):', cleanupError);
      // Don't fail the deletion if cleanup fails - customer is already deleted
    }
    
    res.status(200).json({ message: "Customer deleted successfully" });
  } catch (err) {
    console.error("❌ Failed to delete customer:", err.message);
    res.status(500).json({ error: "Server error deleting customer" });
  }
});

// PUT update customer by ID (admin only)
router.put("/:id", authenticateToken, authorizeRole(['admin']), uploadLogo.single('logo'), async (req, res) => {
  try {
    const { name, username, email, location, address, bookingIntervalMonths } = req.body;
    const logoUrl = req.file ? `/uploads/customer-logos/${req.file.filename}` : undefined;

    const updateData = { name, username, email, location, address, bookingIntervalMonths };
    if (logoUrl) {
      updateData.customerSettings = { logoUrl };
    }

    const customer = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).select("-password");

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.status(200).json(customer);
  } catch (err) {
    console.error("❌ Failed to update customer:", err.message);
    res.status(500).json({ error: "Server error updating customer" });
  }
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: "File size too large. Maximum size is 5MB." });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    if (err.message === 'Only image files are allowed') {
      return res.status(400).json({ error: "Only image files are allowed." });
    }
    return res.status(400).json({ error: err.message });
  }
  next();
};

// PUT update customer profile (authenticated)
router.put("/profile", authenticateToken, uploadLogo.single('logo'), handleMulterError, async (req, res) => {
  try {
    const { name, email, location, address, bookingIntervalMonths } = req.body;
    
    // Check if file was uploaded
    if (!req.file) {
      // If no file, just update other fields
      const updateData = { name, email, location, address, bookingIntervalMonths };
      const customer = await User.findByIdAndUpdate(
        req.user.id,
        updateData,
        { new: true }
      ).select("-password");

      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      return res.status(200).json(customer);
    }

    const logoUrl = `/uploads/customer-logos/${req.file.filename}`;
    const updateData = { name, email, location, address, bookingIntervalMonths };
    
    // Preserve existing customerSettings if they exist, or create new
    const existingCustomer = await User.findById(req.user.id);
    if (existingCustomer && existingCustomer.customerSettings) {
      updateData.customerSettings = {
        ...existingCustomer.customerSettings,
        logoUrl: logoUrl
      };
    } else {
      updateData.customerSettings = { logoUrl };
    }

    const customer = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true }
    ).select("-password");

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    console.log('✅ Logo uploaded successfully:', logoUrl);
    res.status(200).json(customer);
  } catch (err) {
    console.error("❌ Failed to update customer profile:", err.message);
    console.error("❌ Error stack:", err.stack);
    
    // If multer error, provide more specific message
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: "File size too large. Maximum size is 5MB." });
    }
    if (err.message === 'Only image files are allowed') {
      return res.status(400).json({ error: "Only image files are allowed." });
    }
    
    res.status(500).json({ error: err.message || "Server error updating customer profile" });
  }
});

// GET customer portal visibility (authenticated)
router.get('/:id/portal-visibility', authenticateToken, async (req, res) => {
  try {
    const customer = await User.findById(req.params.id).select('portalVisibility');
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json({ portalVisibility: customer.portalVisibility || false });
  } catch (err) {
    console.error("❌ Failed to fetch portal visibility:", err.message);
    res.status(500).json({ error: "Server error fetching portal visibility" });
  }
});

// PUT update customer portal visibility (authenticated)
router.put('/:id/portal-visibility', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { portalVisibility } = req.body;
    const customer = await User.findByIdAndUpdate(
      req.params.id,
      { portalVisibility },
      { new: true }
    ).select('portalVisibility');
    
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    
    res.json({ portalVisibility: customer.portalVisibility });
  } catch (err) {
    console.error("❌ Failed to update portal visibility:", err.message);
    res.status(500).json({ error: "Server error updating portal visibility" });
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
