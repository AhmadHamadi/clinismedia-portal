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
      const bufferTime = 5 * 60 * 1000; // 5 minutes buffer (refresh if expiring within 5 min)
      
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
            
            // CRITICAL: QuickBooks refresh tokens rotate every ~24 hours
            // According to Intuit docs: "Always store the latest refresh_token value from the most recent API server response"
            // "When you get a new refresh token, the previous refresh token value automatically expires"
            user.quickbooksAccessToken = refreshed.accessToken;
            
            // ALWAYS overwrite refresh_token - QuickBooks rotates these and old ones become invalid
            if (refreshed.refreshToken) {
              console.log(`[QuickBooksTokenRefresh] 🔄 CRITICAL: Saving new refresh_token for user ${user.email || user.name || user._id} (old one is now invalid)`);
              user.quickbooksRefreshToken = refreshed.refreshToken; // MUST overwrite - old token is invalid
            } else {
              console.warn(`[QuickBooksTokenRefresh] ⚠️ WARNING: QuickBooks did not return new refresh_token for user ${user.email || user.name || user._id}`);
              console.warn(`[QuickBooksTokenRefresh] ⚠️ This may cause issues if token rotated. Keeping existing refresh_token.`);
            }
            
            // Update expiry timestamp: now + expires_in * 1000 (expires_in is in seconds)
            user.quickbooksTokenExpiry = tokenExpiry;
            
            // Store refresh token expiry if provided
            if (refreshed.refreshTokenExpiresIn) {
              const refreshTokenExpiry = new Date();
              refreshTokenExpiry.setSeconds(refreshTokenExpiry.getSeconds() + refreshed.refreshTokenExpiresIn);
              user.quickbooksRefreshTokenExpiry = refreshTokenExpiry;
            }
            
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
   * Runs every 10 minutes to proactively refresh tokens before they expire
   * This ensures tokens are always fresh and never expire during use
   * NO MANUAL INTERVENTION NEEDED - fully automatic
   */
  static start() {
    console.log('[QuickBooksTokenRefresh] 🚀 Starting QuickBooks token refresh service...');
    console.log('[QuickBooksTokenRefresh] ✅ FULLY AUTOMATIC - No manual refresh needed');
    console.log('[QuickBooksTokenRefresh] Service will run every 10 minutes');
    console.log('[QuickBooksTokenRefresh] Tokens will be refreshed if expiring within 5 minutes');
    
    // Run immediately on startup to refresh any tokens that need it
    this.refreshAllTokens();
    
    // Then run every 10 minutes to proactively refresh tokens
    // This is more frequent to ensure tokens never expire
    setInterval(() => {
      this.refreshAllTokens();
    }, 10 * 60 * 1000); // 10 minutes (aggressive refresh to prevent any expiry)
    
    console.log('[QuickBooksTokenRefresh] ✅ Service started successfully - tokens will refresh automatically');
  }
}

module.exports = QuickBooksTokenRefreshService;

