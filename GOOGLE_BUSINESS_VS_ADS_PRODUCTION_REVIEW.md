# Google Business vs Google Ads – Localhost vs Production (Full Review)

This document compares **Google Business Profile** and **Google Ads** connection flows on **localhost** vs **production**, explains why Google Ads works from production while Google Business has only worked when connecting from localhost, and covers **QR code / review campaigns** (no Google OAuth).

---

## 1. Summary: Why Google Ads Works in Production and Google Business Doesn’t (Until Fixed)

| Aspect | Google Ads | Google Business |
|--------|------------|-----------------|
| **Redirect URI** | Same pattern: env → host → fallbacks. **If production uses `GOOGLE_ADS_REDIRECT_URI` or Host is correct**, callback URL matches Google Cloud. | Same pattern. **On Railway, `req.headers.host` can be internal (e.g. `*.railway.app`)**. If `GOOGLE_BUSINESS_REDIRECT_URI` is **not** set, backend may send a redirect_uri that is **not** in Google Cloud → OAuth fails or only works when you hit localhost (where host is correct). |
| **Post-OAuth frontend URL** | `getFrontendUrl(req)` uses `FRONTEND_URL` then host. If Host is wrong on Railway, redirect could go to wrong place. | **Has explicit production fix:** if `GOOGLE_BUSINESS_REDIRECT_URI` contains `api.clinimediaportal.ca` or `clinimediaportal.ca`, frontend URL is forced to `https://www.clinimediaportal.ca` so redirect always lands on production frontend. |
| **Where tokens are saved** | Backend that serves the callback (production backend when you connect from production frontend). | Same. |
| **CORS** | Same server CORS: allows `FRONTEND_URL`, `https://www.clinimediaportal.ca`, localhost. | Same. |

**Root cause for “Google Business only works from localhost”:**

1. **Redirect URI mismatch on production**  
   When you open **production** frontend and click “Connect” for Google Business:
   - Frontend calls **production backend** `GET /api/google-business/auth/admin`.
   - Backend builds `redirect_uri` with `getGoogleBusinessRedirectUri(req)`.
   - On Railway, `req.headers.host` is often the **internal** host (e.g. `your-app.up.railway.app`), not `api.clinimediaportal.ca`.
   - So backend may send `redirect_uri = https://your-app.up.railway.app/api/google-business/callback`.
   - That URL is **not** in your Google Cloud “Authorized redirect URIs” for the **Google Business** OAuth client.
   - Google then rejects the callback with `redirect_uri_mismatch` or similar, so the flow only works when the request hits a backend where Host is correct (e.g. localhost or a proxy that sets Host to `api.clinimediaportal.ca`).

2. **Google Ads** may work in production because:
   - You have **`GOOGLE_ADS_REDIRECT_URI`** set on production to `https://api.clinimediaportal.ca/api/google-ads/callback`, **or**
   - Your proxy/Railway is forwarding **Host** (or `x-forwarded-host`) as `api.clinimediaportal.ca` for those requests, so the redirect URI matches what’s in Google Cloud for the **Google Ads** OAuth client.

So: **Google Business needs the same “guaranteed production redirect + frontend URL” treatment** that you may already have for Google Ads via env or proxy. The code already has a **frontend URL** fix for Google Business; the **redirect URI** must be fixed with env on production.

---

## 2. Code Paths (Where It All Happens)

### 2.1 Backend: Redirect URI

- **Google Ads:** `backend/routes/googleAds.js`  
  - `getGoogleAdsRedirectUri(req)`  
  - Priority: `GOOGLE_ADS_REDIRECT_URI` → host (localhost / clinimediaportal.ca / Railway) → fallbacks.  
  - Used in `GET /api/google-ads/auth/admin` and `GET /api/google-ads/callback`.

- **Google Business:** `backend/routes/googleBusiness.js`  
  - `getGoogleBusinessRedirectUri(req)`  
  - Same idea: `GOOGLE_BUSINESS_REDIRECT_URI` → host → fallbacks.  
  - Used in `GET /api/google-business/auth/admin`, `GET /api/google-business/auth/customer-connect`, `GET /api/google-business/auth/:clinicId`, and `GET /api/google-business/callback`.

If Host is wrong on production, **both** need their **REDIRECT_URI** env var set to the public API callback URL so the value sent to Google matches Google Cloud.

### 2.2 Backend: Post-OAuth Frontend URL (Where the User Is Sent After Login)

- **Google Ads:** `backend/routes/googleAds.js` – `getFrontendUrl(req)`  
  - Priority: `FRONTEND_URL` → host (localhost / clinimediaportal.ca / Railway) → NODE_ENV → `https://www.clinimediaportal.ca`.  
  - **Does not** use “if redirect URI contains production domain → force production frontend”.

- **Google Business:** `backend/routes/googleBusiness.js` – `getFrontendUrl(req)`  
  - Priority: `FRONTEND_URL` → **if `GOOGLE_BUSINESS_REDIRECT_URI` contains `api.clinimediaportal.ca` or `clinimediaportal.ca` → `https://www.clinimediaportal.ca`** → host → NODE_ENV → `https://www.clinimediaportal.ca`.  
  - So even when Railway sends an internal Host, production OAuth still redirects the user to the **production** frontend.

So: Google Business is **safer** on Railway for the **post-OAuth redirect**. Google Ads can be aligned with the same logic (see “Recommendations” below).

### 2.3 Frontend: Who Is Called?

- **Admin “Connect” (both):**  
  - Google Ads: `GET ${VITE_API_BASE_URL}/google-ads/auth/admin` → then `window.location.href = response.data.authUrl`.  
  - Google Business: `GET ${VITE_API_BASE_URL}/google-business/auth/admin` → then `window.location.href = response.data.authUrl`.  
  - So the **backend** that serves `VITE_API_BASE_URL` is the one that will receive the OAuth callback and save tokens.  
  - For production: **production build** must have `VITE_API_BASE_URL` pointing to production API (e.g. `https://api.clinimediaportal.ca/api`). If the build uses `http://localhost:5000/api`, then from production **frontend** the browser still calls **localhost**; connecting from production would only work if your local backend is running and you’re “using production UI but local backend.”

### 2.4 OAuth Callback (Backend)

- **Google Ads:** `GET /api/google-ads/callback`  
  - Exchanges `code` with `getGoogleAdsRedirectUri(req)`, saves tokens to admin User, redirects to `getFrontendUrl(req) + '/admin/google-ads?success=true'`.

- **Google Business:** `GET /api/google-business/callback`  
  - Exchanges `code` with `getGoogleBusinessRedirectUri(req)`, saves tokens (admin or customer), redirects to `getFrontendUrl(req) + '/admin/google-business?admin_oauth_success=...'` or customer path.

Token storage is always on the **backend that handles the callback**. So if production frontend calls production backend for auth and callback, tokens live on production DB.

---

## 3. QR Code / Review Campaigns (No Google Business OAuth)

- **Routes:** `backend/routes/qrReviews.js` (e.g. `/api/qr-reviews/...`).  
- **Models:** `ReviewCampaign`, `ReviewSession`, `ReviewGeneration`, `ConcernSubmission`, `ReviewEvent`.  
- **Flow:** Campaigns store a **`googleReviewUrl`** (plain string). QR codes and public review flow use this URL; they do **not** use Google Business Profile API or OAuth.  
- **Conclusion:** QR/review features do **not** depend on whether Google Business is connected from localhost or production. They only need the backend and the stored `googleReviewUrl`.

---

## 4. Customer-Side Google Business (Analytics + Self-Connect)

- **Page:** `frontend/src/components/Customer/GoogleBusinessAnalyticsPage.tsx`  
  - Fetches profile: `GET ${VITE_API_BASE_URL}/customers/profile`.  
  - Fetches insights: `GET ${VITE_API_BASE_URL}/google-business/business-insights/${customerId}`.  
  - Customer self-connect: `GET ${VITE_API_BASE_URL}/google-business/auth/customer-connect` → redirect to Google → callback goes to **backend** (same redirect URI logic as admin).  
- All calls use **`VITE_API_BASE_URL`**. So again: production build must use production API URL; otherwise you get “failed to fetch” when backend is not the one the frontend is calling.

---

## 5. What You Must Set for Production (Checklist)

### 5.1 Production backend (e.g. Railway)

| Variable | Value | Purpose |
|---------|--------|--------|
| `GOOGLE_BUSINESS_REDIRECT_URI` | `https://api.clinimediaportal.ca/api/google-business/callback` | So redirect_uri sent to Google always matches Google Cloud, regardless of Host. |
| `GOOGLE_ADS_REDIRECT_URI`      | `https://api.clinimediaportal.ca/api/google-ads/callback`      | Same for Google Ads if Host is wrong. |
| `FRONTEND_URL`                 | `https://www.clinimediaportal.ca`                               | Post-OAuth redirect and CORS. |

(Other env vars: `GOOGLE_BUSINESS_CLIENT_ID`, `GOOGLE_BUSINESS_CLIENT_SECRET`, `GOOGLE_ADS_*`, etc., as already used.)

### 5.2 Production frontend build

- At **build time**, set **`VITE_API_BASE_URL`** to your production API base, e.g. `https://api.clinimediaportal.ca/api`.  
- If you build with `.env` that has `VITE_API_BASE_URL=http://localhost:5000/api`, the built app will only talk to localhost; then “connecting from production” still uses the backend that that build points to (localhost when you’re on your machine).

### 5.3 Google Cloud Console

- **Google Business Profile OAuth client:**  
  - Authorized redirect URI: `https://api.clinimediaportal.ca/api/google-business/callback` (and optionally `http://localhost:5000/api/google-business/callback` for local).  
- **Google Ads OAuth client:**  
  - Authorized redirect URI: `https://api.clinimediaportal.ca/api/google-ads/callback` (and optionally localhost for local).  

Both must match exactly what the backend sends (including path and no trailing slash if you don’t use one).

---

## 6. Comparison Table (Quick Reference)

| Item | Google Ads | Google Business |
|------|------------|-----------------|
| Auth route | `GET /api/google-ads/auth/admin` | `GET /api/google-business/auth/admin` |
| Callback route | `GET /api/google-ads/callback` | `GET /api/google-business/callback` |
| Redirect URI env | `GOOGLE_ADS_REDIRECT_URI` | `GOOGLE_BUSINESS_REDIRECT_URI` |
| Frontend URL env | `FRONTEND_URL` | `FRONTEND_URL` |
| “Production” frontend fix | Yes (same as GBP: if redirect URI contains clinimediaportal.ca → www) | Yes (if redirect URI contains clinimediaportal.ca → www) |
| Token storage | Admin User (DB) | Admin or Customer User (DB) |
| Customer insights | N/A (admin assigns account) | `GET /api/google-business/business-insights/:customerId` |
| QR / review campaigns | Not used | Not used (only `googleReviewUrl` string) |

---

## 7. Recommendations

1. **Set on production backend:**  
   - `GOOGLE_BUSINESS_REDIRECT_URI=https://api.clinimediaportal.ca/api/google-business/callback`  
   - `FRONTEND_URL=https://www.clinimediaportal.ca`  
   - Optionally `GOOGLE_ADS_REDIRECT_URI=https://api.clinimediaportal.ca/api/google-ads/callback` if you don’t already have it or if Host is wrong.

2. **Ensure production frontend build** uses `VITE_API_BASE_URL=https://api.clinimediaportal.ca/api` (or your real production API base).

3. **Google Cloud:** Add the production callback URLs above to the correct OAuth 2.0 clients (Business Profile and Ads).

4. **Optional – align Google Ads with Google Business:** In `backend/routes/googleAds.js`, in `getFrontendUrl(req)`, add the same “production redirect URI → production frontend” branch as in Google Business (e.g. if `GOOGLE_ADS_REDIRECT_URI` contains `api.clinimediaportal.ca` or `clinimediaportal.ca`, return `https://www.clinimediaportal.ca`). That way both integrations behave the same behind Railway/proxies. **Done:** this logic has been added to `googleAds.js` so both integrations now use the same production frontend detection when their redirect URI env is set.

After this, connecting **Google Business** from **production** (www.clinimediaportal.ca) should work the same as connecting from localhost: tokens will be saved on the production backend and used for admin and customer Google Business features. QR/review flows are unchanged and independent of where you connect Google Business.
