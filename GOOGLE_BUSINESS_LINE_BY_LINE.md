# Google Business – Line-by-Line Flow (Localhost vs Production)

This compares every step so production works like localhost. **100% aligned with the code.**

---

## 1. Where the flow is in the code

| Step | File | Lines (approx) |
|------|------|------------------|
| Redirect URI helper | `backend/routes/googleBusiness.js` | 248–302 |
| Frontend URL helper | `backend/routes/googleBusiness.js` | 474–519 |
| Auth/admin (start OAuth) | `backend/routes/googleBusiness.js` | 369–411 |
| Callback (receive code, save tokens) | `backend/routes/googleBusiness.js` | 521–686 |
| Frontend: Connect button | `frontend/.../GoogleBusinessManagementPage.tsx` | 97–118 |
| Frontend: Read callback params | `frontend/.../GoogleBusinessManagementPage.tsx` | 264–324 |
| CORS | `backend/server.js` | 52–70 |

---

## 2. Step-by-step: what happens when you click “Connect”

### Step A – Frontend calls backend for auth URL

**Code:** `GoogleBusinessManagementPage.tsx` line 107

```ts
const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/google-business/auth/admin`, {
  headers: { Authorization: `Bearer ${token}` }
});
```

- **Localhost:** `VITE_API_BASE_URL` from `frontend/.env` is `http://localhost:5000/api` → request goes to **your local backend**. ✓  
- **Production:** Request goes to **whatever URL is in `VITE_API_BASE_URL` at build time**.  
  - If the **production** build was made with `VITE_API_BASE_URL=http://localhost:5000/api` (e.g. from your current `frontend/.env`), the production site still calls **localhost** → production backend is never hit. ✗  
  - So for production you must build with `VITE_API_BASE_URL=https://api.clinimediaportal.ca/api`.

**Conclusion:** For production Connect to work, the **deployed** frontend must be built with production API URL. Your repo’s `frontend/.env` has `VITE_API_BASE_URL=http://localhost:5000/api`; that is correct for **local** only. Production build (e.g. on Railway or CI) must set `VITE_API_BASE_URL=https://api.clinimediaportal.ca/api`.

---

### Step B – Backend builds redirect_uri and returns authUrl

**Code:** `googleBusiness.js` lines 383, 391–396

```js
const redirectUri = getGoogleBusinessRedirectUri(req);
// ...
const authUrl = requestOAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  state: 'admin',
  prompt: 'consent',
  redirect_uri: redirectUri
});
```

**`getGoogleBusinessRedirectUri(req)` (lines 248–302):**

1. If **`GOOGLE_BUSINESS_REDIRECT_URI`** is set → use it (no `req` needed).  
2. Else use **request**: `host = req.headers.host || req.headers['x-forwarded-host']`.  
   - If `host` has `localhost` or `127.0.0.1` → `http://localhost:${port}/api/google-business/callback`.  
   - If `host` has `clinimediaportal.ca` or `api.clinimediaportal.ca` → `https://api.clinimediaportal.ca/api/google-business/callback`.  
   - Else if **`RAILWAY_PUBLIC_DOMAIN`** set → `https://${RAILWAY_PUBLIC_DOMAIN}/api/google-business/callback`.  
   - Else → `https://api.clinimediaportal.ca/api/google-business/callback` (production fallback).

- **Localhost:** `req.headers.host` = `localhost:5000` → redirect_uri = `http://localhost:5000/api/google-business/callback`. ✓ Matches your .env and Google Cloud.  
- **Production (e.g. Railway):** Often `req.headers.host` = internal host (e.g. `xxx.railway.app`). Then without env, redirect_uri could be `https://xxx.railway.app/api/google-business/callback`, which is **not** in Google Cloud → Google returns error and flow fails.  
- **Fix:** On **production backend** set **`GOOGLE_BUSINESS_REDIRECT_URI=https://api.clinimediaportal.ca/api/google-business/callback`**. Then step 1 always uses that and production redirect_uri matches Google Cloud.

**Conclusion:** Backend code is correct. For production you **must** set `GOOGLE_BUSINESS_REDIRECT_URI` on the production server so the auth URL always contains `https://api.clinimediaportal.ca/api/google-business/callback`.

---

### Step C – User is sent to Google; Google redirects to your backend

**Code:** Frontend line 111: `window.location.href = response.data.authUrl` → user goes to Google.  
Google then redirects the **browser** to the **redirect_uri** that was in that auth URL (with `?code=...&state=admin`). So the **backend** that receives the callback is the one whose URL was in `redirect_uri`.

- **Localhost:** redirect_uri = `http://localhost:5000/api/google-business/callback` → callback hits **local** backend. ✓  
- **Production:** redirect_uri must be `https://api.clinimediaportal.ca/api/google-business/callback` → callback hits **production** backend. That only happens if Step B used that value (hence `GOOGLE_BUSINESS_REDIRECT_URI` on production).

**Google Cloud:** The exact callback URL must be in **Authorized redirect URIs**. You already have:
- `http://localhost:5000/api/google-business/callback`
- `https://api.clinimediaportal.ca/api/google-business/callback`  
So no code change; config is correct.

**Authorized JavaScript origins:** When the user clicks Connect on **https://www.clinimediaportal.ca**, that origin must be allowed. So in Google Cloud, **Authorized JavaScript origins** must include **`https://www.clinimediaportal.ca`**. Code expects production frontend at `https://www.clinimediaportal.ca` (see `getFrontendUrl` and CORS). Adding this origin does not conflict with any code.

---

### Step D – Backend callback: exchange code, save tokens, redirect to frontend

**Code:** `googleBusiness.js` lines 522–646

- Line 524: `const frontendUrl = getFrontendUrl(req);`  
- Line 540: `const redirectUri = getGoogleBusinessRedirectUri(req);` (must match the redirect_uri used in Step B for token exchange to succeed)  
- Lines 559–561: Exchange `code` for tokens with that `redirectUri`.  
- Lines 612–631: For `state === 'admin'`, save tokens to admin User in DB.  
- Line 646: `res.redirect(`${frontendUrl}/admin/google-business?admin_oauth_success=true&access_token=...&refresh_token=...&expires_in=...`)`

**`getFrontendUrl(req)` (lines 474–519):**

1. If **`FRONTEND_URL`** set → use it.  
2. Else if **`GOOGLE_BUSINESS_REDIRECT_URI`** contains `api.clinimediaportal.ca` or `clinimediaportal.ca` → return **`https://www.clinimediaportal.ca`**.  
3. Else use **request** host (localhost → `http://localhost:5173`, clinimediaportal.ca → `https://www.clinimediaportal.ca`).  
4. Else NODE_ENV fallback, then `https://www.clinimediaportal.ca`.

- **Localhost:** `FRONTEND_URL=http://localhost:5173` in .env → user redirected to `http://localhost:5173/admin/google-business?admin_oauth_success=...`. ✓  
- **Production:** If production backend has **`FRONTEND_URL=https://www.clinimediaportal.ca`** or **`GOOGLE_BUSINESS_REDIRECT_URI`** set with `api.clinimediaportal.ca`, then `frontendUrl` = `https://www.clinimediaportal.ca` → user redirected to production frontend. ✓  

So the code is correct. On production backend you need either `FRONTEND_URL` or `GOOGLE_BUSINESS_REDIRECT_URI` (with clinimediaportal.ca) so the redirect goes to www.

---

### Step E – Frontend reads URL params and fetches profiles

**Code:** `GoogleBusinessManagementPage.tsx` lines 264–324 (useEffect), then fetch profiles via `VITE_API_BASE_URL`.

- Frontend expects to land on something like `.../admin/google-business?admin_oauth_success=true&access_token=...&refresh_token=...&expires_in=...`.
- Backend sends exactly that (line 646).
- All later API calls (e.g. save-admin-tokens, admin-business-profiles) use **`VITE_API_BASE_URL`** again. So if the user landed on **production** frontend, that frontend must still call **production** API (same as Step A).

No extra code change; just same requirement: production build must use `VITE_API_BASE_URL=https://api.clinimediaportal.ca/api`.

---

### Step F – CORS

**Code:** `server.js` lines 53–67. Allowed origins include `https://www.clinimediaportal.ca`, `http://localhost:5173`, and `*.clinimediaportal.ca`. So requests from production frontend (www) to production API are allowed. No change needed.

---

## 3. Why localhost works and production doesn’t (with current setup)

| Item | Localhost | Production (before fix) |
|------|-----------|--------------------------|
| Frontend opens | http://localhost:5173 | https://www.clinimediaportal.ca |
| VITE_API_BASE_URL (in built app) | http://localhost:5000/api | If build used local .env → still localhost → **wrong** |
| First request (auth/admin) | Goes to local backend ✓ | Can go to localhost if build is wrong ✗ |
| req.headers.host (auth/admin) | localhost:5000 ✓ | On Railway often xxx.railway.app |
| redirect_uri sent to Google | http://localhost:5000/... ✓ | Can be https://xxx.railway.app/... ✗ (not in Google Cloud) |
| Google Cloud redirect URIs | localhost listed ✓ | api.clinimediaportal.ca listed ✓ but backend might send railway URL ✗ |
| Google Cloud JavaScript origins | Sometimes not checked for server-side redirect | www missing → can cause issues ✗ |
| Callback hits | Local backend ✓ | Must hit api.clinimediaportal.ca; only if redirect_uri was correct |
| Tokens saved in | Local DB ✓ | Production DB only if callback hit production backend |
| FRONTEND_URL / getFrontendUrl | .env FRONTEND_URL=http://localhost:5173 ✓ | Need FRONTEND_URL or GOOGLE_BUSINESS_REDIRECT_URI on production |

So: **code is correct.** The gap is **configuration**: production backend env vars, production build API URL, and Google Cloud origins.

---

## 4. Checklist so production matches the code (no errors)

Do all of the following; the code already supports them.

1. **Google Cloud (same OAuth client as GOOGLE_BUSINESS_CLIENT_ID)**  
   - **Authorized redirect URIs:** Keep `https://api.clinimediaportal.ca/api/google-business/callback` (you have it).  
   - **Authorized JavaScript origins:** Add **`https://www.clinimediaportal.ca`** (and optionally `http://localhost:5173` for local).  
   Save and wait a few minutes if needed.

2. **Production backend (e.g. Railway)**  
   Set:  
   - **`GOOGLE_BUSINESS_REDIRECT_URI`** = `https://api.clinimediaportal.ca/api/google-business/callback`  
   - **`FRONTEND_URL`** = `https://www.clinimediaportal.ca`  
   Redeploy if needed.

3. **Production frontend build**  
   When building the app that is deployed to **www.clinimediaportal.ca**, set at **build time**:  
   - **`VITE_API_BASE_URL`** = `https://api.clinimediaportal.ca/api`  
   So the built JS uses production API for `/google-business/auth/admin` and all other calls. Do **not** use `frontend/.env`’s local value for the production build.

4. **Local .env**  
   Keep `frontend/.env` and `backend/.env` as they are for local (localhost URLs). They are not used by production.

After this, connecting Google Business on **https://www.clinimediaportal.ca** will use the same logic as localhost, and tokens will be stored on the production backend so it keeps working when local backend is stopped.
