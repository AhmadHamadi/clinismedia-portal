# Google Business Profile – Production Connection Review

## Logic changes made (why it only worked on localhost)

Two code changes were made so production can connect Google Business the same way as localhost:

### 1. CORS (backend/server.js)

**Issue:** CORS was set to `origin: process.env.FRONTEND_URL`. If **FRONTEND_URL** is not set on Railway, `origin` is `undefined`. The browser then blocks cross-origin responses from `https://api.clinimediaportal.ca` when the page is on `https://www.clinimediaportal.ca`, so the “Connect” request (and any API call) can fail.

**Change:** CORS now allows multiple origins: `FRONTEND_URL` (if set), `https://www.clinimediaportal.ca`, and common localhost URLs. So production works even when **FRONTEND_URL** is unset, and localhost still works.

### 2. Post-OAuth redirect URL (backend/routes/googleBusiness.js – getFrontendUrl)

**Issue:** After Google redirects to your backend callback, the backend redirects the user to the **frontend** (e.g. `https://www.clinimediaportal.ca/admin/google-business?admin_oauth_success=...`). That URL comes from `getFrontendUrl(req)`. On Railway, `req.headers.host` can be the internal host (e.g. `*.railway.app`), not `api.clinimediaportal.ca`, so the code might not detect “production” and could redirect to the wrong place.

**Change:** If **GOOGLE_BUSINESS_REDIRECT_URI** is set and contains `api.clinimediaportal.ca` (or `clinimediaportal.ca`), we treat the backend as production and always use `https://www.clinimediaportal.ca` as the frontend URL for the redirect. So after OAuth on production, the user is always sent back to the production frontend.

---

## Your understanding (confirmed)

You observed:

- On **production** (www.clinimediaportal.ca), when you tried to connect or use Google Business, you sometimes saw **“Failed to fetch business”**.
- This went away **as soon as the backend was running**.
- You usually connect the Google Business account from **localhost** and want to do the same flow from **production**, with tokens saved on the **production backend** (which is always running).

That understanding is correct. The code is already set up so that:

1. **Whoever receives the “Connect” request** (auth/admin) is the backend that builds the OAuth URL and its `redirect_uri`.
2. **Google redirects the browser** to that `redirect_uri` (your **backend** callback URL).
3. The **backend** that handles the callback saves tokens to **its own database** and then redirects the user back to the frontend.

So:

- If the **production frontend** calls the **production backend** for `/google-business/auth/admin` and for the callback, then tokens are saved on the **production backend** and everything works for production.
- “Failed to fetch business” when the backend “wasn’t running” means the frontend was calling a backend that was down (e.g. production frontend → production backend, but backend was down; or a wrong URL so the request never reached the right server).

Below is a concise review of the relevant code and what to set for production.

---

## 1. Flow (every line that matters)

### 1.1 Admin clicks “Connect” (frontend)

**File:** `frontend/src/components/Admin/GoogleBusinessManagement/GoogleBusinessManagementPage.tsx`

- `handleConnectGoogleBusiness` calls:
  - `GET ${VITE_API_BASE_URL}/google-business/auth/admin`
- Backend returns `{ authUrl }`.
- Frontend does **`window.location.href = response.data.authUrl`** → user is sent to **Google** (no frontend callback URL here; the callback URL is the **backend** URL).

So the **backend** that serves `VITE_API_BASE_URL` is the one that will later receive the OAuth callback. For production, `VITE_API_BASE_URL` must point to the **production API** (e.g. `https://api.clinimediaportal.ca/api`).

### 1.2 Backend builds OAuth URL and redirect_uri

**File:** `backend/routes/googleBusiness.js`

- **`GET /api/google-business/auth/admin`** (around 369–410):
  - Uses **`getGoogleBusinessRedirectUri(req)`** to choose the callback URL.
  - Builds `authUrl` with that `redirect_uri` and returns it to the frontend.

**`getGoogleBusinessRedirectUri(req)`** (248–302):

- If **`GOOGLE_BUSINESS_REDIRECT_URI`** is set → uses it (best for production).
- Else uses **`req.headers.host`** (and protocol):
  - If host is localhost → `http://localhost:<port>/api/google-business/callback`.
  - If host contains `clinimediaportal.ca` / `api.clinimediaportal.ca` → `https://api.clinimediaportal.ca/api/google-business/callback`.
  - Else Railway / BACKEND_URL / NODE_ENV fallbacks.

So when the **production** backend handles `/auth/admin`, `req.headers.host` should be your production API host (e.g. `api.clinimediaportal.ca`), and the redirect URI will be the production callback. For certainty behind proxies, set **`GOOGLE_BUSINESS_REDIRECT_URI`** on the production server.

### 1.3 Google redirects browser to backend (callback)

- User authorizes on Google.
- Google redirects the **browser** to:
  - `redirect_uri` = **backend** URL, e.g. `https://api.clinimediaportal.ca/api/google-business/callback?code=...&state=admin`

So the **backend** that must be running and reachable at that URL is the **production** backend when you connect from production.

### 1.4 Backend callback: exchange code, save tokens, redirect to frontend

**File:** `backend/routes/googleBusiness.js`

- **`GET /api/google-business/callback`** (491–634):
  - Uses **`getFrontendUrl(req)`** for where to send the user after OAuth.
  - Exchanges `code` for tokens (using same `redirect_uri` via `getGoogleBusinessRedirectUri(req)`).
  - For `state === 'admin'`: saves tokens on **admin User** in the **database** (same DB as that backend).
  - Redirects browser to:
    - `frontendUrl + '/admin/google-business?admin_oauth_success=true&access_token=...&refresh_token=...&expires_in=...'`

**`getFrontendUrl(req)`** (updated):

- If **`FRONTEND_URL`** is set → uses it (best for production).
- Else if **`GOOGLE_BUSINESS_REDIRECT_URI`** contains `api.clinimediaportal.ca` or `clinimediaportal.ca` → `https://www.clinimediaportal.ca` (so Railway/internal host does not break the redirect).
- Else: if host is localhost → `http://localhost:5173`; if host contains `clinimediaportal.ca` → `https://www.clinimediaportal.ca`; else fallbacks.

So tokens are **always** saved on the backend that handles the callback (production backend when you use production). The “save on backend” part is correct; the only way it wouldn’t work is if that backend wasn’t running or wasn’t the one the frontend was talking to.

### 1.5 Frontend after redirect: read tokens from URL, fetch profiles

**File:** `frontend/src/components/Admin/GoogleBusinessManagement/GoogleBusinessManagementPage.tsx`

- On load, a `useEffect` reads `admin_oauth_success`, `access_token`, `refresh_token`, `expires_in` from the URL.
- Optionally calls **`POST .../google-business/save-admin-tokens`** (redundant with callback save).
- Calls **`fetchAllBusinessProfiles(tokens)`** → **`GET ${VITE_API_BASE_URL}/google-business/admin-business-profiles`**.

If **`VITE_API_BASE_URL`** in the **built** frontend is production, this request goes to the **production** backend, which already has the tokens in the DB. If at that moment the backend was down, you’d get “Failed to fetch business” (or a network error). So the logic is consistent with “backend wasn’t running”.

### 1.6 Customer side: “Failed to fetch business”

**File:** `frontend/src/components/Customer/GoogleBusinessAnalyticsPage.tsx`

- **`fetchGoogleBusinessData`**:
  - `GET ${VITE_API_BASE_URL}/customers/profile`
  - Then `GET ${VITE_API_BASE_URL}/google-business/business-insights/${customerId}`

Again, both go to **`VITE_API_BASE_URL`**. If that’s production and the production backend is down, you get failures. If the production backend is up and the admin has connected and assigned a profile from production, data is read from the production DB. No separate “local vs production” logic in the code – it’s “whatever backend the frontend is configured to call”.

---

## 2. Why it “only worked when you ran the backend”

- **Scenario A:** You use **production** frontend and production backend. Production backend was temporarily down → “Failed to fetch business”. When you started the (production) backend again, it worked. **No code change needed**; just ensure production backend is running and frontend is built with production API URL.
- **Scenario B:** Production **build** was made with **`VITE_API_BASE_URL=http://localhost:5000/api`** (from `.env`). Then from production (www.clinimediaportal.ca), the browser still calls **localhost** (user’s machine). So it only works when you run the backend **locally**. Fix: build production with a **production** `VITE_API_BASE_URL` (see below).

---

## 3. What to do for production

Production env is on **Railway**; no `.env.production` file needed.

### 3.1 Railway / production backend

On Railway (or wherever the backend runs), ensure:

- **`GOOGLE_BUSINESS_REDIRECT_URI`** = `https://api.clinimediaportal.ca/api/google-business/callback` (or your real production API callback URL; must match Google Cloud).
- **`FRONTEND_URL`** = `https://www.clinimediaportal.ca` (so after OAuth the user is sent to the production frontend).

Optional but helpful so redirect/frontend URL don’t depend on `Host` behind a proxy.

### 3.2 Frontend build (if you build on Railway or CI)

When you build the frontend for production, ensure **`VITE_API_BASE_URL`** is set to your production API base (e.g. `https://api.clinimediaportal.ca/api`) at **build time** so the built app calls the production backend, not localhost. On Railway this is usually done via project env vars for the build step.

### 3.3 Google Cloud Console

- In your OAuth 2.0 Client (Google Business API):
  - Add **Authorized redirect URI**:  
    **`https://api.clinimediaportal.ca/api/google-business/callback`**  
  (same as `GOOGLE_BUSINESS_REDIRECT_URI`).
- Keep localhost if you still test locally:  
  `http://localhost:5000/api/google-business/callback` (or whatever port you use).

---

## 4. Summary

| What you said | Verdict |
|---------------|--------|
| “When I login on production it sometimes didn’t show on customer side” | Customer data comes from the backend. If the backend was down or the frontend was calling the wrong backend (e.g. localhost), it would fail. |
| “Failed to fetch business because the backend wasn’t running” | Correct: all Google Business API calls go to `VITE_API_BASE_URL`; if that backend is down, you get that kind of failure. |
| “We need to connect on production so it saves on the backend since the backend is always running there” | The code **already** saves tokens on the backend that handles the callback. To “connect on production” you must: (1) production build uses production backend URL (`VITE_API_BASE_URL` set at build time, e.g. on Railway), (2) production backend env set (e.g. `GOOGLE_BUSINESS_REDIRECT_URI`, `FRONTEND_URL` on Railway), (3) add production redirect URI in Google Cloud. |
| “I always connect using localhost but want to do it with production” | Once the production build uses production `VITE_API_BASE_URL` and production redirect URI is in Google Cloud, you can open **production** frontend, click Connect, complete OAuth; the callback will hit production backend and save tokens there. |

No change to the **logic** of “where tokens are saved” is required; they are always saved on the backend that serves the callback. The fixes are **configuration**: production build API URL, production backend env, and Google Cloud redirect URI.
