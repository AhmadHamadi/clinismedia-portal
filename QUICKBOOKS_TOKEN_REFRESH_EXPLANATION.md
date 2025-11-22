# QuickBooks Token Refresh System - Complete Explanation

## Overview
The QuickBooks integration uses a fully automatic token refresh system that ensures users never need to manually reconnect. Tokens are refreshed proactively 30 minutes before expiry, and the system runs every 30 seconds to check for tokens that need refreshing.

## Token Lifecycle

### Initial Connection
1. User clicks "Connect QuickBooks" → `/api/quickbooks/connect`
2. User authorizes in Intuit portal → redirected to `/api/quickbooks/callback`
3. Backend exchanges authorization code for tokens:
   - `access_token` (expires in 1 hour)
   - `refresh_token` (expires in ~101 days)
4. Tokens saved to user document in MongoDB

### Token Expiry
- **Access Token**: Expires in 1 hour (3600 seconds)
- **Refresh Token**: Expires in ~101 days (8,726,400 seconds)
- **Refresh Token Rotation**: QuickBooks rotates refresh tokens every ~24 hours

## Automatic Refresh System

### Background Service (`quickbooksTokenRefreshService.js`)

**How It Works:**
1. Service starts automatically when server boots (in `server.js`)
2. Runs every 30 seconds to check all connected users
3. For each user with `quickbooksConnected = true`:
   - Checks if token expires within 30 minutes
   - If yes, automatically refreshes the token
   - Saves new tokens (including new refresh_token)

**Key Features:**
- **Proactive**: Refreshes 30 minutes BEFORE expiry (not after)
- **Frequent Checks**: Runs every 30 seconds to catch tokens immediately
- **Automatic**: No manual intervention required
- **Error Handling**: Only disconnects on permanent OAuth errors (invalid_grant, etc.)

**Code Flow:**
```javascript
// Service runs every 30 seconds
setInterval(() => {
  refreshAllTokens(); // Checks all connected users
}, 30000);

// For each user:
if (tokenExpiresWithin30Minutes) {
  const newTokens = await QuickBooksService.refreshAccessToken(oldRefreshToken);
  await saveTokensForUser(user, newTokens);
}
```

### On-Demand Refresh (`getValidAccessToken()` in `quickbooks.js`)

**When Used:**
- Before making any QuickBooks API call (invoices, customers, etc.)
- Checks if token is expired or expiring within 5 minutes
- If yes, refreshes immediately before the API call

**Code Flow:**
```javascript
async function getValidAccessToken() {
  const owner = await getQuickBooksConnectionOwner();
  
  // Check if token expires within 5 minutes
  if (tokenExpiresSoon) {
    const refreshed = await QuickBooksService.refreshAccessToken(refreshToken);
    await saveTokensForUser(owner, refreshed);
    return refreshed.access_token;
  }
  
  return owner.quickbooksAccessToken; // Still valid
}
```

### Auto-Retry on 401 Errors (`quickbooksApiCall()` in `quickbooks.js`)

**When Used:**
- If any QuickBooks API call returns 401 Unauthorized
- Automatically refreshes token and retries the call once
- Prevents failures due to expired tokens

**Code Flow:**
```javascript
async function quickbooksApiCall(apiCallFn) {
  try {
    return await apiCallFn();
  } catch (error) {
    if (error.response?.status === 401) {
      // Token expired - refresh and retry
      const refreshed = await QuickBooksService.refreshAccessToken(refreshToken);
      await saveTokensForUser(owner, refreshed);
      return await apiCallFn(); // Retry with new token
    }
    throw error;
  }
}
```

## Files Involved

### 1. `backend/services/quickbooksTokenRefreshService.js`
- **Purpose**: Background service that runs every 30 seconds
- **Key Function**: `refreshAllTokens()` - checks and refreshes all connected users
- **Started From**: `server.js` on server startup
- **Key Feature**: Proactive refresh 30 minutes before expiry

### 2. `backend/services/quickbooksService.js`
- **Purpose**: Makes actual API calls to Intuit
- **Key Function**: `refreshAccessToken(refreshToken)` - calls Intuit API to get new tokens
- **Returns**: `{ access_token, refresh_token, expires_in, x_refresh_token_expires_in }` (snake_case)
- **Critical**: Always returns new refresh_token (QuickBooks rotates these)

### 3. `backend/routes/quickbooks.js`
- **Purpose**: API routes and helper functions
- **Key Functions**:
  - `saveTokensForUser(user, tokens, realmId)` - Centralized token saving (handles both camelCase and snake_case)
  - `getValidAccessToken()` - Gets valid token, refreshes if needed
  - `quickbooksApiCall(apiCallFn)` - Auto-retry on 401 errors
- **Routes**:
  - `GET /api/quickbooks/refresh` - Manual refresh endpoint (admin only)
  - `GET /api/quickbooks/token-refresh-status` - Status endpoint

### 4. `backend/server.js`
- **Purpose**: Server startup
- **Key Code**: Starts `QuickBooksTokenRefreshService.start()` on server boot
- **Location**: Lines 157-168

### 5. `backend/models/User.js`
- **Purpose**: User model with token storage
- **Fields**:
  - `quickbooksAccessToken` (String)
  - `quickbooksRefreshToken` (String)
  - `quickbooksTokenExpiry` (Date) - When access token expires
  - `quickbooksRefreshTokenExpiry` (Date) - When refresh token expires
  - `quickbooksConnected` (Boolean) - Connection status

## Token Format Handling

### Critical Fix Applied
The system now handles **BOTH** camelCase and snake_case formats:

**QuickBooks API Returns (snake_case):**
```javascript
{
  access_token: "...",
  refresh_token: "...",
  expires_in: 3600,
  x_refresh_token_expires_in: 8726400
}
```

**Service Returns (snake_case):**
```javascript
// quickbooksService.js refreshAccessToken()
return {
  access_token: response.data.access_token,
  refresh_token: response.data.refresh_token,
  expires_in: expiresIn,
  x_refresh_token_expires_in: ...
};
```

**saveTokensForUser() Handles Both:**
```javascript
// Supports both formats
const accessToken = tokens.access_token || tokens.accessToken;
const refreshToken = tokens.refresh_token || tokens.refreshToken;
const expiresIn = tokens.expires_in || tokens.expiresIn;
```

## Refresh Logic Details

### When Tokens Are Refreshed

1. **Background Service (Every 30 seconds):**
   - Checks: `tokenExpiry - now <= 30 minutes`
   - If true → refreshes immediately
   - Runs continuously in background

2. **On-Demand (Before API calls):**
   - Checks: `tokenExpiry - now <= 5 minutes`
   - If true → refreshes before making API call
   - Ensures API calls always use valid tokens

3. **Auto-Retry (On 401 errors):**
   - If API call returns 401 → refreshes and retries
   - Prevents failures due to race conditions

### Refresh Token Rotation

**Critical Behavior:**
- QuickBooks rotates refresh tokens every ~24 hours
- When you refresh, you get a NEW refresh_token
- The OLD refresh_token becomes invalid immediately
- **Solution**: Always save the new refresh_token from every refresh response

**Code Implementation:**
```javascript
// Always save new refresh_token (old one is now invalid)
if (refreshToken) {
  user.quickbooksRefreshToken = refreshToken; // MUST overwrite
}
```

## Error Handling

### Permanent OAuth Errors (Requires Reconnection)
- `invalid_grant` - Refresh token is invalid/expired
- `invalid_client` - Client credentials invalid
- `invalid_refresh_token` - Refresh token doesn't exist
- `refresh_token_expired` - Refresh token expired (after ~101 days)

**Response**: Sets `quickbooksConnected = false`, user must reconnect

### Temporary Errors (Retry Later)
- Network errors
- Rate limits
- MongoDB connection issues

**Response**: Logs error, keeps `quickbooksConnected = true`, retries on next cycle

## Why Users Never Need to Manually Reconnect

1. **Proactive Refresh**: Tokens refresh 30 minutes BEFORE expiry
2. **Frequent Checks**: Service runs every 30 seconds
3. **Multiple Safeguards**: Background service + on-demand + auto-retry
4. **Long Refresh Token Life**: Refresh tokens last ~101 days
5. **Automatic Rotation**: System handles refresh token rotation automatically

## Verification

**Check if it's working:**
1. Connect QuickBooks
2. Wait 35 minutes
3. Check Railway logs for:
   ```
   [QuickBooksTokenRefresh] 🔄 Refreshing token for user: ...
   [QuickBooksTokenRefresh] ✅ Tokens saved for ...
   [QuickBooksTokenRefresh]    Expires in 60 minutes
   ```

**Check MongoDB:**
```javascript
// User document should have:
quickbooksTokenExpiry: ISODate("2025-11-22T05:00:00.000Z") // 1 hour from now
quickbooksRefreshTokenExpiry: ISODate("2026-03-03T...") // ~101 days from now
quickbooksConnected: true
```

## Summary

The token refresh system is **fully automatic** and ensures:
- ✅ Tokens refresh 30 minutes before expiry
- ✅ Service runs every 30 seconds
- ✅ Multiple refresh mechanisms (background + on-demand + auto-retry)
- ✅ Handles refresh token rotation automatically
- ✅ Only disconnects on permanent OAuth errors
- ✅ Users never need to manually reconnect (unless refresh token expires after ~101 days)

The system is production-ready and requires zero manual intervention.

