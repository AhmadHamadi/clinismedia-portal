# QuickBooks Setup - Complete Explanation for ChatGPT

## 🎯 Current Setup Overview

### Server Architecture
- **Backend**: Node.js/Express server running on Railway
- **Domain**: `api.clinimediaportal.ca` (backend API)
- **Frontend**: React app (separate deployment, likely on `www.clinimediaportal.ca`)
- **Database**: MongoDB

### Route Mounting (server.js)

**Line 100**: `app.use('/api/quickbooks', quickbooksRoutes);`

**Route Order** (lines 80-103):
```javascript
app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
// ... other API routes ...
app.use('/api/quickbooks', quickbooksRoutes);  // ← Line 100
app.use('/uploads/instagram-insights', express.static(...));
app.use('/uploads/invoices', express.static(...));
app.use('/uploads/customer-logos', express.static(...));

// Root route (line 106)
app.get("/", (req, res) => {
  res.send("CliniMedia Portal API is running.");
});
```

**✅ NO CATCH-ALL ROUTE**: There is no `app.use('*', ...)` or `app.get('*', ...)` that would intercept `/api/quickbooks/callback`

**✅ Route Priority**: API routes are mounted BEFORE static file serving and root route, so `/api/quickbooks/callback` will be handled by the Express route handler

### QuickBooks Callback Route

**File**: `backend/routes/quickbooks.js`
**Route**: `router.get('/callback', ...)` (line 298)
**Full Path**: `/api/quickbooks/callback`

**Route Definition**:
```javascript
router.get('/callback', async (req, res) => {
  // Extensive logging (lines 321-331)
  console.log('[QuickBooks Callback] 📥 OAUTH CALLBACK RECEIVED');
  console.log('[QuickBooks Callback]   Request host:', req.headers.host);
  console.log('[QuickBooks Callback]   Request URL:', req.url);
  console.log('[QuickBooks Callback]   Query params:', req.query);
  
  // Handles OAuth callback from Intuit
  // Exchanges code for tokens
  // Saves tokens to user
  // Redirects to frontend
});
```

**✅ Route Exists**: The callback route is properly defined and exported

### Redirect URI Configuration

**File**: `backend/services/quickbooksService.js`

**Priority Order** (lines 30-53):
1. `QUICKBOOKS_REDIRECT_URI` env var (if set) - Highest priority
2. `RAILWAY_PUBLIC_DOMAIN` → `https://${RAILWAY_PUBLIC_DOMAIN}/api/quickbooks/callback`
3. `BACKEND_URL` → `${BACKEND_URL}/api/quickbooks/callback`
4. **Production fallback** → `https://api.clinimediaportal.ca/api/quickbooks/callback` (line 49)

**Current Redirect URI**: `https://api.clinimediaportal.ca/api/quickbooks/callback`

**Logging**: On server startup, logs show:
```
[QuickBooksService] ✅ Redirect URI: https://api.clinimediaportal.ca/api/quickbooks/callback
```

### Enhanced Logging Added

**In `getAuthorizationUrl()`** (lines 108-117):
- Logs the exact redirect URI being used
- Warns that it must match Intuit Portal exactly
- Shows full authorization URL

**In `exchangeCodeForTokens()`** (lines 126-134):
- Logs redirect URI used in token exchange
- Warns it must match authorization URL
- Shows detailed error responses

**In Callback Route** (lines 321-331):
- Logs request host, URL, query params
- Logs redirect URI from service
- Logs state verification steps
- Logs token exchange process

## 🔍 Mystery #1: Why Server Returns HTML?

### Possible Causes

**A) Reverse Proxy / Load Balancer Issue**
- Railway or hosting provider might have a reverse proxy
- If frontend and backend share the same domain, a reverse proxy might route `/api/*` to backend but other routes to frontend
- **Check**: Railway deployment settings, any nginx/apache config

**B) Frontend Routing Intercepting**
- If frontend is served from same domain as backend
- React Router might be catching all routes before they reach backend
- **Check**: Frontend deployment configuration

**C) Railway Static File Serving**
- Railway might be serving static files (frontend) before Express routes
- **Check**: Railway build/deploy settings

**D) Route Not Reaching Express**
- The route exists, but something is intercepting before Express
- **Check**: Server logs when callback is hit

### How to Verify

**Test 1: Direct API Call**
```bash
curl -v https://api.clinimediaportal.ca/api/quickbooks/callback?code=test&state=test
```

**Expected**: Should hit Express route and return redirect or error (not HTML)

**If HTML returned**: Something is intercepting before Express

**Test 2: Check Server Logs**
When Intuit redirects to callback, check Railway logs:
- Should see: `[QuickBooks Callback] 📥 OAUTH CALLBACK RECEIVED`
- If not seen: Route not reaching Express

**Test 3: Check Route Registration**
Add this to `server.js` after line 100:
```javascript
app.use('/api/quickbooks', quickbooksRoutes);

// DEBUG: Verify route is registered
app.get('/api/quickbooks/test', (req, res) => {
  res.json({ message: 'QuickBooks route is working', timestamp: new Date() });
});
```

Then test: `curl https://api.clinimediaportal.ca/api/quickbooks/test`
- Should return JSON, not HTML

## 📋 What We Know For Sure

### ✅ Redirect URI Matches
- Intuit Portal has: `https://api.clinimediaportal.ca/api/quickbooks/callback`
- Code uses: `https://api.clinimediaportal.ca/api/quickbooks/callback`
- **These match exactly** ✅

### ✅ Route Exists
- Route is defined: `router.get('/callback', ...)`
- Route is mounted: `app.use('/api/quickbooks', quickbooksRoutes)`
- Route is before any catch-all handlers

### ✅ Server Responds
- `curl` to callback URL returns 200 OK
- SSL certificate is valid
- Server is accessible from internet

### ✅ Enhanced Logging
- All critical steps have detailed logging
- Redirect URI is logged on startup
- Callback route logs all request details

## ❓ What We Need to Verify

### 1. Intuit Portal Environment
- **Question**: Is the app in **Production** or **Development** environment?
- **Check**: Intuit Developer Portal → Keys & Credentials → Check which tab (Production/Development)
- **Important**: Production redirect URI must be in **Production** environment tab

### 2. Server Logs When Connecting
- **What to check**: When you click "Connect QuickBooks", what appears in Railway logs?
- **Look for**:
  - `[QuickBooksService] 🔵 GENERATING AUTHORIZATION URL`
  - `[QuickBooksService] ✅ Redirect URI: https://api.clinimediaportal.ca/api/quickbooks/callback`
  - When callback is hit: `[QuickBooks Callback] 📥 OAUTH CALLBACK RECEIVED`

### 3. Why HTML is Returned
- **If curl returns HTML**: Something is intercepting before Express
- **Possible causes**: Reverse proxy, frontend routing, Railway static serving
- **Solution**: Check Railway deployment settings, verify Express is handling the route

## 🔧 Recommended Next Steps

1. **Add Debug Route** (temporary):
   ```javascript
   // In server.js, after line 100
   app.get('/api/quickbooks/debug', (req, res) => {
     res.json({
       message: 'QuickBooks route is accessible',
       redirectUri: QuickBooksService.redirectUri,
       timestamp: new Date().toISOString()
     });
   });
   ```

2. **Test Debug Route**:
   ```bash
   curl https://api.clinimediaportal.ca/api/quickbooks/debug
   ```
   - If JSON returned: Routes work, issue is elsewhere
   - If HTML returned: Something intercepting before Express

3. **Check Railway Logs**:
   - When connecting QuickBooks, watch Railway logs in real-time
   - Look for the callback log message
   - If not appearing: Route not being hit

4. **Verify Intuit Portal**:
   - Go to Intuit Developer Portal
   - Keys & Credentials → **Production** tab
   - Verify redirect URI is exactly: `https://api.clinimediaportal.ca/api/quickbooks/callback`
   - No trailing slash, exact match

## 📝 Code Structure Summary

```
backend/
├── server.js (line 100: app.use('/api/quickbooks', quickbooksRoutes))
└── routes/
    └── quickbooks.js
        ├── router.get('/callback', ...) (line 298)
        └── Exports: module.exports = router

backend/services/
└── quickbooksService.js
    ├── Constructor sets redirectUri (line 49: 'https://api.clinimediaportal.ca')
    ├── getAuthorizationUrl() (line 89)
    └── exchangeCodeForTokens() (line 124)
```

**Route Flow**:
1. Request: `GET https://api.clinimediaportal.ca/api/quickbooks/callback?code=...&state=...`
2. Express matches: `app.use('/api/quickbooks', ...)` → `router.get('/callback', ...)`
3. Handler executes: Logs, exchanges code, saves tokens, redirects

**No catch-all route exists that would intercept this.**

