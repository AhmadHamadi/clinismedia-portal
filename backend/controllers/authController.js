// backend/controllers/authController.js

const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sessionManager } = require("../middleware/sessionManager");

exports.register = async (req, res) => {
  try {
    const { name, username, email, password, role, department } = req.body;

    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }] 
    });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      username,
      email,
      password: hashedPassword,
      role,
      department: role === "employee" ? department : undefined,
    });

    await user.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    // Check concurrent sessions limit
    const userSessions = sessionManager.getUserSessions(user._id.toString());
    const maxSessions = 3; // Allow max 3 concurrent sessions
    
    if (userSessions.length >= maxSessions) {
      return res.status(409).json({ 
        message: `Maximum ${maxSessions} concurrent sessions allowed. Please log out from another device first.` 
      });
    }

    const jwtPayload = { id: user._id, role: user.role, name: user.name };
    if (user.role === "receptionist") {
      jwtPayload.parentCustomerId = user.parentCustomerId?.toString?.() || user.parentCustomerId;
      jwtPayload.canBookMediaDay = user.canBookMediaDay === true;
    }

    const token = jwt.sign(
      jwtPayload,
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Add session to session manager
    sessionManager.addSession(user._id.toString(), token, user.role);

    const userForResponse = {
      id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      department: user.department || null,
    };
    if (user.role === "receptionist") {
      userForResponse.parentCustomerId = user.parentCustomerId?.toString?.() || user.parentCustomerId;
      userForResponse.canBookMediaDay = user.canBookMediaDay === true;
    }

    res.json({
      token,
      user: userForResponse,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.logout = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token && req.user) {
      // Remove session from session manager
      sessionManager.removeSession(req.user._id || req.user.id, req.user.role);
    }

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCustomers = async (req, res) => {
  try {
    const customers = await User.find({ role: "customer" }).select("name email");
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
