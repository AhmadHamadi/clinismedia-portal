# Fix: Connect Google Business from Production (Like Google Ads)

**Problem:** Google Ads works when you connect on production. Google Business only works when you connect from localhost, and when you stop your local backend, Google Business stops working.

**Goal:** Connect Google Business from production so tokens are saved on the production backend and it keeps working without running localhost.

---

## What You Need to Do (3 steps)

### Step 1: Google Cloud Console (OAuth client for Google Business)

1. Open [Google Cloud Console](https://console.cloud.google.com/) → project **Clinimedia-analytics** (or the one with "CliniMedia Web Client").
2. Go to **APIs & Services** → **Credentials** → open **CliniMedia Web Client** (the client whose ID matches `GOOGLE_BUSINESS_CLIENT_ID` in your .env).
3. **Authorized redirect URIs** – you already have:
   - `http://localhost:5000/api/google-business/callback`
   - `https://api.clinimediaportal.ca/api/google-business/callback`
   So redirect URIs are fine. (You can remove `https://clinimediaportal.ca/api/google-business/callback` if your API is only at `api.clinimediaportal.ca`.)
4. **Authorized JavaScript origins** – add these if they are not there (required when the user clicks "Connect" from your frontend):
   - `https://www.clinimediaportal.ca` (production frontend)
   - `http://localhost:5173` (local frontend)
   Right now only `https://api.clinimediaportal.ca` may be listed; add the two above so Google allows the flow when the user is on www or localhost.
5. Save. Note: "It may take 5 minutes to a few hours for settings to take effect."

---

### Step 2: Set environment variables on production backend (Railway)

In your **production** backend (e.g. Railway project that runs api.clinimediaportal.ca), set:

| Variable | Value |
|----------|--------|
| `GOOGLE_BUSINESS_REDIRECT_URI` | `https://api.clinimediaportal.ca/api/google-business/callback` |
| `FRONTEND_URL` | `https://www.clinimediaportal.ca` |

This makes the backend use the correct callback URL when you connect from production (so it matches Google Cloud) and send you back to the production site after login.

Your **local** `.env` correctly has `GOOGLE_BUSINESS_REDIRECT_URI=http://localhost:5000/api/google-business/callback` and `FRONTEND_URL=http://localhost:5173` – keep that for local dev. The values above are for the **production** backend (e.g. Railway) only. Redeploy the backend after changing env vars if needed.

---

### Step 3: Make sure production frontend calls production API

Your production site (www.clinimediaportal.ca) must call the **production** API when you click “Connect”:

- When you **build** the frontend for production, `VITE_API_BASE_URL` must be set to your production API base, e.g.:
  ```text
  VITE_API_BASE_URL=https://api.clinimediaportal.ca/api
  ```
- If you build with something like `VITE_API_BASE_URL=http://localhost:5000/api`, then the production site will try to call your local machine and Google Business will only work when your local backend is running.

**How to set it for build (examples):**

- **Railway:** In the frontend service, add an env var `VITE_API_BASE_URL=https://api.clinimediaportal.ca/api` and run the build there so the built app uses it.
- **Local build then deploy:** Run build with:
  ```bash
  VITE_API_BASE_URL=https://api.clinimediaportal.ca/api npm run build
  ```
  then deploy the `dist` folder.

---

## After You Do This

1. Open **production**: https://www.clinimediaportal.ca  
2. Log in as admin → go to Google Business management.  
3. Click **Connect** (or “Connect Google Business”).  
4. Complete the Google sign-in.  
5. You should be redirected back to production and see your business profiles. Tokens are now saved on the **production** backend.  
6. You can stop your local backend; Google Business will keep working on production.

---

## Quick check

- **Google Ads works on production** because either your production backend already has `GOOGLE_ADS_REDIRECT_URI` set (or the request host is correct) and the production redirect URI is in Google Cloud.  
- **Google Business** needs the same: production redirect URI in Google Cloud + `GOOGLE_BUSINESS_REDIRECT_URI` (and `FRONTEND_URL`) on production backend + production frontend built with production `VITE_API_BASE_URL`. Once those are in place, connecting Google Business on production will work like Google Ads.
