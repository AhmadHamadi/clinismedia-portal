const jwt = require("jsonwebtoken");
const { sessionManager } = require("./sessionManager");

// Middleware to verify JWT token and validate session
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
    
    // Map id to _id for MongoDB compatibility
    if (user.id) {
      user._id = user.id;
    }
    
    // Validate session exists in session manager
    const isValidSession = sessionManager.isValidSession(
      user._id || user.id, 
      token, 
      user.role
    );

    if (!isValidSession) {
      return res.status(403).json({ error: "Session expired or invalid" });
    }
    
    req.user = user;
    next();
  });
};

module.exports = authenticateToken; 