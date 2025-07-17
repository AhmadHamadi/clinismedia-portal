const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const User = require("../models/User");
const validator = require("validator");
const authenticateToken = require("../middleware/authenticateToken");
const authorizeRole = require("../middleware/authorizeRole");

// GET all employees (Admin only)
router.get("/", authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const employees = await User.find({ role: "employee" }).select("name username email department _id");
    res.status(200).json(employees);
  } catch (err) {
    console.error("❌ Failed to fetch employees:", err.message);
    res.status(500).json({ error: "Server error fetching employees" });
  }
});

// POST create a new employee
router.post("/", authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { name, username, email, password, department } = req.body;

    if (!name || !username || !email || !password || !department) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    // Validate department
    const validDepartments = ["photography", "web", "social"];
    if (!validDepartments.includes(department)) {
      return res.status(400).json({ error: "Invalid department" });
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

    const newEmployee = new User({
      name,
      username,
      email,
      password: hashedPassword,
      role: "employee",
      department,
    });

    await newEmployee.save();
    res.status(201).json({ message: "Employee added successfully" });
  } catch (err) {
    console.error("❌ Error adding employee:", err.message);
    res.status(500).json({ error: "Server error adding employee" });
  }
});

// DELETE an employee by ID
router.delete("/:id", authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Employee not found" });
    }
    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (err) {
    console.error("❌ Failed to delete employee:", err.message);
    res.status(500).json({ error: "Server error deleting employee" });
  }
});

// UPDATE an employee by ID
router.put("/:id", authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { name, username, email, password, department } = req.body;
    const updateData = { name, username, email };
    
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    
    if (department) {
      // Validate department
      const validDepartments = ["photography", "web", "social"];
      if (!validDepartments.includes(department)) {
        return res.status(400).json({ error: "Invalid department" });
      }
      updateData.department = department;
    }
    
    const updated = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updated) {
      return res.status(404).json({ error: "Employee not found" });
    }
    res.status(200).json({ message: "Employee updated successfully" });
  } catch (err) {
    console.error("❌ Failed to update employee:", err.message);
    res.status(500).json({ error: "Server error updating employee" });
  }
});

// GET authenticated employee's profile
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const employee = await User.findById(req.user.id).select("-password");
    if (!employee || employee.role !== "employee") {
      return res.status(404).json({ error: "Employee not found or unauthorized" });
    }
    res.status(200).json(employee);
  } catch (err) {
    console.error("❌ Failed to fetch employee profile:", err.message);
    res.status(500).json({ error: "Server error fetching employee profile" });
  }
});

module.exports = router; 