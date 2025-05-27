// backend/routes/auth.js
console.log("✅ auth.js route file loaded");

const express = require("express");
const router = express.Router();
const { register, login } = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);

module.exports = router;
