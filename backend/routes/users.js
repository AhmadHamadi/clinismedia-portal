const express = require("express");
const router = express.Router();
const User = require("../models/User");

// GET users, optionally filter by role
router.get("/", async (req, res) => {
  try {
    const { role } = req.query;
    let query = {};

    if (role) {
      query.role = role;  // filter users by role if query param provided
    }

    const users = await User.find(query).select("-password"); // exclude password for security
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE user by ID
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    // Attempt to delete user by ID
    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

module.exports = router;
