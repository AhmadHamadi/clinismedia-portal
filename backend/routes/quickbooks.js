const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const User = require('../models/User');
const QuickBooksService = require('../services/quickbooksService');
const QuickBooksCustomerMapping = require('../models/QuickBooksCustomerMapping');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');
const crypto = require('crypto');

/**
 * Helper: Get the QuickBooks connection owner (admin user with QuickBooks connected)
 */
async function getQuickBooksConnectionOwner() {
  // Find any user with quickbooksConnected = true
  const user = await User.findOne({ quickbooksConnected: true });
  if (!user) {
    throw new Error('No user with quickbooksConnected=true found');
  }
  return user;
}

/**
 * Helper: Determine if an OAuth error is permanent (requires re-authentication)
 * Permanent errors include: invalid_grant, invalid_client, unauthorized_client
 * Temporary errors include: network issues, rate limits, etc.
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
 * Helper: Centralized function to save tokens for a user
 * Ensures consistent token saving logic across all refresh paths
 */
/**
 * Helper: Centralized function to save tokens for a user
 * Ensures consistent token saving logic across all refresh paths
 * CRITICAL: Always saves refresh_token (QuickBooks rotates these)
 * CRITICAL: Always saves expiry as Date object (not string)
 */
async function saveTokensForUser(user, tokens) {
  // Validate expiresIn is a number (should be in seconds, typically 3600)
  const expiresInSeconds = parseInt(tokens.expiresIn, 10);
  if (isNaN(expiresInSeconds) || expiresInSeconds <= 0) {
    console.warn('[QuickBooks] Invalid expiresIn from refresh, using default 3600 seconds');
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
    console.log('[QuickBooks] 🔄 CRITICAL: Saving new refresh_token from QuickBooks (old one is now invalid)');
    user.quickbooksRefreshToken = tokens.refreshToken; // MUST overwrite - old token is invalid
  } else {
    // QuickBooks should always return refresh_token, but if not, log warning
    console.warn('[QuickBooks] ⚠️ WARNING: QuickBooks did not return new refresh_token in response');
    console.warn('[QuickBooks] ⚠️ This may cause issues if token rotated. Keeping existing refresh_token.');
  }
  
  // CRITICAL: Save expiry as Date object (ChatGPT requirement)
  // ChatGPT requirement: "user.quickbooksTokenExpiry = new Date(Date.now() + tokens.expiresIn * 1000);"
  user.quickbooksTokenExpiry = tokenExpiry;
  console.log('[QuickBooks] Setting tokenExpiry to:', tokenExpiry.toISOString());
  console.log('[QuickBooks] tokenExpiry type:', typeof tokenExpiry, 'instanceof Date:', tokenExpiry instanceof Date);
  
  // Store refresh token expiry if provided (x_refresh_token_expires_in in seconds)
  if (tokens.refreshTokenExpiresIn) {
    const refreshTokenExpiry = new Date(Date.now() + tokens.refreshTokenExpiresIn * 1000);
    user.quickbooksRefreshTokenExpiry = refreshTokenExpiry;
    console.log('[QuickBooks] Refresh token expires in', Math.floor(tokens.refreshTokenExpiresIn / 86400), 'days');
  }
  
  console.log('[QuickBooks] Saving tokens to database...');
  await user.save();
  console.log('[QuickBooks] ✅ Tokens saved to database successfully');
  
  // Verify what was saved (for debugging)
  const savedUser = await User.findById(user._id);
  if (savedUser) {
    console.log('[QuickBooks] ✅ Verification - Saved tokenExpiry:', savedUser.quickbooksTokenExpiry ? savedUser.quickbooksTokenExpiry.toISOString() : 'NOT SET');
    console.log('[QuickBooks] ✅ Verification - Saved tokenExpiry type:', typeof savedUser.quickbooksTokenExpiry);
    console.log('[QuickBooks] ✅ Verification - Saved tokenExpiry instanceof Date:', savedUser.quickbooksTokenExpiry instanceof Date);
    console.log('[QuickBooks] ✅ Verification - Has refreshToken:', !!savedUser.quickbooksRefreshToken);
    console.log('[QuickBooks] ✅ Verification - quickbooksConnected:', savedUser.quickbooksConnected);
  }
  
  console.log('[QuickBooks] ✅ Tokens saved successfully. New expiry:', tokenExpiry.toISOString());
  console.log('[QuickBooks] Token will expire in', expiresInSeconds, 'seconds (', Math.floor(expiresInSeconds / 60), 'minutes)');
}

/**
 * Helper: Make a QuickBooks API call with automatic 401 retry
 * If a 401 error occurs, it will refresh the token and retry once
 */
async function quickbooksApiCall(apiCallFn) {
  try {
    return await apiCallFn();
  } catch (error) {
    // If we get a 401 Unauthorized, try refreshing the token and retry once
    if (error.response?.status === 401 || error.response?.statusCode === 401) {
      console.log('[QuickBooks] Got 401 error, refreshing token and retrying...');
      
      try {
        // Force refresh the token
        const owner = await getQuickBooksConnectionOwner();
        if (!owner.quickbooksRefreshToken) {
          throw new Error('No refresh token available');
        }
        
        const refreshed = await QuickBooksService.refreshAccessToken(owner.quickbooksRefreshToken);
        
        // Save tokens using centralized helper
        await saveTokensForUser(owner, refreshed);
        
        // Retry the API call with the new token
        console.log('[QuickBooks] Retrying API call with fresh token...');
        return await apiCallFn();
      } catch (refreshError) {
        console.error('[QuickBooks] ❌ Failed to refresh token after 401:', refreshError);
        
        // Only mark as disconnected if it's a permanent OAuth error
        if (isPermanentOAuthError(refreshError)) {
          const owner = await getQuickBooksConnectionOwner();
          owner.quickbooksConnected = false;
          await owner.save().catch(() => {});
          throw new Error('Failed to refresh QuickBooks token. Please reconnect your QuickBooks account.');
        } else {
          // Temporary error - don't disconnect, just throw the error
          throw refreshError;
        }
      }
    }
    
    // Re-throw non-401 errors
    throw error;
  }
}

/**
 * Helper: Get valid access token (refreshes if expired)
 */
async function getValidAccessToken() {
  const owner = await getQuickBooksConnectionOwner();
  
  if (!owner.quickbooksAccessToken || !owner.quickbooksRefreshToken) {
    throw new Error('QuickBooks not connected');
  }

  // Check if token is expired (with 5 minute buffer for proactive refresh)
  // QuickBooks access tokens expire in 1 hour - refresh 5 minutes before expiry
  const now = new Date();
  const expiryTime = owner.quickbooksTokenExpiry ? new Date(owner.quickbooksTokenExpiry) : null;
  const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds (proactive refresh)
  
  // Log current token status for debugging
  if (expiryTime) {
    const timeUntilExpiry = expiryTime.getTime() - now.getTime();
    const minutesUntilExpiry = Math.floor(timeUntilExpiry / 60000);
    const isExpired = timeUntilExpiry <= 0;
    console.log(`[QuickBooks] Token status: ${isExpired ? 'EXPIRED' : 'Valid'}, expires in ${minutesUntilExpiry} minutes (${expiryTime.toISOString()})`);
  } else {
    console.log('[QuickBooks] Token expiry not set, will refresh');
  }
  
  // If no expiry time is set, or token is expired/expiring soon, refresh it
  const shouldRefresh = !expiryTime || (expiryTime && (now.getTime() + bufferTime) >= expiryTime.getTime());
  
  if (shouldRefresh) {
    console.log('[QuickBooks] Token expired or expiring soon, refreshing automatically...');
    try {
      const refreshed = await QuickBooksService.refreshAccessToken(owner.quickbooksRefreshToken);
      
      // Save tokens using centralized helper
      await saveTokensForUser(owner, refreshed);
      
      return refreshed.accessToken;
    } catch (error) {
      console.error('[QuickBooks] ❌ Failed to refresh token:', error);
      
      // Only mark as disconnected if it's a permanent OAuth error
      if (isPermanentOAuthError(error)) {
        owner.quickbooksConnected = false;
        await owner.save().catch(err => console.error('[QuickBooks] Failed to update connection status:', err));
        throw new Error('Failed to refresh QuickBooks token. Please reconnect your QuickBooks account.');
      } else {
        // Temporary error - rethrow without disconnecting
        throw error;
      }
    }
  }
  
  return owner.quickbooksAccessToken;
}

/**
 * GET /api/quickbooks/connect
 * Initiates QuickBooks OAuth flow
 * Only admin can connect QuickBooks (similar to Facebook/Google management)
 */
router.get('/connect', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // CRITICAL: Log which user is initiating the connection
    console.log('[QuickBooks Connect] ========================================');
    console.log('[QuickBooks Connect] 🔍 USER AUTHENTICATION CHECK:');
    console.log('[QuickBooks Connect]   Authenticated User ID:', userId);
    console.log('[QuickBooks Connect]   Authenticated User Email:', user.email);
    console.log('[QuickBooks Connect]   Authenticated User Name:', user.name);
    console.log('[QuickBooks Connect]   Authenticated User Role:', user.role);
    console.log('[QuickBooks Connect] ⚠️  CRITICAL: Tokens will be saved to THIS user account!');
    console.log('[QuickBooks Connect] ⚠️  If this is wrong, log out and log in with the correct account');
    console.log('[QuickBooks Connect] ========================================');

    // Log environment info for debugging
    console.log('[QuickBooks Connect] Environment check:');
    console.log('  NODE_ENV:', process.env.NODE_ENV);
    console.log('  RAILWAY_PUBLIC_DOMAIN:', process.env.RAILWAY_PUBLIC_DOMAIN || 'NOT SET');
    console.log('  BACKEND_URL:', process.env.BACKEND_URL || 'NOT SET');
    console.log('  QUICKBOOKS_REDIRECT_URI:', process.env.QUICKBOOKS_REDIRECT_URI || 'NOT SET');
    console.log('  QUICKBOOKS_CLIENT_ID:', process.env.QUICKBOOKS_CLIENT_ID ? 'SET' : 'NOT SET');

    // Generate state for OAuth security - include user ID
    const randomState = crypto.randomBytes(16).toString('hex');
    const state = `${userId}:${randomState}`;
    
    // Store state in user record temporarily
    user.quickbooksOAuthState = state;
    await user.save();
    
    console.log('[QuickBooks Connect] State generated with User ID:', userId);

    // Get authorization URL - this will throw if redirect URI is invalid
    const authUrl = QuickBooksService.getAuthorizationUrl(state);
    
    console.log('[QuickBooks Connect] ========================================');
    console.log('[QuickBooks Connect] OAuth Authorization URL Generated');
    console.log('[QuickBooks Connect]   Client ID:', QuickBooksService.clientId);
    console.log('[QuickBooks Connect]   Redirect URI:', QuickBooksService.redirectUri);
    console.log('[QuickBooks Connect]   State:', state);
    console.log('[QuickBooks Connect]   Full Auth URL:', authUrl);
    console.log('[QuickBooks Connect] ⚠️  CRITICAL: Redirect URI must match EXACTLY in Intuit Developer Portal');
    console.log('[QuickBooks Connect] ⚠️  Portal: https://developer.intuit.com/app/developer/dashboard');
    console.log('[QuickBooks Connect] ⚠️  Must add:', QuickBooksService.redirectUri);
    console.log('[QuickBooks Connect] ========================================');
    
    res.json({ authUrl, state });
  } catch (error) {
    console.error('❌ Error initiating QuickBooks connection:', error.message);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      error: error.message || 'Failed to initiate QuickBooks connection',
      details: 'Check server logs for more information'
    });
  }
});

/**
 * GET /api/quickbooks/callback
 * Handles OAuth callback from QuickBooks
 * Note: This endpoint does NOT require authentication as it's called by QuickBooks
 */
router.get('/callback', async (req, res) => {
  // Determine frontend URL based on environment
  // Priority: FRONTEND_URL > ngrok detection (localhost) > NODE_ENV development > Production fallback
  let frontendUrl = process.env.FRONTEND_URL;
  
  if (!frontendUrl) {
    // If using ngrok (BACKEND_URL contains ngrok), assume localhost frontend
    const backendUrl = process.env.BACKEND_URL || process.env.QUICKBOOKS_REDIRECT_URI || '';
    if (backendUrl.includes('ngrok') || backendUrl.includes('ngrok-free.dev')) {
      frontendUrl = 'http://localhost:5173';
      console.log('[QuickBooks Callback] Detected ngrok, using localhost frontend:', frontendUrl);
    } else if (process.env.NODE_ENV === 'development') {
      frontendUrl = 'http://localhost:5173';
      console.log('[QuickBooks Callback] Using development fallback (localhost)');
    } else {
      // Production: Default to production frontend URL
      frontendUrl = 'https://www.clinimediaportal.ca';
      console.log('[QuickBooks Callback] Using production fallback');
    }
  } else {
    console.log('[QuickBooks Callback] Using FRONTEND_URL from environment:', frontendUrl);
  }

  console.log('[QuickBooks Callback] ========================================');
  console.log('[QuickBooks Callback] 📥 OAUTH CALLBACK RECEIVED');
  console.log('[QuickBooks Callback]   Frontend URL:', frontendUrl);
  console.log('[QuickBooks Callback]   Redirect URI (from service):', QuickBooksService.redirectUri);
  console.log('[QuickBooks Callback]   ⚠️  CRITICAL: Verify this redirect URI matches Intuit Portal');
  console.log('[QuickBooks Callback]   Request origin:', req.headers.origin || 'NOT SET');
  console.log('[QuickBooks Callback]   Request referer:', req.headers.referer || 'NOT SET');
  console.log('[QuickBooks Callback]   Request host:', req.headers.host || 'NOT SET');
  console.log('[QuickBooks Callback]   Request URL:', req.url);
  console.log('[QuickBooks Callback]   Query params:', req.query);
  console.log('[QuickBooks Callback] ========================================');

  try {
    const { code, state, realmId, error } = req.query;

    if (error) {
      return res.redirect(`${frontendUrl}/admin/quickbooks?error=${encodeURIComponent(error)}`);
    }

    if (!code || !realmId) {
      return res.redirect(`${frontendUrl}/admin/quickbooks?error=${encodeURIComponent('Missing authorization code or realm ID')}`);
    }

    if (!state) {
      return res.redirect(`${frontendUrl}/admin/quickbooks?error=${encodeURIComponent('Missing state parameter')}`);
    }

    // Extract user ID from state (format: userId:randomState)
    const [userId, randomState] = state.split(':');
    
    if (!userId) {
      return res.redirect(`${frontendUrl}/admin/quickbooks?error=${encodeURIComponent('Invalid state parameter')}`);
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.redirect(`${frontendUrl}/admin/quickbooks?error=${encodeURIComponent('User not found')}`);
    }

    // CRITICAL: Log which user will receive the tokens
    console.log('[QuickBooks Callback] ========================================');
    console.log('[QuickBooks Callback] 🔍 TOKEN RECIPIENT CHECK:');
    console.log('[QuickBooks Callback]   User ID from state:', userId);
    console.log('[QuickBooks Callback]   User Email:', user.email);
    console.log('[QuickBooks Callback]   User Name:', user.name);
    console.log('[QuickBooks Callback] ⚠️  CRITICAL: Tokens will be saved to THIS user account!');
    console.log('[QuickBooks Callback] ========================================');

    // Verify state matches stored state
    console.log('[QuickBooks Callback] 🔍 Verifying OAuth state...');
    console.log('[QuickBooks Callback]   Stored state:', user.quickbooksOAuthState);
    console.log('[QuickBooks Callback]   Received state:', state);
    
    if (user.quickbooksOAuthState && user.quickbooksOAuthState !== state) {
      console.error('[QuickBooks Callback] ❌ State mismatch - possible CSRF attack');
      return res.redirect(`${frontendUrl}/admin/quickbooks?error=${encodeURIComponent('Invalid state parameter - possible CSRF attack')}`);
    }
    console.log('[QuickBooks Callback] ✅ State verified');

    // Exchange code for tokens
    console.log('[QuickBooks Callback] 🔵 Exchanging authorization code for tokens...');
    console.log('[QuickBooks Callback]   Code received:', code ? 'YES' : 'NO');
    console.log('[QuickBooks Callback]   Realm ID:', realmId);
    const tokens = await QuickBooksService.exchangeCodeForTokens(code);
    console.log('[QuickBooks Callback] ✅ Token exchange successful');

    // Validate expiresIn is a number (should be in seconds, typically 3600 for access tokens)
    const expiresInSeconds = parseInt(tokens.expiresIn, 10);
    if (isNaN(expiresInSeconds) || expiresInSeconds <= 0) {
      console.warn('[QuickBooks Callback] Invalid expiresIn value:', tokens.expiresIn, 'Defaulting to 3600 seconds (1 hour)');
      tokens.expiresIn = 3600;
    }

    console.log('[QuickBooks Callback] Token details:');
    console.log('  expiresIn (seconds):', expiresInSeconds);
    console.log('  expiresIn (minutes):', Math.floor(expiresInSeconds / 60));

    // Set additional QuickBooks connection fields FIRST
    user.quickbooksRealmId = realmId || tokens.realmId;
    user.quickbooksConnected = true; // CRITICAL: Set to true BEFORE saving tokens
    user.quickbooksOAuthState = null; // Clear state
    
    // Save tokens using centralized helper (this will also save the connection status)
    await saveTokensForUser(user, tokens);
    
    // Verify connection status is saved
    const savedUser = await User.findById(user._id);
    if (!savedUser.quickbooksConnected) {
      console.error('[QuickBooks Callback] ❌ ERROR: quickbooksConnected was not saved! Setting it now...');
      savedUser.quickbooksConnected = true;
      await savedUser.save();
    }

    console.log(`✅ QuickBooks connected for user ${user.name} (${user.email})`);
    console.log(`✅ Token will expire in ${expiresInSeconds} seconds (${Math.floor(expiresInSeconds / 60)} minutes)`);

    res.redirect(`${frontendUrl}/admin/quickbooks?success=true`);
  } catch (error) {
    console.error('Error in QuickBooks callback:', error);
    res.redirect(`${frontendUrl}/admin/quickbooks?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * GET /api/quickbooks/refresh
 * Manually refresh access token (admin only)
 * CRITICAL: Always saves the new refresh_token from QuickBooks response
 */
router.get('/refresh', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user || !user.quickbooksRefreshToken) {
      return res.status(400).json({ error: 'QuickBooks not connected or no refresh token available' });
    }

    console.log('[QuickBooks Refresh] Manual token refresh requested by admin');
    const refreshed = await QuickBooksService.refreshAccessToken(user.quickbooksRefreshToken);

    // Save tokens using centralized helper
    await saveTokensForUser(user, refreshed);

    // Reload user to get updated expiry
    await user.populate();
    const expiresInSeconds = parseInt(refreshed.expiresIn, 10);
    console.log('[QuickBooks Refresh] ✅ Token refreshed successfully. New expiry:', user.quickbooksTokenExpiry?.toISOString());
    console.log('[QuickBooks Refresh] Token will expire in', expiresInSeconds, 'seconds (', Math.floor(expiresInSeconds / 60), 'minutes)');

    res.json({ 
      message: 'Token refreshed successfully',
      expiresAt: user.quickbooksTokenExpiry,
    });
  } catch (error) {
    console.error('[QuickBooks Refresh] ❌ Error refreshing token:', error);
    
    // Only mark as disconnected if it's a permanent OAuth error
    if (isPermanentOAuthError(error)) {
      user.quickbooksConnected = false;
      await user.save().catch(err => console.error('[QuickBooks Refresh] Failed to update connection status:', err));
      return res.status(401).json({ error: 'QuickBooks token refresh failed. Please reconnect your QuickBooks account.' });
    }
    
    res.status(500).json({ error: error.message || 'Failed to refresh token' });
  }
});

/**
 * GET /api/quickbooks/token-refresh-status
 * Get token refresh service status and next refresh time (admin only)
 */
router.get('/token-refresh-status', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const owner = await getQuickBooksConnectionOwner();
    
    if (!owner.quickbooksConnected) {
      return res.json({ 
        connected: false,
        message: 'QuickBooks not connected',
        tokenRefreshService: 'Service is running (will activate when connected)'
      });
    }

    const now = new Date();
    const expiryTime = owner.quickbooksTokenExpiry ? new Date(owner.quickbooksTokenExpiry) : null;
    const timeUntilExpiry = expiryTime ? expiryTime.getTime() - now.getTime() : 0;
    const minutesUntilExpiry = expiryTime ? Math.floor(timeUntilExpiry / 60000) : null;
    const bufferTime = 30 * 60 * 1000; // 30 minutes
    const needsRefresh = !expiryTime || timeUntilExpiry <= 0 || timeUntilExpiry <= bufferTime;

    res.json({
      connected: true,
      connectedUser: {
        email: owner.email,
        name: owner.name,
        id: owner._id
      },
      tokenExpiry: expiryTime ? expiryTime.toISOString() : null,
      minutesUntilExpiry: minutesUntilExpiry,
      needsRefresh: needsRefresh,
      refreshReason: !expiryTime ? 'No expiry set' : timeUntilExpiry <= 0 ? 'Token expired' : timeUntilExpiry <= bufferTime ? 'Expiring within 30 minutes' : 'Token still valid',
      tokenRefreshService: {
        status: 'Running',
        interval: 'Every 30 seconds',
        bufferTime: '30 minutes before expiry',
        nextCheck: 'Within 30 seconds',
        automatic: true
      }
    });
  } catch (error) {
    console.error('Error getting token refresh status:', error);
    res.status(500).json({ error: 'Failed to get token refresh status' });
  }
});

/**
 * GET /api/quickbooks/status
 * Get QuickBooks connection status
 * For customers: checks if their clinic has QuickBooks connected
 * For admin: checks their own connection
 */
router.get('/status', authenticateToken, authorizeRole(['customer', 'admin']), async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // For customers, check if their clinic (admin) has QuickBooks connected
    // For admin, check their own connection
    let quickbooksUser = user;
    
    if (req.user.role === 'customer') {
      // Find admin user who has QuickBooks connected
      const adminUser = await User.findOne({ 
        role: 'admin',
        quickbooksConnected: true 
      });
      
      if (adminUser) {
        quickbooksUser = adminUser;
      }
    }

    const isConnected = quickbooksUser.quickbooksConnected && 
                       quickbooksUser.quickbooksAccessToken && 
                       quickbooksUser.quickbooksRealmId;

    res.json({
      connected: isConnected,
      realmId: quickbooksUser.quickbooksRealmId || null,
      lastSynced: quickbooksUser.quickbooksLastSynced || null,
      tokenExpiry: quickbooksUser.quickbooksTokenExpiry || null,
    });
  } catch (error) {
    console.error('Error getting QuickBooks status:', error);
    res.status(500).json({ error: 'Failed to get QuickBooks status' });
  }
});

/**
 * GET /api/quickbooks/disconnect
 * Disconnect QuickBooks account (admin only)
 */
router.get('/disconnect', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Clear QuickBooks data
    user.quickbooksAccessToken = null;
    user.quickbooksRefreshToken = null;
    user.quickbooksRealmId = null;
    user.quickbooksTokenExpiry = null;
    user.quickbooksConnected = false;
    user.quickbooksLastSynced = null;
    user.quickbooksOAuthState = null;
    await user.save();

    res.json({ message: 'QuickBooks disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting QuickBooks:', error);
    res.status(500).json({ error: 'Failed to disconnect QuickBooks' });
  }
});

// GET /api/quickbooks/customers
router.get('/customers', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const owner = await getQuickBooksConnectionOwner();

    if (!owner.quickbooksAccessToken || !owner.quickbooksRealmId) {
      return res.status(400).json({ error: 'QuickBooks is not connected.' });
    }

    const accessToken = await getValidAccessToken();

    const customers = await QuickBooksService.getCustomers({
      accessToken,
      realmId: owner.quickbooksRealmId,
      maxResults: 1000,
    });

    res.json({ customers });
  } catch (err) {
    console.error('[QuickBooks /customers] Error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch QuickBooks customers' });
  }
});

// POST /api/quickbooks/map-customer
// body: { portalCustomerId (or clinimediaCustomerId), quickbooksCustomerId, quickbooksCustomerDisplayName (or quickbooksCustomerName) }
router.post('/map-customer', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    // Support both old and new field names for compatibility
    const portalCustomerId = req.body.portalCustomerId || req.body.clinimediaCustomerId;
    const quickbooksCustomerId = req.body.quickbooksCustomerId;
    const quickbooksCustomerDisplayName = req.body.quickbooksCustomerDisplayName || req.body.quickbooksCustomerName;

    if (!portalCustomerId || !quickbooksCustomerId) {
      return res.status(400).json({ error: 'portalCustomerId (or clinimediaCustomerId) and quickbooksCustomerId are required.' });
    }

    // Validate portalCustomerId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(portalCustomerId)) {
      return res.status(400).json({ error: 'Invalid portalCustomerId format' });
    }

    const mapping = await QuickBooksCustomerMapping.findOneAndUpdate(
      { portalCustomerId },
      { quickbooksCustomerId, quickbooksCustomerDisplayName },
      { upsert: true, new: true }
    );

    console.log('[QuickBooks] Customer mapped:', {
      portalCustomerId: mapping.portalCustomerId,
      quickbooksCustomerId: mapping.quickbooksCustomerId,
      displayName: mapping.quickbooksCustomerDisplayName
    });

    res.json({ mapping });
  } catch (err) {
    console.error('[QuickBooks /map-customer] Error:', err.message);
    console.error('[QuickBooks /map-customer] Stack:', err.stack);
    
    // Handle duplicate key error
    if (err.code === 11000) {
      return res.status(400).json({ 
        error: 'This customer is already mapped to a QuickBooks customer.' 
      });
    }
    
    res.status(500).json({ error: 'Failed to map customer' });
  }
});

// GET /api/quickbooks/mapped-customers
router.get('/mapped-customers', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const mappings = await QuickBooksCustomerMapping.find().populate('portalCustomerId', 'name email');
    console.log(`[QuickBooks] Found ${mappings.length} mappings`);
    res.json({ mappings });
  } catch (err) {
    console.error('[QuickBooks /mapped-customers] Error:', err.message);
    res.status(500).json({ error: 'Failed to load mapped customers' });
  }
});

// DELETE /api/quickbooks/map-customer/:mappingId
// Remove a customer mapping
router.delete('/map-customer/:mappingId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { mappingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(mappingId)) {
      return res.status(400).json({ error: 'Invalid mapping ID format' });
    }

    const mapping = await QuickBooksCustomerMapping.findByIdAndDelete(mappingId);

    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    console.log(`[QuickBooks] Deleted mapping: ${mappingId}`);
    res.json({ message: 'Mapping removed successfully' });
  } catch (err) {
    console.error('[QuickBooks /map-customer/:id] Error:', err.message);
    res.status(500).json({ error: 'Failed to remove mapping' });
  }
});

// GET /api/quickbooks/customer/:portalCustomerId/invoices
router.get('/customer/:portalCustomerId/invoices', authenticateToken, authorizeRole(['customer', 'admin']), async (req, res) => {
  try {
    const { portalCustomerId } = req.params;

    console.log(`[QuickBooks] Fetching invoices for portal customer: ${portalCustomerId}`);
    console.log(`[QuickBooks] Request user ID: ${req.user.id}, Role: ${req.user.role}`);
    console.log(`[QuickBooks] Request user ID type: ${typeof req.user.id}, PortalCustomerId type: ${typeof portalCustomerId}`);

    // For customers, ensure they can only see their own invoices
    // Compare both as strings to handle ObjectId vs string comparison
    const userId = String(req.user.id);
    const customerId = String(portalCustomerId);
    
    if (req.user.role === 'customer' && userId !== customerId) {
      console.log(`[QuickBooks] Access denied: Customer ${userId} trying to access ${customerId}`);
      console.log(`[QuickBooks] User IDs don't match: ${userId} !== ${customerId}`);
      return res.status(403).json({ error: 'You can only view your own invoices' });
    }
    
    console.log(`[QuickBooks] Access granted: User ${userId} accessing ${customerId}`);

    // Try to find mapping - portalCustomerId might be ObjectId or string
    // First, try direct lookup (works if it's already an ObjectId)
    let mapping = await QuickBooksCustomerMapping.findOne({ portalCustomerId }).populate('portalCustomerId', 'name email');
    
    // If not found, try converting string to ObjectId
    if (!mapping && mongoose.Types.ObjectId.isValid(portalCustomerId)) {
      console.log(`[QuickBooks] Trying ObjectId conversion for: ${portalCustomerId}`);
      try {
        const objectId = new mongoose.Types.ObjectId(portalCustomerId);
        mapping = await QuickBooksCustomerMapping.findOne({ portalCustomerId: objectId }).populate('portalCustomerId', 'name email');
      } catch (objIdErr) {
        console.error('[QuickBooks] Error converting to ObjectId:', objIdErr);
      }
    }
    
    // If still not found, try searching by string comparison (fallback)
    if (!mapping) {
      console.log(`[QuickBooks] Trying string comparison for: ${portalCustomerId}`);
      // Try all mappings and check if any match as string
      const allMappings = await QuickBooksCustomerMapping.find().populate('portalCustomerId', 'name email');
      mapping = allMappings.find(m => String(m.portalCustomerId?._id || m.portalCustomerId) === String(portalCustomerId));
    }

    if (!mapping) {
      console.log(`[QuickBooks] No mapping found for portal customer: ${portalCustomerId}`);
      return res.status(404).json({ error: 'No QuickBooks customer mapped for this portal customer.' });
    }

    console.log(`[QuickBooks] Found mapping: ${mapping.quickbooksCustomerId} for portal customer: ${portalCustomerId}`);
    console.log(`[QuickBooks] Mapping details:`, {
      quickbooksCustomerId: mapping.quickbooksCustomerId,
      quickbooksCustomerDisplayName: mapping.quickbooksCustomerDisplayName,
      quickbooksCustomerName: mapping.quickbooksCustomerName
    });

    const owner = await getQuickBooksConnectionOwner();
    if (!owner.quickbooksAccessToken || !owner.quickbooksRealmId) {
      return res.status(400).json({ error: 'QuickBooks is not connected.' });
    }

    const accessToken = await getValidAccessToken();

    console.log(`[QuickBooks] Fetching invoices for QuickBooks customer: ${mapping.quickbooksCustomerId}`);

    const invoices = await QuickBooksService.getNormalizedInvoicesForCustomer({
      accessToken,
      realmId: owner.quickbooksRealmId,
      quickbooksCustomerId: mapping.quickbooksCustomerId,
      maxResults: 100,
    });

    console.log(`[QuickBooks] Found ${invoices.length} invoices for customer ${mapping.quickbooksCustomerId}`);
    
    // Validate invoices before sending
    const validInvoices = invoices.filter((inv) => {
      const isValid = inv && inv.id;
      if (!isValid) {
        console.warn('[QuickBooks] Filtering out invalid invoice:', inv);
      }
      return isValid;
    });

    console.log(`[QuickBooks] Sending ${validInvoices.length} valid invoices to frontend`);
    
    if (validInvoices.length > 0) {
      console.log(`[QuickBooks] First invoice sample:`, {
        id: validInvoices[0].id,
        docNumber: validInvoices[0].docNumber,
        status: validInvoices[0].status,
        totalAmount: validInvoices[0].totalAmount,
        balance: validInvoices[0].balance,
        currency: validInvoices[0].currencyRef?.value,
        hasInvoiceLink: !!validInvoices[0].invoiceLink,
        invoiceLink: validInvoices[0].invoiceLink ? 'Present' : 'Not available (online payments may not be enabled)'
      });
    }

    // Get QuickBooks customer name from mapping
    let quickbooksCustomerName = mapping.quickbooksCustomerDisplayName || mapping.quickbooksCustomerName || null;
    console.log(`[QuickBooks] Initial customer name from mapping: ${quickbooksCustomerName}`);
    
    // Always try to fetch customer name from QuickBooks API to ensure we have the latest name
    // This ensures the name is always displayed correctly even if mapping was created without it
    if (mapping.quickbooksCustomerId) {
      try {
        console.log(`[QuickBooks] Fetching customer name from QuickBooks API for customer: ${mapping.quickbooksCustomerId}`);
        const query = `SELECT DisplayName, CompanyName FROM Customer WHERE Id = '${mapping.quickbooksCustomerId}'`;
        const customerData = await QuickBooksService.runQuery({
          accessToken,
          realmId: owner.quickbooksRealmId,
          query,
          minorversion: 65
        });
        
        const customer = customerData?.QueryResponse?.Customer;
        if (customer) {
          const customerObj = Array.isArray(customer) ? customer[0] : customer;
          const fetchedName = customerObj?.DisplayName || customerObj?.CompanyName || null;
          
          if (fetchedName) {
            quickbooksCustomerName = fetchedName;
            console.log(`[QuickBooks] ✅ Fetched customer name from QuickBooks: ${quickbooksCustomerName}`);
            
            // Update mapping with the customer name for future use (if different)
            if (mapping.quickbooksCustomerDisplayName !== fetchedName) {
              mapping.quickbooksCustomerDisplayName = fetchedName;
              await mapping.save().catch(err => {
                console.error('[QuickBooks] Failed to update mapping with customer name:', err);
              });
              console.log(`[QuickBooks] Updated mapping with customer name: ${fetchedName}`);
            }
          } else {
            console.log(`[QuickBooks] ⚠️ Customer found in QuickBooks but no DisplayName or CompanyName`);
          }
        } else {
          console.log(`[QuickBooks] ⚠️ Customer not found in QuickBooks API for ID: ${mapping.quickbooksCustomerId}`);
        }
      } catch (err) {
        console.error('[QuickBooks] ❌ Failed to fetch customer name from QuickBooks API:', err.message);
        // Continue with name from mapping if available
      }
    }

    console.log(`[QuickBooks] Final customer name to send to frontend: ${quickbooksCustomerName}`);

    res.json({ 
      invoices: validInvoices,
      quickbooksCustomerName: quickbooksCustomerName
    });
  } catch (err) {
    console.error('[QuickBooks /customer/:id/invoices] Error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch invoices from QuickBooks' });
  }
});

// GET /api/quickbooks/invoices
// query: ?startPosition=1&maxResults=100
router.get('/invoices', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const owner = await getQuickBooksConnectionOwner();

    if (!owner.quickbooksAccessToken || !owner.quickbooksRealmId) {
      return res.status(400).json({ error: 'QuickBooks is not connected.' });
    }

    const accessToken = await getValidAccessToken();
    const startPosition = Number(req.query.startPosition || 1);
    const maxResults = Number(req.query.maxResults || 100);

    const result = await QuickBooksService.getAllInvoices({
      accessToken,
      realmId: owner.quickbooksRealmId,
      startPosition,
      maxResults,
    });

    const normalized = result.items.map((inv) => QuickBooksService.normalizeInvoice(inv));

    res.json({
      invoices: normalized,
      totalCount: result.totalCount,
      startPosition: result.startPosition,
      maxResults: result.maxResults,
    });
  } catch (err) {
    console.error('[QuickBooks /invoices] Error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch invoices from QuickBooks' });
  }
});

/**
 * GET /api/quickbooks/invoice/:invoiceId/pdf
 * Download invoice as PDF (for receipts)
 * Customers can only download their own invoices
 */
router.get('/invoice/:invoiceId/pdf', authenticateToken, authorizeRole(['customer', 'admin']), async (req, res) => {
  try {
    const { invoiceId } = req.params;

    // For customers, verify they can only access their own invoices
    if (req.user.role === 'customer') {
      const userId = String(req.user.id);
      
      // Find mapping for this customer
      let mapping = await QuickBooksCustomerMapping.findOne({ portalCustomerId: userId });
      
      if (!mapping && mongoose.Types.ObjectId.isValid(userId)) {
        mapping = await QuickBooksCustomerMapping.findOne({ 
          portalCustomerId: new mongoose.Types.ObjectId(userId) 
        });
      }

      if (!mapping) {
        return res.status(404).json({ error: 'No QuickBooks customer mapped for this portal customer.' });
      }

      // Verify the invoice belongs to this customer by fetching it
      const owner = await getQuickBooksConnectionOwner();
      if (!owner.quickbooksAccessToken || !owner.quickbooksRealmId) {
        return res.status(400).json({ error: 'QuickBooks is not connected.' });
      }

      const accessToken = await getValidAccessToken();

      // Fetch the invoice to verify it belongs to the mapped customer
      const invoices = await QuickBooksService.getInvoicesForCustomer({
        accessToken,
        realmId: owner.quickbooksRealmId,
        quickbooksCustomerId: mapping.quickbooksCustomerId,
        maxResults: 1000, // Get all to find the specific invoice
      });

      const invoice = invoices.find(inv => String(inv.Id) === String(invoiceId));
      if (!invoice) {
        return res.status(403).json({ error: 'You can only download invoices for your own account.' });
      }
    }

    // Get QuickBooks connection
    const owner = await getQuickBooksConnectionOwner();
    if (!owner.quickbooksAccessToken || !owner.quickbooksRealmId) {
      return res.status(400).json({ error: 'QuickBooks is not connected.' });
    }

    const accessToken = await getValidAccessToken();

    // Call QuickBooks PDF endpoint
    // Use production base URL (always production)
    const baseUrl = 'https://quickbooks.api.intuit.com';
    const pdfUrl = `${baseUrl}/v3/company/${owner.quickbooksRealmId}/invoice/${invoiceId}/pdf`;
    
    console.log(`[QuickBooks] Fetching PDF for invoice: ${invoiceId}`);

    const response = await axios.get(pdfUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/pdf',
      },
      responseType: 'stream', // Stream the PDF
    });

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoiceId}.pdf"`);

    // Pipe the PDF stream to the response
    response.data.pipe(res);
  } catch (err) {
    console.error('[QuickBooks /invoice/:id/pdf] Error:', err.response?.data || err.message);
    
    if (err.response?.status === 404) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    res.status(500).json({ error: 'Failed to download invoice PDF' });
  }
});

module.exports = router;
