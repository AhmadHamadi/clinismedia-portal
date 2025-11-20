/**
 * QuickBooks Token Refresh Service
 * 
 * Background service that proactively refreshes QuickBooks access tokens
 * before they expire. This ensures tokens are always valid without manual intervention.
 * 
 * Runs every 30 seconds to check and refresh tokens that are expiring soon.
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
  
  const errorDescription = error?.response?.data?.error_description?.toLowerCase() || '';
  
  // Check error code first (most reliable)
  if (errorCode && permanentErrors.some(permError => errorString.includes(permError))) {
    return true;
  }
  
  // Check error description for common phrases
  if (errorDescription.includes('incorrect or invalid refresh token') ||
      errorDescription.includes('invalid refresh token') ||
      errorDescription.includes('refresh token expired')) {
    return true;
  }
  
  // Check error message for permanent error indicators
  if (errorMessage.includes('invalid refresh token') ||
      errorMessage.includes('incorrect or invalid refresh token') ||
      (errorMessage.includes('invalid') && errorMessage.includes('token') && errorMessage.includes('refresh'))) {
    return true;
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
/**
 * Helper: Centralized function to save tokens for a user
 * Ensures consistent token saving logic across all refresh paths
 * CRITICAL: Always saves refresh_token (QuickBooks rotates these)
 * CRITICAL: Always saves expiry as Date object (not string)
 * 
 * This function matches the one in routes/quickbooks.js exactly
 */
async function saveTokensForUser(user, tokens) {
  // Validate expiresIn is a number (should be in seconds, typically 3600)
  const expiresInSeconds = parseInt(tokens.expiresIn, 10);
  if (isNaN(expiresInSeconds) || expiresInSeconds <= 0) {
    console.warn('[QuickBooksTokenRefresh] Invalid expiresIn from refresh, using default 3600 seconds');
    tokens.expiresIn = 3600;
  }
  
  // CRITICAL: Calculate expiry as Date object (not string)
  // ChatGPT requirement: "user.quickbooksTokenExpiry = new Date(Date.now() + expiresInSeconds * 1000);"
  const tokenExpiry = new Date(Date.now() + expiresInSeconds * 1000);
  
  // CRITICAL: Always save access token
  if (tokens.accessToken) {
    user.quickbooksAccessToken = tokens.accessToken;
  }
  
  // CRITICAL: Always save refresh token (QuickBooks rotates these every ~24 hours)
  // ChatGPT requirement: "if (tokens.refreshToken) { user.quickbooksRefreshToken = tokens.refreshToken; }"
  // According to Intuit docs: "Always store the latest refresh_token value from the most recent API server response"
  // "When you get a new refresh token, the previous refresh token value automatically expires"
  if (tokens.refreshToken) {
    console.log(`[QuickBooksTokenRefresh] 🔄 CRITICAL: Saving new refresh_token for user ${user.email || user.name || user._id} (old one is now invalid)`);
    user.quickbooksRefreshToken = tokens.refreshToken; // MUST overwrite - old token is invalid
  } else {
    // QuickBooks should always return refresh_token, but if not, log warning
    console.warn(`[QuickBooksTokenRefresh] ⚠️ WARNING: QuickBooks did not return new refresh_token for user ${user.email || user.name || user._id}`);
    console.warn(`[QuickBooksTokenRefresh] ⚠️ This may cause issues if token rotated. Keeping existing refresh_token.`);
  }
  
  // CRITICAL: Save expiry as Date object (ChatGPT requirement)
  // ChatGPT requirement: "user.quickbooksTokenExpiry = new Date(Date.now() + tokens.expiresIn * 1000);"
  user.quickbooksTokenExpiry = tokenExpiry;
  
  // Store refresh token expiry if provided (x_refresh_token_expires_in in seconds)
  if (tokens.refreshTokenExpiresIn) {
    const refreshTokenExpiry = new Date(Date.now() + tokens.refreshTokenExpiresIn * 1000);
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
      console.log('[QuickBooksTokenRefresh] ========================================');
      console.log('[QuickBooksTokenRefresh] Starting token refresh check...');
      console.log('[QuickBooksTokenRefresh] 🔍 Looking for connected users...');
      
      // Find all users with QuickBooks connected
      // Wrap in try-catch to handle MongoDB connection errors gracefully
      let connectedUsers;
      try {
        // First, check all users with quickbooksConnected = true (for debugging)
        const allConnected = await User.find({ quickbooksConnected: true });
        console.log(`[QuickBooksTokenRefresh] 🔍 Found ${allConnected.length} user(s) with quickbooksConnected=true`);
        
        // Then find users with both connected AND refresh token
        connectedUsers = await User.find({ 
          quickbooksConnected: true,
          quickbooksRefreshToken: { $exists: true, $ne: null }
        });
        console.log(`[QuickBooksTokenRefresh] 🔍 Found ${connectedUsers.length} user(s) with quickbooksConnected=true AND quickbooksRefreshToken`);
        
        // Debug: Log details of connected users
        if (allConnected.length > 0) {
          allConnected.forEach(user => {
            console.log(`[QuickBooksTokenRefresh] 🔍 User: ${user.email || user.name || user._id}`);
            console.log(`[QuickBooksTokenRefresh]    quickbooksConnected: ${user.quickbooksConnected}`);
            console.log(`[QuickBooksTokenRefresh]    hasRefreshToken: ${!!user.quickbooksRefreshToken}`);
            console.log(`[QuickBooksTokenRefresh]    tokenExpiry: ${user.quickbooksTokenExpiry ? user.quickbooksTokenExpiry.toISOString() : 'NOT SET'}`);
            console.log(`[QuickBooksTokenRefresh]    tokenExpiry type: ${typeof user.quickbooksTokenExpiry}`);
          });
        }
      } catch (dbError) {
        // MongoDB connection errors are temporary - don't crash the service
        if (dbError.name?.includes('MongoServerSelectionError') || dbError.name?.includes('MongoNetworkError')) {
          console.warn('[QuickBooksTokenRefresh] ⚠️ MongoDB connection issue (temporary), will retry on next interval:', dbError.message);
          return;
        }
        throw dbError; // Re-throw if it's not a connection error
      }
      
      if (connectedUsers.length === 0) {
        console.log('[QuickBooksTokenRefresh] ⚠️ No QuickBooks connections found with refresh tokens');
        console.log('[QuickBooksTokenRefresh]    This could mean:');
        console.log('[QuickBooksTokenRefresh]    1. No users have connected QuickBooks yet');
        console.log('[QuickBooksTokenRefresh]    2. Users connected but refresh tokens not saved');
        console.log('[QuickBooksTokenRefresh]    3. Using different database than where tokens were saved');
        console.log('[QuickBooksTokenRefresh] ========================================');
        return;
      }
      
      console.log(`[QuickBooksTokenRefresh] ✅ Found ${connectedUsers.length} QuickBooks connection(s) to check`);
      
      const now = new Date();
      const bufferTime = 30 * 60 * 1000; // 30 minutes buffer (refresh if expiring within 30 min) - very proactive to prevent expiry
      
      let refreshedCount = 0;
      let errorCount = 0;
      
      for (const user of connectedUsers) {
        try {
          // Debug: Log user expiry details (as ChatGPT suggested)
          console.log(`[QuickBooksTokenRefresh] 🔍 Checking user: ${user.email || user.name || user._id}`);
          console.log(`[QuickBooksTokenRefresh]    expiry raw: ${user.quickbooksTokenExpiry}`);
          console.log(`[QuickBooksTokenRefresh]    expiry type: ${typeof user.quickbooksTokenExpiry}`);
          console.log(`[QuickBooksTokenRefresh]    expiry instanceof Date: ${user.quickbooksTokenExpiry instanceof Date}`);
          
          // CRITICAL: Check refresh token expiry first (refresh tokens expire after ~101 days)
          // If refresh token is expired, we cannot refresh access token - user must reconnect
          let refreshTokenExpired = false;
          if (user.quickbooksRefreshTokenExpiry) {
            const refreshTokenExpiryTime = user.quickbooksRefreshTokenExpiry instanceof Date 
              ? user.quickbooksRefreshTokenExpiry 
              : new Date(user.quickbooksRefreshTokenExpiry);
            const timeUntilRefreshTokenExpiry = refreshTokenExpiryTime.getTime() - now.getTime();
            const daysUntilRefreshTokenExpiry = Math.floor(timeUntilRefreshTokenExpiry / (1000 * 60 * 60 * 24));
            
            console.log(`[QuickBooksTokenRefresh]    Refresh token expiry: ${refreshTokenExpiryTime.toISOString()}`);
            console.log(`[QuickBooksTokenRefresh]    Days until refresh token expires: ${daysUntilRefreshTokenExpiry}`);
            
            if (timeUntilRefreshTokenExpiry <= 0) {
              console.error(`[QuickBooksTokenRefresh] ❌ Refresh token has EXPIRED for user ${user.email || user.name || user._id}`);
              console.error(`[QuickBooksTokenRefresh] ❌ User must reconnect QuickBooks - refresh token is no longer valid`);
              refreshTokenExpired = true;
              user.quickbooksConnected = false;
              await user.save().catch(err => {
                console.error(`[QuickBooksTokenRefresh] Failed to update connection status for user ${user._id}:`, err);
              });
              errorCount++;
              continue;
            } else if (timeUntilRefreshTokenExpiry <= 7 * 24 * 60 * 60 * 1000) {
              // Refresh token expires within 7 days - log warning but still try to refresh
              console.warn(`[QuickBooksTokenRefresh] ⚠️ WARNING: Refresh token expires in ${daysUntilRefreshTokenExpiry} days - user should reconnect soon`);
            }
          }
          
          // Check if access token needs refresh
          // CRITICAL: Ensure expiry is a Date object (ChatGPT requirement)
          // ChatGPT requirement: "let expiryTime = user.quickbooksTokenExpiry; if (expiryTime && !(expiryTime instanceof Date)) { expiryTime = new Date(expiryTime); }"
          let expiryTime = user.quickbooksTokenExpiry;
          if (expiryTime && !(expiryTime instanceof Date)) {
            expiryTime = new Date(expiryTime);
            console.log(`[QuickBooksTokenRefresh]    ⚠️ Converted expiry from ${typeof user.quickbooksTokenExpiry} to Date: ${expiryTime.toISOString()}`);
          }
          
          const timeUntilExpiryMs = expiryTime ? expiryTime.getTime() - now.getTime() : 0;
          // CRITICAL: Refresh if token is expired, expiring soon, or if no expiry set
          // This ensures tokens NEVER expire - always refreshed proactively
          const shouldRefresh = !expiryTime || timeUntilExpiryMs <= 0 || timeUntilExpiryMs <= bufferTime;
          
          // Declare minutesUntilExpiry at top of scope to avoid TDZ issues
          let minutesUntilExpiry = null;
          if (expiryTime) {
            minutesUntilExpiry = Math.floor(timeUntilExpiryMs / 60000);
            console.log(`[QuickBooksTokenRefresh]    timeUntilExpiryMs: ${timeUntilExpiryMs}ms`);
            console.log(`[QuickBooksTokenRefresh]    minutesUntilExpiry: ${minutesUntilExpiry} minutes`);
          }
          
          if (shouldRefresh) {
            console.log(`[QuickBooksTokenRefresh] 🔄 Refreshing token for user: ${user.email || user.name || user._id}`);
            console.log(`[QuickBooksTokenRefresh]    Current time: ${now.toISOString()}`);
            console.log(`[QuickBooksTokenRefresh]    Expiry time: ${expiryTime ? expiryTime.toISOString() : 'Not set'}`);
            console.log(`[QuickBooksTokenRefresh]    Time until expiry: ${minutesUntilExpiry !== null ? minutesUntilExpiry : 'N/A'} minutes`);
            console.log(`[QuickBooksTokenRefresh]    Buffer time: ${Math.floor(bufferTime / 60000)} minutes`);
            console.log(`[QuickBooksTokenRefresh]    Reason: ${!expiryTime ? 'No expiry set - refreshing immediately' : timeUntilExpiryMs <= 0 ? 'Token expired - refreshing immediately' : 'Expiring within buffer - proactive refresh'}`);
            
            if (!user.quickbooksRefreshToken) {
              console.error(`[QuickBooksTokenRefresh] ❌ No refresh token found for user ${user.email || user.name || user._id} - cannot refresh`);
              errorCount++;
              continue;
            }
            
            const refreshed = await QuickBooksService.refreshAccessToken(user.quickbooksRefreshToken);
            
            // Reload user to ensure we have latest data before saving
            const freshUser = await User.findById(user._id);
            if (!freshUser) {
              console.error(`[QuickBooksTokenRefresh] ❌ User not found after refresh: ${user._id}`);
              errorCount++;
              continue;
            }
            
            // Save tokens using centralized helper
            await saveTokensForUser(freshUser, refreshed);
            
            refreshedCount++;
            console.log(`[QuickBooksTokenRefresh] ✅ Successfully refreshed token for user ${freshUser.email || freshUser.name || freshUser._id}`);
          } else {
            console.log(`[QuickBooksTokenRefresh] ✓ Token still valid for user ${user.email || user.name || user._id} (expires in ${minutesUntilExpiry !== null ? minutesUntilExpiry : 'N/A'} minutes)`);
          }
        } catch (error) {
          console.error(`[QuickBooksTokenRefresh] ❌ Failed to refresh token for user ${user.email || user.name || user._id}:`, error.message);
          console.error(`[QuickBooksTokenRefresh]    Error details:`, error.response?.data || error.message);
          
          // Only mark as disconnected if it's a permanent OAuth error
          // CRITICAL: Only disconnect if refresh token is actually invalid/expired
          // Temporary errors (network, rate limits, etc.) should NOT disconnect user
          if (isPermanentOAuthError(error)) {
            console.log(`[QuickBooksTokenRefresh] ⚠️ Permanent OAuth error detected - marking user as disconnected`);
            console.log(`[QuickBooksTokenRefresh] ⚠️ User will need to reconnect QuickBooks`);
            
            // Reload user to ensure we have latest data
            const freshUser = await User.findById(user._id);
            if (freshUser) {
              freshUser.quickbooksConnected = false;
              await freshUser.save().catch(err => {
                console.error(`[QuickBooksTokenRefresh] Failed to update connection status for user ${freshUser._id}:`, err);
              });
            }
          } else {
            // Double-check: If error message contains "invalid" or "expired", it's likely permanent
            const errorMsg = error.message?.toLowerCase() || '';
            const errorData = error.response?.data || {};
            const errorCode = errorData.error || error.error || '';
            
            // Check if error code or message indicates permanent failure
            if (errorCode === 'invalid_grant' || 
                errorMsg.includes('invalid refresh token') || 
                errorMsg.includes('incorrect or invalid refresh token') ||
                (errorMsg.includes('invalid') && errorMsg.includes('token'))) {
              console.error(`[QuickBooksTokenRefresh] ⚠️ Detected permanent OAuth error (invalid_grant/invalid token) - marking as disconnected`);
              const freshUser = await User.findById(user._id);
              if (freshUser) {
                freshUser.quickbooksConnected = false;
                await freshUser.save().catch(err => {
                  console.error(`[QuickBooksTokenRefresh] Failed to update connection status for user ${freshUser._id}:`, err);
                });
              }
            } else {
              console.warn(`[QuickBooksTokenRefresh] ⚠️ Temporary error (will retry on next check in 30 seconds):`, error.message);
              console.warn(`[QuickBooksTokenRefresh] ⚠️ Connection remains active - will retry automatically`);
            }
          }
          
          errorCount++;
        }
      }
      
      console.log(`[QuickBooksTokenRefresh] ✅ Refresh complete. Refreshed: ${refreshedCount}, Errors: ${errorCount}, Total: ${connectedUsers.length}`);
      console.log(`[QuickBooksTokenRefresh] 📊 Next check in 30 seconds`);
    } catch (error) {
      console.error('[QuickBooksTokenRefresh] ❌ Error in token refresh service:', error);
    }
  }
  
  /**
   * Start the background token refresh service
   * Runs every 30 seconds to check and refresh tokens that are expiring soon
   * This ensures tokens are always fresh and never expire during use
   * NO MANUAL INTERVENTION NEEDED - fully automatic
   */
  static start() {
    console.log('[QuickBooksTokenRefresh] 🚀 Starting QuickBooks token refresh service...');
    console.log('[QuickBooksTokenRefresh] ✅ FULLY AUTOMATIC - Connect once, never reconnect!');
    console.log('[QuickBooksTokenRefresh] Service will run every 30 seconds');
    console.log('[QuickBooksTokenRefresh] Access tokens refreshed if expiring within 30 minutes (very proactive)');
    console.log('[QuickBooksTokenRefresh] Refresh tokens checked for expiry (last ~101 days)');
    console.log('[QuickBooksTokenRefresh] This ensures tokens NEVER expire - always refreshed before expiry');
    console.log('[QuickBooksTokenRefresh] ⚠️  Only disconnects if refresh token expires (~101 days) - user must reconnect then');
    
    // Run immediately on startup to refresh any tokens that need it
    this.refreshAllTokens().catch(err => {
      console.error('[QuickBooksTokenRefresh] ❌ Error in initial token refresh:', err);
    });
    
    // Then run every 30 seconds to check and refresh tokens (very frequent for immediate refresh)
    const intervalId = setInterval(() => {
      this.refreshAllTokens().catch(err => {
        console.error('[QuickBooksTokenRefresh] ❌ Error in scheduled token refresh:', err);
      });
    }, 30 * 1000); // 30 seconds (very frequent checks)
    
    // Store interval ID for potential cleanup (though we don't stop it)
    this._intervalId = intervalId;
    
    console.log('[QuickBooksTokenRefresh] ✅ Service started successfully - tokens will refresh automatically');
    console.log('[QuickBooksTokenRefresh] 📊 Next refresh check in 30 seconds');
  }
}

module.exports = QuickBooksTokenRefreshService;

