// backend/routes/auth.js
const express = require("express");
const router = express.Router();
const { register, login, logout } = require("../controllers/authController");
const authenticateToken = require("../middleware/authenticateToken");

router.post("/register", register);
router.post("/login", login);
router.post("/logout", authenticateToken, logout);

// Token validation endpoint
router.get("/validate", authenticateToken, (req, res) => {
  const user = {
    id: req.user._id || req.user.id,
    role: req.user.role,
    name: req.user.name
  };
  if (req.user.role === 'receptionist') {
    user.parentCustomerId = req.user.parentCustomerId;
    user.canBookMediaDay = req.user.canBookMediaDay === true;
  }
  res.status(200).json({ valid: true, user });
});

module.exports = router;
