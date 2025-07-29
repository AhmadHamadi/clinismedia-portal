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
  res.status(200).json({ 
    valid: true, 
    user: {
      id: req.user._id,
      role: req.user.role,
      name: req.user.name
    }
  });
});

module.exports = router;
