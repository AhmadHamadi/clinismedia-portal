const jwt = require("jsonwebtoken");

// In-memory store for active sessions (in production, use Redis)
const activeSessions = new Map();

const sessionManager = {
  // Add a new session
  addSession: (userId, token, role) => {
    const sessionKey = `${userId}-${role}`;
    const now = new Date();
    
    activeSessions.set(sessionKey, {
      token,
      role,
      createdAt: now,
      lastActivity: now,
      loginDate: now.toDateString() // Track the date of login
    });
  },

  // Remove a session
  removeSession: (userId, role) => {
    const sessionKey = `${userId}-${role}`;
    activeSessions.delete(sessionKey);
  },

  // Check if session exists and is valid
  isValidSession: (userId, token, role) => {
    const sessionKey = `${userId}-${role}`;
    const session = activeSessions.get(sessionKey);
    
    if (!session || session.token !== token) {
      return false;
    }

    // Check if it's a new day (after 9 AM)
    const now = new Date();
    const today = now.toDateString();
    const currentHour = now.getHours();
    
    // If it's after 9 AM and the login was from a previous day, session is invalid
    if (currentHour >= 9 && session.loginDate !== today) {
      activeSessions.delete(sessionKey);
      return false;
    }

    // Update last activity
    session.lastActivity = now;
    activeSessions.set(sessionKey, session);
    
    return true;
  },

  // Get all active sessions for a user
  getUserSessions: (userId) => {
    const sessions = [];
    for (const [key, session] of activeSessions.entries()) {
      if (key.startsWith(`${userId}-`)) {
        sessions.push({
          role: session.role,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          loginDate: session.loginDate
        });
      }
    }
    return sessions;
  },

  // Clean up old sessions and daily reset (run periodically)
  cleanupOldSessions: () => {
    const now = new Date();
    const today = now.toDateString();
    const currentHour = now.getHours();
    
    for (const [key, session] of activeSessions.entries()) {
      // Remove sessions from previous days after 9 AM
      if (currentHour >= 9 && session.loginDate !== today) {
        activeSessions.delete(key);
        continue;
      }
      
      // Also remove sessions older than 24 hours as backup
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (now - session.lastActivity > maxAge) {
        activeSessions.delete(key);
      }
    }
  },

  // Force daily reset at 9 AM
  forceDailyReset: () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Only run at exactly 9:00 AM
    if (currentHour === 9 && currentMinute === 0) {
      console.log("🔄 Performing daily session reset at 9 AM");
      activeSessions.clear();
    }
  }
};

module.exports = {
  sessionManager
}; 