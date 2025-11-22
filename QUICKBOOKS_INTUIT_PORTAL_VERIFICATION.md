# QuickBooks Intuit Portal Verification Guide

## 🔍 Critical Check: Redirect URI Must Match Exactly

### Step 1: Check What Redirect URI Your Code Is Using

**When you start your server, look for this log:**
```
[QuickBooksService] ✅ Redirect URI: https://api.clinimediaportal.ca/api/quickbooks/callback
```

**OR if using ngrok:**
```
[QuickBooksService] ✅ Redirect URI: https://your-ngrok-url.ngrok-free.dev/api/quickbooks/callback
```

### Step 2: Verify in Intuit Developer Portal

**Go to**: https://developer.intuit.com/app/developer/dashboard

1. **Select your app**
2. **Go to "Keys & Credentials" tab**
3. **Check which environment you're using:**
   - **Production** → Use for `https://api.clinimediaportal.ca/api/quickbooks/callback`
   - **Development** → Use for ngrok URLs like `https://xxx.ngrok-free.dev/api/quickbooks/callback`

4. **In the correct environment, check "Redirect URIs" section**
   - Must have EXACTLY: `https://api.clinimediaportal.ca/api/quickbooks/callback`
   - OR your ngrok URL: `https://xxx.ngrok-free.dev/api/quickbooks/callback`
   - **NO trailing slash**
   - **Exact match** (case-sensitive, protocol must be https)

### Step 3: Common Mismatches

❌ **WRONG**:
- `https://api.clinimediaportal.ca/api/quickbooks/callback/` (trailing slash)
- `http://api.clinimediaportal.ca/api/quickbooks/callback` (http instead of https)
- `https://www.clinimediaportal.ca/api/quickbooks/callback` (wrong subdomain - www. instead of api.)
- `https://app.clinimediaportal.ca/api/quickbooks/callback` (wrong subdomain)
- Missing `/api/quickbooks/callback` path

✅ **CORRECT**:
- `https://api.clinimediaportal.ca/api/quickbooks/callback` (exact match)

## 🔧 How Redirect URI Is Determined in Code

**Priority Order** (in `quickbooksService.js`):

1. **`QUICKBOOKS_REDIRECT_URI`** env var (if set) - Highest priority
2. **`RAILWAY_PUBLIC_DOMAIN`** → `https://${RAILWAY_PUBLIC_DOMAIN}/api/quickbooks/callback`
3. **`BACKEND_URL`** → `${BACKEND_URL}/api/quickbooks/callback`
4. **Production fallback** → `https://api.clinimediaportal.ca/api/quickbooks/callback`

**To see what's being used, check server startup logs.**

## 🧪 Testing Steps

1. **Start your server** and note the redirect URI from logs
2. **Go to Intuit Portal** → Keys & Credentials
3. **Verify redirect URI exists** in the correct environment (Production/Development)
4. **Try connecting** QuickBooks
5. **Check server logs** for the exact redirect URI being used
6. **Compare** with Intuit Portal - must match EXACTLY

## ⚠️ Important Notes

- **Production environment** in Intuit Portal = Use for production domain
- **Development environment** in Intuit Portal = Use for ngrok/localhost
- **The redirect URI in code MUST match the redirect URI in Intuit Portal**
- **Both authorization URL and token exchange use the SAME redirect URI**

