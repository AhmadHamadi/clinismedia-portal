const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Get all customers
router.get("/", async (req, res) => {
  try {
    const customers = await User.find({ role: "customer" });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

// Add a new customer
router.post("/", async (req, res) => {
  try {
    const { name, logoUrl } = req.body;

    const newCustomer = new User({
      name,
      username: `${name.replace(/\s+/g, "").toLowerCase()}_${Date.now()}`,
      email: `${Date.now()}@customer.com`,
      password: "placeholder", // hashed version not required yet
      role: "customer",
      customerSettings: {
        displayName: name,
        logoUrl,
      },
    });

    await newCustomer.save();
    res.status(201).json(newCustomer);
  } catch (err) {
    res.status(500).json({ error: "Failed to add customer" });
  }
});

module.exports = router;
