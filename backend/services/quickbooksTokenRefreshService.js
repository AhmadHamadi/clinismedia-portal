/**
 * QuickBooks Token Refresh Service
 * 
 * Background service that proactively refreshes QuickBooks access tokens
 * before they expire. This ensures tokens are always valid without manual intervention.
 * 
 * Runs every 30 minutes to check and refresh tokens that are expiring soon.
 */

const User = require('../models/User');
const QuickBooksService = require('./quickbooksService');

class QuickBooksTokenRefreshService {
  /**
   * Check and refresh QuickBooks tokens for all connected users
   * This runs as a background job to ensure tokens are always fresh
   */
  static async refreshAllTokens() {
    try {
      console.log('[QuickBooksTokenRefresh] Starting token refresh check...');
      
      // Find all users with QuickBooks connected
      const connectedUsers = await User.find({ 
        quickbooksConnected: true,
        quickbooksRefreshToken: { $exists: true, $ne: null }
      });
      
      if (connectedUsers.length === 0) {
        console.log('[QuickBooksTokenRefresh] No QuickBooks connections found');
        return;
      }
      
      console.log(`[QuickBooksTokenRefresh] Found ${connectedUsers.length} QuickBooks connection(s) to check`);
      
      const now = new Date();
      const bufferTime = 20 * 60 * 1000; // 20 minutes buffer (refresh if expiring within 20 min)
      
      let refreshedCount = 0;
      let errorCount = 0;
      
      for (const user of connectedUsers) {
        try {
          // Check if token needs refresh
          const expiryTime = user.quickbooksTokenExpiry ? new Date(user.quickbooksTokenExpiry) : null;
          const shouldRefresh = !expiryTime || (expiryTime && (now.getTime() + bufferTime) >= expiryTime.getTime());
          
          if (shouldRefresh) {
            console.log(`[QuickBooksTokenRefresh] 🔄 Refreshing token for user: ${user.email || user.name || user._id}`);
            
            const refreshed = await QuickBooksService.refreshAccessToken(user.quickbooksRefreshToken);
            
            // Validate expiresIn is a number (should be in seconds, typically 3600 for access tokens)
            const expiresInSeconds = parseInt(refreshed.expiresIn, 10);
            if (isNaN(expiresInSeconds) || expiresInSeconds <= 0) {
              console.warn(`[QuickBooksTokenRefresh] Invalid expiresIn value: ${refreshed.expiresIn}, using default 3600 seconds`);
              refreshed.expiresIn = 3600;
            }
            
            // Calculate new expiry time (QuickBooks access tokens expire in 1 hour = 3600 seconds)
            const tokenExpiry = new Date();
            tokenExpiry.setSeconds(tokenExpiry.getSeconds() + expiresInSeconds);
            
            user.quickbooksAccessToken = refreshed.accessToken;
            user.quickbooksRefreshToken = refreshed.refreshToken || user.quickbooksRefreshToken;
            user.quickbooksTokenExpiry = tokenExpiry;
            await user.save();
            
            const minutesUntilExpiry = Math.floor(expiresInSeconds / 60);
            console.log(`[QuickBooksTokenRefresh] ✅ Token refreshed for user: ${user.email || user.name || user._id}`);
            console.log(`[QuickBooksTokenRefresh]    New token expires in ${minutesUntilExpiry} minutes (${tokenExpiry.toISOString()})`);
            refreshedCount++;
          } else {
            const timeUntilExpiry = expiryTime.getTime() - now.getTime();
            const minutesUntilExpiry = Math.floor(timeUntilExpiry / 60000);
            console.log(`[QuickBooksTokenRefresh] ✓ Token still valid for user ${user.email || user.name || user._id} (expires in ${minutesUntilExpiry} minutes)`);
          }
        } catch (error) {
          console.error(`[QuickBooksTokenRefresh] ❌ Failed to refresh token for user ${user.email || user.name || user._id}:`, error.message);
          
          // Mark as disconnected if refresh fails (token might be invalid)
          user.quickbooksConnected = false;
          await user.save().catch(err => {
            console.error(`[QuickBooksTokenRefresh] Failed to update connection status for user ${user._id}:`, err);
          });
          
          errorCount++;
        }
      }
      
      console.log(`[QuickBooksTokenRefresh] ✅ Refresh complete. Refreshed: ${refreshedCount}, Errors: ${errorCount}, Total: ${connectedUsers.length}`);
    } catch (error) {
      console.error('[QuickBooksTokenRefresh] ❌ Error in token refresh service:', error);
    }
  }
  
  /**
   * Start the background token refresh service
   * Runs every 15 minutes to proactively refresh tokens before they expire
   * This ensures tokens are always fresh and never expire during use
   */
  static start() {
    console.log('[QuickBooksTokenRefresh] 🚀 Starting QuickBooks token refresh service...');
    console.log('[QuickBooksTokenRefresh] Service will run every 15 minutes');
    console.log('[QuickBooksTokenRefresh] Tokens will be refreshed if expiring within 20 minutes');
    
    // Run immediately on startup to refresh any tokens that need it
    this.refreshAllTokens();
    
    // Then run every 15 minutes to proactively refresh tokens
    setInterval(() => {
      this.refreshAllTokens();
    }, 15 * 60 * 1000); // 15 minutes (more frequent to catch tokens before expiry)
    
    console.log('[QuickBooksTokenRefresh] ✅ Service started successfully');
  }
}

module.exports = QuickBooksTokenRefreshService;

