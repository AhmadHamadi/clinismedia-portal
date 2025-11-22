# QuickBooks Integration - Core Components

## OAuth Flow

### Step-by-Step Flow
1. **Admin clicks "Connect QuickBooks"** → Frontend calls `GET /api/quickbooks/connect`
2. **Backend generates OAuth URL** with state parameter (`userId:randomState`)
3. **Frontend redirects** to Intuit: `https://appcenter.intuit.com/connect/oauth2?...`
4. **User authorizes** in Intuit
5. **Intuit redirects to callback**: `https://api.clinimediaportal.ca/api/quickbooks/callback?code=...&realmId=...&state=...`
6. **Backend exchanges code for tokens** via `QuickBooksService.exchangeCodeForTokens()`
7. **Backend saves tokens** to user document (sets `quickbooksConnected = true`)
8. **Backend redirects to frontend**: `/admin/quickbooks?success=true`

### Redirect URI Configuration

**Priority Order** (in `quickbooksService.js`):
1. `QUICKBOOKS_REDIRECT_URI` (explicit env var - e.g., ngrok URL)
2. `RAILWAY_PUBLIC_DOMAIN` → `https://${RAILWAY_PUBLIC_DOMAIN}/api/quickbooks/callback`
3. `BACKEND_URL` → `${BACKEND_URL}/api/quickbooks/callback`
4. Production fallback → `https://api.clinimediaportal.ca/api/quickbooks/callback`

**Must match exactly in Intuit Developer Portal** (Production environment for production, Development for ngrok/localhost)

### Frontend URL Detection (in callback route)
```javascript
Priority:
1. FRONTEND_URL env var
2. ngrok detection (if BACKEND_URL contains 'ngrok' → localhost:5173)
3. NODE_ENV === 'development' → localhost:5173
4. Production fallback → https://www.clinimediaportal.ca
```

## Token Refresh Mechanism

### Background Service
**File**: `backend/services/quickbooksTokenRefreshService.js`

**How it works**:
- Runs **every 30 seconds** (very frequent)
- Checks all users with `quickbooksConnected = true` AND `quickbooksRefreshToken`
- Refreshes tokens **30 minutes before expiry** (proactive)
- Checks refresh token expiry (~101 days) - if expired, marks user disconnected

**Refresh Logic**:
```javascript
For each connected user:
  1. Check refresh token expiry (if expired → disconnect, skip)
  2. Check access token expiry
  3. If expired OR expiring within 30 minutes:
     - Call QuickBooksService.refreshAccessToken(refreshToken)
     - Save new tokens (CRITICAL: always save new refresh_token)
     - Log success
  4. If permanent OAuth error (invalid_grant, etc.) → disconnect
  5. If temporary error → log warning, retry next interval
```

**Token Expiry**:
- Access token: 1 hour (3600 seconds)
- Refresh token: ~101 days (8726400 seconds)
- Refresh tokens **rotate every ~24 hours** - must always save new refresh token

**Service Startup** (in `server.js`):
```javascript
QuickBooksTokenRefreshService.start();
// Runs immediately, then every 30 seconds
```

### On-Demand Refresh
When API calls are made, `getValidAccessToken()` helper:
- Checks if token expired or expiring within 5 minutes
- If yes, refreshes token before API call
- Returns valid access token

## Backend Components

### QuickBooksService (`backend/services/quickbooksService.js`)
**Key Methods**:
- `getAuthorizationUrl(state)`: Generates OAuth URL
- `exchangeCodeForTokens(code)`: Exchanges code for tokens
- `refreshAccessToken(refreshToken)`: Refreshes access token
- `getCustomers()`, `getInvoicesForCustomer()`: QuickBooks API queries

**Configuration**:
- Always uses **Production** environment
- Base URL: `https://quickbooks.api.intuit.com`
- OAuth endpoints: `https://appcenter.intuit.com/connect/oauth2` (auth), `https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer` (token)

### QuickBooks Routes (`backend/routes/quickbooks.js`)
**Key Endpoints**:
- `GET /api/quickbooks/connect` - Initiate OAuth (admin only)
- `GET /api/quickbooks/callback` - OAuth callback (no auth required)
- `GET /api/quickbooks/refresh` - Manual token refresh (admin only)
- `GET /api/quickbooks/token-refresh-status` - Get refresh service status (admin only)
- `GET /api/quickbooks/status` - Get connection status (admin/customer)
- `GET /api/quickbooks/customer/:id/invoices` - Get invoices for customer (admin/customer)

**Helper Functions**:
- `saveTokensForUser(user, tokens)`: Centralized token saving (ensures Date objects)
- `getValidAccessToken()`: Gets valid token (refreshes if needed)
- `isPermanentOAuthError(error)`: Detects permanent OAuth errors

**Critical**: In callback route, `user.quickbooksConnected = true` must be set **BEFORE** `saveTokensForUser()`

## Frontend Components

### Admin Page (`frontend/src/components/Admin/QuickBooksManagement/QuickBooksManagementPage.tsx`)
**Route**: `/admin/quickbooks`

**Features**:
- Connection status display
- "Connect QuickBooks" button → calls `/api/quickbooks/connect` → redirects to Intuit
- OAuth callback handling (checks URL params for `success` or `error`)
- Customer mapping UI
- Invoice viewing

**OAuth Callback Handling**:
```typescript
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('success') === 'true') {
    setSuccess('QuickBooks connected successfully!');
    loadStatus();
  }
  if (urlParams.get('error')) {
    setError(decodeURIComponent(urlParams.get('error')));
  }
}, []);
```

### Customer Page (`frontend/src/components/Customer/CustomerQuickBooksInvoicesPage.tsx`)
**Route**: `/customer/quickbooks-invoices`

**Features**:
- Fetches invoices via `GET /api/quickbooks/customer/:customerId/invoices`
- Auto-refreshes every 5 minutes
- Shows unpaid/paid invoices
- "Pay Invoice" button (uses InvoiceLink from QuickBooks)

## Routing

### Admin Routes
- **Path**: `/admin/quickbooks`
- **Component**: `QuickBooksManagementPage`
- **Sidebar**: "QuickBooks" in INTEGRATIONS section (`SidebarMenu.tsx`)
- **Auth**: Admin only

### Customer Routes
- **Path**: `/customer/quickbooks-invoices`
- **Component**: `CustomerQuickBooksInvoicesPage`
- **Sidebar**: "QuickBooks Invoices" in MAIN ACTIONS section (`CustomerSidebar.tsx`)
- **Auth**: Customer or Admin

## Database Schema

### User Model Fields
```javascript
quickbooksAccessToken: String (default: null)
quickbooksRefreshToken: String (default: null)
quickbooksRealmId: String (default: null) // Company ID
quickbooksTokenExpiry: Date (default: null) // CRITICAL: Must be Date object
quickbooksRefreshTokenExpiry: Date (default: null) // CRITICAL: Must be Date object
quickbooksConnected: Boolean (default: false)
quickbooksOAuthState: String (default: null) // Temporary OAuth state
```

**Critical**: Token expiry fields must be **Date objects**, not strings or numbers.

## Environment Variables

**Backend**:
- `QUICKBOOKS_CLIENT_ID` - OAuth client ID
- `QUICKBOOKS_CLIENT_SECRET` - OAuth client secret
- `QUICKBOOKS_REDIRECT_URI` - Optional (auto-constructed if not set)
- `BACKEND_URL` or `RAILWAY_PUBLIC_DOMAIN` - Used to construct redirect URI
- `FRONTEND_URL` - Used for callback redirect

**Frontend**:
- `VITE_API_BASE_URL` - Backend API URL

## Critical Implementation Details

1. **Token Expiry**: Must be Date objects (`new Date(Date.now() + expiresIn * 1000)`)
2. **Refresh Token Rotation**: Always save new refresh token (QuickBooks rotates every ~24 hours)
3. **Connection Status**: Set `quickbooksConnected = true` BEFORE saving tokens
4. **Redirect URI**: Must match exactly in code and Intuit Developer Portal
5. **Error Handling**: Permanent OAuth errors disconnect user, temporary errors retry
