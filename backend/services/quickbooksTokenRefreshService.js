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

/**
 * Helper: Determine if an OAuth error is permanent (requires re-authentication)
 * Permanent errors include: invalid_grant, invalid_client, unauthorized_client
 * Temporary errors include: network issues, rate limits, MongoDB connection issues, etc.
 */
function isPermanentOAuthError(error) {
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorCode = error?.response?.data?.error || error?.error || '';
  const errorString = errorCode.toString().toLowerCase();
  const errorName = error?.name || '';
  
  // Permanent OAuth errors that require user to reconnect
  const permanentErrors = [
    'invalid_grant',
    'invalid_client',
    'unauthorized_client',
    'invalid_refresh_token',
    'refresh_token_expired',
    'access_denied'
  ];
  
  // MongoDB connection errors are temporary - don't disconnect
  if (errorName.includes('MongoServerSelectionError') || errorName.includes('MongoNetworkError')) {
    return false;
  }
  
  return permanentErrors.some(permError => 
    errorMessage.includes(permError) || 
    errorString.includes(permError)
  );
}

/**
 * Helper: Centralized function to save tokens for a user
 * Ensures consistent token saving logic across all refresh paths
 */
async function saveTokensForUser(user, refreshed) {
  // Validate expiresIn is a number (should be in seconds)
  const expiresInSeconds = parseInt(refreshed.expiresIn, 10);
  if (isNaN(expiresInSeconds) || expiresInSeconds <= 0) {
    console.warn('[QuickBooksTokenRefresh] Invalid expiresIn from refresh, using default 3600 seconds');
    refreshed.expiresIn = 3600;
  }
  
  // Calculate new expiry time (QuickBooks access tokens expire in 1 hour = 3600 seconds)
  const tokenExpiry = new Date(Date.now() + expiresInSeconds * 1000);
  
  // CRITICAL: QuickBooks refresh tokens rotate every ~24 hours
  // According to Intuit docs: "Always store the latest refresh_token value from the most recent API server response"
  // "When you get a new refresh token, the previous refresh token value automatically expires"
  user.quickbooksAccessToken = refreshed.accessToken;
  
  // ALWAYS overwrite refresh_token - QuickBooks rotates these and old ones become invalid
  if (refreshed.refreshToken) {
    console.log(`[QuickBooksTokenRefresh] 🔄 CRITICAL: Saving new refresh_token for user ${user.email || user.name || user._id} (old one is now invalid)`);
    user.quickbooksRefreshToken = refreshed.refreshToken; // MUST overwrite - old token is invalid
  } else {
    // QuickBooks should always return refresh_token, but if not, log warning
    console.warn(`[QuickBooksTokenRefresh] ⚠️ WARNING: QuickBooks did not return new refresh_token for user ${user.email || user.name || user._id}`);
    console.warn(`[QuickBooksTokenRefresh] ⚠️ This may cause issues if token rotated. Keeping existing refresh_token.`);
  }
  
  // Update expiry timestamp: now + expires_in * 1000 (expires_in is in seconds)
  user.quickbooksTokenExpiry = tokenExpiry;
  
  // Store refresh token expiry if provided (x_refresh_token_expires_in in seconds)
  if (refreshed.refreshTokenExpiresIn) {
    const refreshTokenExpiry = new Date(Date.now() + refreshed.refreshTokenExpiresIn * 1000);
    user.quickbooksRefreshTokenExpiry = refreshTokenExpiry;
  }
  
  await user.save();
  
  const minutesUntilExpiry = Math.floor(expiresInSeconds / 60);
  console.log(`[QuickBooksTokenRefresh] ✅ Token refreshed for user: ${user.email || user.name || user._id}`);
  console.log(`[QuickBooksTokenRefresh]    New token expires in ${minutesUntilExpiry} minutes (${tokenExpiry.toISOString()})`);
}

class QuickBooksTokenRefreshService {
  /**
   * Check and refresh QuickBooks tokens for all connected users
   * This runs as a background job to ensure tokens are always fresh
   */
  static async refreshAllTokens() {
    try {
      console.log('[QuickBooksTokenRefresh] Starting token refresh check...');
      
      // Find all users with QuickBooks connected
      // Wrap in try-catch to handle MongoDB connection errors gracefully
      let connectedUsers;
      try {
        connectedUsers = await User.find({ 
          quickbooksConnected: true,
          quickbooksRefreshToken: { $exists: true, $ne: null }
        });
      } catch (dbError) {
        // MongoDB connection errors are temporary - don't crash the service
        if (dbError.name?.includes('MongoServerSelectionError') || dbError.name?.includes('MongoNetworkError')) {
          console.warn('[QuickBooksTokenRefresh] ⚠️ MongoDB connection issue (temporary), will retry on next interval:', dbError.message);
          return;
        }
        throw dbError; // Re-throw if it's not a connection error
      }
      
      if (connectedUsers.length === 0) {
        console.log('[QuickBooksTokenRefresh] No QuickBooks connections found');
        return;
      }
      
      console.log(`[QuickBooksTokenRefresh] Found ${connectedUsers.length} QuickBooks connection(s) to check`);
      
      const now = new Date();
      const bufferTime = 10 * 60 * 1000; // 10 minutes buffer (refresh if expiring within 10 min)
      
      let refreshedCount = 0;
      let errorCount = 0;
      
      for (const user of connectedUsers) {
        try {
          // Check if token needs refresh
          const expiryTime = user.quickbooksTokenExpiry ? new Date(user.quickbooksTokenExpiry) : null;
          const timeUntilExpiryMs = expiryTime ? expiryTime.getTime() - now.getTime() : 0;
          const shouldRefresh = !expiryTime || timeUntilExpiryMs <= 0 || timeUntilExpiryMs <= bufferTime;
          
          // Declare minutesUntilExpiry at top of scope to avoid TDZ issues
          let minutesUntilExpiry = null;
          if (expiryTime) {
            minutesUntilExpiry = Math.floor(timeUntilExpiryMs / 60000);
          }
          
          if (shouldRefresh) {
            console.log(`[QuickBooksTokenRefresh] 🔄 Refreshing token for user: ${user.email || user.name || user._id}`);
            console.log(`[QuickBooksTokenRefresh]    Current time: ${now.toISOString()}`);
            console.log(`[QuickBooksTokenRefresh]    Expiry time: ${expiryTime ? expiryTime.toISOString() : 'Not set'}`);
            console.log(`[QuickBooksTokenRefresh]    Time until expiry: ${minutesUntilExpiry !== null ? minutesUntilExpiry : 'N/A'} minutes`);
            console.log(`[QuickBooksTokenRefresh]    Buffer time: ${Math.floor(bufferTime / 60000)} minutes`);
            console.log(`[QuickBooksTokenRefresh]    Reason: ${!expiryTime ? 'No expiry set' : timeUntilExpiryMs <= 0 ? 'Token expired' : 'Expiring within buffer'}`);
            
            const refreshed = await QuickBooksService.refreshAccessToken(user.quickbooksRefreshToken);
            
            // Save tokens using centralized helper
            await saveTokensForUser(user, refreshed);
            
            refreshedCount++;
          } else {
            console.log(`[QuickBooksTokenRefresh] ✓ Token still valid for user ${user.email || user.name || user._id} (expires in ${minutesUntilExpiry !== null ? minutesUntilExpiry : 'N/A'} minutes)`);
          }
        } catch (error) {
          console.error(`[QuickBooksTokenRefresh] ❌ Failed to refresh token for user ${user.email || user.name || user._id}:`, error.message);
          
          // Only mark as disconnected if it's a permanent OAuth error
          if (isPermanentOAuthError(error)) {
            console.log(`[QuickBooksTokenRefresh] ⚠️ Permanent OAuth error detected - marking user as disconnected`);
            user.quickbooksConnected = false;
            await user.save().catch(err => {
              console.error(`[QuickBooksTokenRefresh] Failed to update connection status for user ${user._id}:`, err);
            });
          } else {
            console.warn(`[QuickBooksTokenRefresh] ⚠️ Temporary error (will retry on next interval):`, error.message);
          }
          
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
   * Runs every 30 minutes to check and refresh tokens that are expiring soon
   * This ensures tokens are always fresh and never expire during use
   * NO MANUAL INTERVENTION NEEDED - fully automatic
   */
  static start() {
    console.log('[QuickBooksTokenRefresh] 🚀 Starting QuickBooks token refresh service...');
    console.log('[QuickBooksTokenRefresh] ✅ FULLY AUTOMATIC - No manual refresh needed');
    console.log('[QuickBooksTokenRefresh] Service will run every 30 minutes');
    console.log('[QuickBooksTokenRefresh] Tokens will be refreshed if expiring within 10 minutes');
    
    // Run immediately on startup to refresh any tokens that need it
    this.refreshAllTokens();
    
    // Then run every 30 minutes to check and refresh tokens
    setInterval(() => {
      this.refreshAllTokens();
    }, 30 * 60 * 1000); // 30 minutes
    
    console.log('[QuickBooksTokenRefresh] ✅ Service started successfully - tokens will refresh automatically');
  }
}

module.exports = QuickBooksTokenRefreshService;

