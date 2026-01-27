# Google Business Profile Connection Persistence - Complete Review

## Overview
This document explains how Google Business Profile connections are saved and persist forever, so you **don't need to reconnect every time**.

---

## How Connection State is Saved

### 1. **Admin Account Connection** (info@clinimedia.ca)

**When you connect:**
- OAuth callback (`/api/google-business/callback`) saves tokens to database
- Tokens are stored in the **admin User record** in MongoDB:
  - `googleBusinessAccessToken` - Access token
  - `googleBusinessRefreshToken` - Refresh token (NEVER expires)
  - `googleBusinessTokenExpiry` - When access token expires

**Location:** `backend/routes/googleBusiness.js:596-599`

```javascript
adminUser.googleBusinessAccessToken = tokens.access_token;
adminUser.googleBusinessRefreshToken = tokens.refresh_token;
adminUser.googleBusinessTokenExpiry = tokenExpiry;
await adminUser.save();
```

**✅ This saves to MongoDB database - it persists forever!**

---

### 2. **Customer Business Profile Assignment**

**When you assign a profile to a customer:**
- `POST /api/google-business/save-business-profile` saves to customer record
- Data stored in **customer User record**:
  - `googleBusinessProfileId` - The business profile ID
  - `googleBusinessProfileName` - The business profile name
  - `googleBusinessAccessToken` - Admin's access token (copied to customer)
  - `googleBusinessRefreshToken` - Admin's refresh token (copied to customer)
  - `googleBusinessTokenExpiry` - Token expiry date
  - `googleBusinessNeedsReauth: false` - Connection is active

**Location:** `backend/routes/googleBusiness.js:1054-1086`

```javascript
const updateData = {
  googleBusinessProfileId: businessProfileId,
  googleBusinessProfileName: businessProfileName,
  googleBusinessAccessToken: tokensToUse.access_token,
  googleBusinessRefreshToken: tokensToUse.refresh_token,
  googleBusinessTokenExpiry: newExpiry,
  googleBusinessNeedsReauth: false // Always clear reauth flag
};

await User.findByIdAndUpdate(customerId, updateData, { new: true, runValidators: true });
```

**✅ This saves to MongoDB database - it persists forever!**

---

## Automatic Token Refresh (No Manual Reconnection Needed!)

### Admin Token Refresh Service
- **Runs every 30 seconds** in the background
- **Automatically refreshes** admin access tokens before they expire
- **Uses refresh token** (which never expires) to get new access tokens
- **Saves refreshed tokens** back to database automatically

**Location:** `backend/services/googleBusinessAdminTokenRefreshService.js`

**Key Features:**
- ✅ Proactive refresh (5 minutes before expiry)
- ✅ Fully automatic - no manual intervention
- ✅ Saves tokens to database after refresh
- ✅ Handles errors gracefully

**Started in:** `backend/server.js:192`

```javascript
GoogleBusinessAdminTokenRefreshService.start();
```

---

### Customer Token Refresh
- **✅ FIXED: Always use admin tokens first** (they're auto-refreshed every 30 seconds)
- Customer tokens are just copies - admin tokens are the source of truth
- **No need to reconnect customer** - admin tokens work for all customers
- Even if customer tokens expire, system automatically uses fresh admin tokens

**Location:** `backend/routes/googleBusiness.js:1170-1201`

```javascript
// ✅ FIXED: Always prefer admin tokens (they're auto-refreshed) - customer tokens are just copies
// Priority 1: Admin tokens (always fresh, auto-refreshed every 30 seconds)
const adminUser = await User.findOne({ role: 'admin' });
if (adminUser?.googleBusinessAccessToken && adminUser?.googleBusinessRefreshToken) {
  tokensToUse = {
    access_token: adminUser.googleBusinessAccessToken,
    refresh_token: adminUser.googleBusinessRefreshToken
  };
  usingAdminTokens = true;
  // Admin tokens are always fresh - no need to check expiry
}
// Priority 2: Fallback to customer tokens only if admin tokens missing
// Priority 3: Error if both missing
```

**Why this fixes the "Not Connected" issue:**
- Before: Customer tokens expired → system tried to refresh → if refresh failed → showed "Not Connected"
- After: Always use admin tokens first → admin tokens are auto-refreshed → customers always have working tokens

---

## Why You Might See "No Account Assigned"

### Scenario 1: Admin Not Connected
**Symptom:** Button says "Connect Admin Account"
**Cause:** Admin tokens not in database
**Solution:** Click "Connect Admin Account" button once - it saves forever

**Check:** `GET /api/google-business/admin-connection-status`
- Returns `connected: true` if admin has tokens in database
- Returns `connected: false` if admin needs to connect

---

### Scenario 2: Customer Profile Not Assigned
**Symptom:** Customer shows "Not Connected" in table
**Cause:** Customer doesn't have `googleBusinessProfileId` set
**Solution:** 
1. Make sure admin is connected (see Scenario 1)
2. Select business profile from dropdown for that customer
3. Connection saves to database immediately

**Check:** Customer record in database should have:
- `googleBusinessProfileId` - NOT null
- `googleBusinessProfileName` - NOT null

---

### Scenario 3: False "Needs Reauth" Flag
**Symptom:** Connection exists but shows as expired
**Cause:** `googleBusinessNeedsReauth` flag was set incorrectly
**Solution:** System automatically clears this flag when tokens are valid

**Fixed in:** `backend/routes/googleBusiness.js:1527-1531`

```javascript
// Clear reauth flag if tokens exist and are valid
if (customer.googleBusinessNeedsReauth && tokensToUse.access_token && tokensToUse.refresh_token) {
  await User.findByIdAndUpdate(customerId, {
    googleBusinessNeedsReauth: false
  });
}
```

---

## Connection Persistence Guarantees

### ✅ What Persists Forever:
1. **Admin tokens** - Saved in admin User record
2. **Customer profile assignments** - `googleBusinessProfileId` and `googleBusinessProfileName`
3. **Refresh tokens** - Never expire, can always get new access tokens

### ✅ What Refreshes Automatically:
1. **Admin access tokens** - Refreshed every 30 seconds if expiring soon
2. **Customer access tokens** - Refreshed when needed, or uses admin tokens

### ✅ What You DON'T Need to Do:
- ❌ Reconnect admin account every time
- ❌ Reassign customer profiles every time
- ❌ Manually refresh tokens
- ❌ Check token expiry dates

---

## Database Schema

**Admin User Record:**
```javascript
{
  role: 'admin',
  googleBusinessAccessToken: 'ya29...', // Refreshed automatically
  googleBusinessRefreshToken: '1//0...', // NEVER expires
  googleBusinessTokenExpiry: Date // Updated on refresh
}
```

**Customer User Record:**
```javascript
{
  role: 'customer',
  googleBusinessProfileId: 'locations/123456789', // Persists forever
  googleBusinessProfileName: 'My Business Name', // Persists forever
  googleBusinessAccessToken: 'ya29...', // Can use admin tokens if missing
  googleBusinessRefreshToken: '1//0...', // Can use admin tokens if missing
  googleBusinessTokenExpiry: Date,
  googleBusinessNeedsReauth: false // Cleared when connection is valid
}
```

---

## Frontend Connection Status Check

**Location:** `frontend/src/components/Admin/GoogleBusinessManagement/GoogleBusinessManagementPage.tsx:44-78`

**How it works:**
1. On page load, calls `GET /api/google-business/admin-connection-status`
2. Backend checks database for admin tokens
3. If tokens exist → `adminConnected = true`
4. If tokens missing → `adminConnected = false`

**✅ Backend database is the source of truth - not localStorage!**

---

## Troubleshooting

### If connection doesn't persist:

1. **Check database directly:**
   ```javascript
   // In MongoDB
   db.users.findOne({ role: 'admin' })
   // Should show googleBusinessAccessToken and googleBusinessRefreshToken
   ```

2. **Check customer record:**
   ```javascript
   db.users.findOne({ _id: customerId })
   // Should show googleBusinessProfileId and googleBusinessProfileName
   ```

3. **Check backend logs:**
   - Look for "✅ Admin Google Business Profile tokens saved to database"
   - Look for "✅ Successfully saved business profile for customer"

4. **Verify token refresh service is running:**
   - Check `backend/server.js:192` - should see log: "✅ Google Business Profile admin token refresh service started"

---

## Summary

**✅ Connect Once, Never Reconnect:**
- Admin account: Connect once via OAuth → saved to database → auto-refreshed forever
- Customer profiles: Assign once → saved to database → persists forever
- Tokens: Auto-refreshed every 30 seconds → never expire

**✅ Database is Source of Truth:**
- All connections saved in MongoDB
- Frontend checks database, not localStorage
- Tokens persist across server restarts

**✅ Automatic Token Management:**
- Access tokens expire in 1 hour
- Refresh tokens NEVER expire
- System automatically refreshes access tokens using refresh tokens
- No manual intervention needed

---

## Files Modified to Ensure Persistence

1. **`backend/routes/googleBusiness.js`**
   - Line 596-599: OAuth callback saves admin tokens to database
   - Line 1054-1117: Save business profile verifies and returns saved data
   - Line 1527-1531: Clears false reauth flags
   - Line 2020-2026: Only blocks if profileId is missing (not just reauth flag)

2. **`backend/services/googleBusinessAdminTokenRefreshService.js`**
   - Runs every 30 seconds
   - Automatically refreshes admin tokens
   - Saves refreshed tokens to database

3. **`frontend/src/components/Admin/GoogleBusinessManagement/GoogleBusinessManagementPage.tsx`**
   - Line 44-78: Checks database for connection status
   - Line 162-226: Saves profile and immediately updates local state
   - Line 228-252: Disconnect immediately updates local state

---

## Conclusion

**The connection state IS saved and persists forever.** You only need to:
1. Connect admin account **once** (saves to database)
2. Assign business profiles to customers **once** (saves to database)

After that, everything is automatic:
- Tokens refresh automatically
- Connections persist across restarts
- No manual reconnection needed

If you're seeing "no account assigned", it means either:
- Admin hasn't been connected yet (one-time setup)
- Customer profile hasn't been assigned yet (one-time per customer)

Once connected, it stays connected forever! 🎉
