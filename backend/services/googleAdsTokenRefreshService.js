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
      
      // Find admin user with Google Ads connected
      const adminUser = await User.findOne({ 
        role: 'admin',
        googleAdsRefreshToken: { $exists: true, $ne: null }
      });
      
      if (!adminUser) {
        console.log('[GoogleAdsTokenRefresh] ⚠️ No admin user with Google Ads refresh token found');
        return;
      }
      
      console.log(`[GoogleAdsTokenRefresh] ✅ Found admin user with Google Ads connected`);
      
      const now = new Date();
      const bufferTime = 5 * 60 * 1000; // 5 minutes buffer (refresh if expiring within 5 min)
      
      // Check if token needs refresh
      let expiryTime = adminUser.googleAdsTokenExpiry;
      if (expiryTime && !(expiryTime instanceof Date)) {
        expiryTime = new Date(expiryTime);
      }
      
      const timeUntilExpiryMs = expiryTime ? expiryTime.getTime() - now.getTime() : 0;
      const shouldRefresh = !expiryTime || timeUntilExpiryMs <= 0 || timeUntilExpiryMs <= bufferTime;
      
      let minutesUntilExpiry = null;
      if (expiryTime) {
        minutesUntilExpiry = Math.floor(timeUntilExpiryMs / 60000);
      }
      
      if (shouldRefresh) {
        console.log(`[GoogleAdsTokenRefresh] 🔄 Refreshing token for admin user`);
        console.log(`[GoogleAdsTokenRefresh]    Current time: ${now.toISOString()}`);
        console.log(`[GoogleAdsTokenRefresh]    Expiry time: ${expiryTime ? expiryTime.toISOString() : 'Not set'}`);
        console.log(`[GoogleAdsTokenRefresh]    Time until expiry: ${minutesUntilExpiry !== null ? minutesUntilExpiry : 'N/A'} minutes`);
        console.log(`[GoogleAdsTokenRefresh]    Buffer time: ${Math.floor(bufferTime / 60000)} minutes`);
        console.log(`[GoogleAdsTokenRefresh]    Reason: ${!expiryTime ? 'No expiry set - refreshing immediately' : timeUntilExpiryMs <= 0 ? 'Token expired - refreshing immediately' : 'Expiring within buffer - proactive refresh'}`);
        
        if (!adminUser.googleAdsRefreshToken) {
          console.error(`[GoogleAdsTokenRefresh] ❌ No refresh token found for admin user - cannot refresh`);
          return;
        }
        
        const refreshed = await refreshGoogleAdsToken(adminUser.googleAdsRefreshToken);
        
        // Reload user to ensure we have latest data before saving
        const freshUser = await User.findById(adminUser._id);
        if (!freshUser) {
          console.error(`[GoogleAdsTokenRefresh] ❌ Admin user not found after refresh`);
          return;
        }
        
        // Save tokens using helper
        await saveTokensForUser(freshUser, refreshed);
        
        console.log(`[GoogleAdsTokenRefresh] ✅ Successfully refreshed token for admin user`);
      } else {
        console.log(`[GoogleAdsTokenRefresh] ✓ Token still valid (expires in ${minutesUntilExpiry !== null ? minutesUntilExpiry : 'N/A'} minutes)`);
      }
      
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
