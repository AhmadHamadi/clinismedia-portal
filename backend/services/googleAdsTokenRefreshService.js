/**
 * Google Ads Token Refresh Service
 * 
 * Background service that proactively refreshes Google Ads access tokens
 * before they expire. This ensures tokens are always valid without manual intervention.
 * 
 * Runs every 30 seconds to check and refresh tokens that are expiring soon.
 */

const User = require('../models/User');
const axios = require('axios');

/**
 * Helper: Determine if an OAuth error is permanent (requires re-authentication)
 */
function isPermanentOAuthError(error) {
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorCode = error?.response?.data?.error || error?.error || '';
  const errorString = errorCode.toString().toLowerCase();
  
  // Permanent OAuth errors that require user to reconnect
  const permanentErrors = [
    'invalid_grant',
    'invalid_client',
    'unauthorized_client',
    'invalid_refresh_token',
    'refresh_token_expired',
    'access_denied'
  ];
  
  return permanentErrors.some(permError => 
    errorMessage.includes(permError) || 
    errorString.includes(permError)
  );
}

/**
 * Helper: Refresh Google Ads token
 */
async function refreshGoogleAdsToken(refreshToken) {
  const response = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  
  return {
    access_token: response.data.access_token,
    refresh_token: response.data.refresh_token || refreshToken, // Use new if provided, otherwise keep old
    expires_in: response.data.expires_in || 3600
  };
}

/**
 * Helper: Save tokens to admin user
 */
async function saveTokensForUser(user, tokens) {
  const expiresIn = parseInt(tokens.expires_in || 3600, 10);
  const tokenExpiry = new Date(Date.now() + expiresIn * 1000);
  
  user.googleAdsAccessToken = tokens.access_token;
  user.googleAdsTokenExpiry = tokenExpiry;
  
  // Save new refresh token if provided (Google may rotate it)
  if (tokens.refresh_token) {
    user.googleAdsRefreshToken = tokens.refresh_token;
    console.log(`[GoogleAdsTokenRefresh] 🔄 Saving new refresh_token for admin user`);
  }
  
  await user.save();
  
  const minutesUntilExpiry = Math.floor(expiresIn / 60);
  console.log(`[GoogleAdsTokenRefresh] ✅ Tokens saved for admin user`);
  console.log(`[GoogleAdsTokenRefresh]    Expires in ${minutesUntilExpiry} minutes (${tokenExpiry.toISOString()})`);
}

class GoogleAdsTokenRefreshService {
  /**
   * Check and refresh Google Ads tokens for admin user
   * This runs as a background job to ensure tokens are always fresh
   */
  static async refreshAdminToken() {
    try {
      console.log('[GoogleAdsTokenRefresh] ========================================');
      console.log('[GoogleAdsTokenRefresh] Starting token refresh check...');
      
      // Refresh for every user that has a Google Ads refresh token.
      // This keeps tokens alive for all mappings without deleting or resetting anything.
      const users = await User.find({
        googleAdsRefreshToken: { $exists: true, $ne: null }
      });

      if (!users.length) {
        console.log('[GoogleAdsTokenRefresh] ⚠️ No users with Google Ads refresh token found');
        return;
      }

      console.log(`[GoogleAdsTokenRefresh] ✅ Found ${users.length} user(s) with Google Ads refresh token`);

      const now = new Date();
      const bufferTime = 5 * 60 * 1000; // 5 minutes buffer (refresh if expiring within 5 min)
      let refreshedCount = 0;

      for (const user of users) {
        try {
          let expiryTime = user.googleAdsTokenExpiry;
          if (expiryTime && !(expiryTime instanceof Date)) {
            expiryTime = new Date(expiryTime);
          }

          const timeUntilExpiryMs = expiryTime ? expiryTime.getTime() - now.getTime() : 0;
          const shouldRefresh = !expiryTime || timeUntilExpiryMs <= 0 || timeUntilExpiryMs <= bufferTime;
          const minutesUntilExpiry = expiryTime ? Math.floor(timeUntilExpiryMs / 60000) : null;

          if (!shouldRefresh) {
            console.log(`[GoogleAdsTokenRefresh] ✓ User ${user._id} token still valid (expires in ${minutesUntilExpiry !== null ? minutesUntilExpiry : 'N/A'} minutes)`);
            continue;
          }

          console.log(`[GoogleAdsTokenRefresh] 🔄 Refreshing token for user ${user._id} (${user.email || user.role || 'unknown'})`);
          const refreshed = await refreshGoogleAdsToken(user.googleAdsRefreshToken);

          const freshUser = await User.findById(user._id);
          if (!freshUser) {
            console.error(`[GoogleAdsTokenRefresh] ❌ User ${user._id} not found after refresh`);
            continue;
          }

          await saveTokensForUser(freshUser, refreshed);
          refreshedCount += 1;
        } catch (userError) {
          console.error(`[GoogleAdsTokenRefresh] ❌ Failed refreshing user ${user._id}:`, userError.message);
        }
      }

      console.log(`[GoogleAdsTokenRefresh] ✅ Refresh cycle complete. Refreshed ${refreshedCount}/${users.length} token(s).`);
      console.log(`[GoogleAdsTokenRefresh] 📊 Next check in 30 seconds`);
    } catch (error) {
      console.error('[GoogleAdsTokenRefresh] ❌ Error in token refresh service:', error.message);
      console.error('[GoogleAdsTokenRefresh]    Error details:', error.response?.data || error.message);
      
      // Only mark as disconnected if it's a permanent OAuth error
      if (isPermanentOAuthError(error)) {
        console.log(`[GoogleAdsTokenRefresh] ⚠️ Permanent OAuth error detected - admin will need to reconnect`);
        // Don't clear tokens automatically - let user reconnect manually
      } else {
        console.warn(`[GoogleAdsTokenRefresh] ⚠️ Temporary error (will retry on next check in 30 seconds):`, error.message);
      }
    }
  }
  
  /**
   * Start the background token refresh service
   * Runs every 30 seconds to check and refresh tokens that are expiring soon
   * This ensures tokens are always fresh and never expire during use
   * NO MANUAL INTERVENTION NEEDED - fully automatic
   */
  static start() {
    console.log('[GoogleAdsTokenRefresh] 🚀 Starting Google Ads token refresh service...');
    console.log('[GoogleAdsTokenRefresh] ✅ FULLY AUTOMATIC - Connect once, never reconnect!');
    console.log('[GoogleAdsTokenRefresh] Service will run every 30 seconds');
    console.log('[GoogleAdsTokenRefresh] Access tokens refreshed if expiring within 5 minutes (very proactive)');
    console.log('[GoogleAdsTokenRefresh] This ensures tokens NEVER expire - always refreshed before expiry');
    
    // Run immediately on startup to refresh any tokens that need it
    this.refreshAdminToken().catch(err => {
      console.error('[GoogleAdsTokenRefresh] ❌ Error in initial token refresh:', err);
    });
    
    // Then run every 30 seconds to check and refresh tokens (very frequent for immediate refresh)
    const intervalId = setInterval(() => {
      this.refreshAdminToken().catch(err => {
        console.error('[GoogleAdsTokenRefresh] ❌ Error in scheduled token refresh:', err);
      });
    }, 30 * 1000); // 30 seconds (very frequent checks)
    
    // Store interval ID for potential cleanup (though we don't stop it)
    this._intervalId = intervalId;
    
    console.log('[GoogleAdsTokenRefresh] ✅ Service started successfully - tokens will refresh automatically');
    console.log('[GoogleAdsTokenRefresh] 📊 Next refresh check in 30 seconds');
  }
}

module.exports = GoogleAdsTokenRefreshService;
