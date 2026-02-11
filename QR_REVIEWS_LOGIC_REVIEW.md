# QR Reviews – Full Logic Review

This document reviews all logic for the QR code review campaign flow: models, backend routes, services, and frontend (admin, customer, public).

---

## 1. Overview

**Purpose:** Patients scan a QR code → land on a public page → choose “Great experience” or “I have a concern” → (Great path) pick highlights → generate a review draft → copy and open Google Review link; (Concern path) submit a concern; admin/customer see campaigns, stats, concerns, and QR image.

**No Google Business API:** The QR flow uses a **stored Google Review URL** per campaign (`googleReviewUrl`). It does not use Google Business Profile OAuth or the Business Profile API.

---

## 2. Data Models

| Model | File | Purpose |
|-------|------|--------|
| **ReviewCampaign** | `backend/models/ReviewCampaign.js` | One per clinic/customer. Fields: `customerId`, `slug` (unique, lowercase, used in URL), `clinicName`, `googleReviewUrl`, `isActive`, `experienceHighlights` (array of `{ label, category, sentences }`), `adminEmail`, `logoUrl`. Slug can be auto-generated from `clinicName` in pre-validate. |
| **ReviewSession** | `backend/models/ReviewSession.js` | One per patient scan/session. `campaignId`, `sessionToken` (unique, auto hex), `patientName`, `selectedHighlights`, `freeText` (max 120), `staffName` (max 60), `reviewLength` (short/medium), `pathSelected` (great/concern), `googleClicked`, `status` (started, review_generated, copied, concern_submitted, abandoned), `generationCount`. Indexes: campaignId+createdAt, ipAddress+createdAt. |
| **ReviewGeneration** | `backend/models/ReviewGeneration.js` | One per generated review text. `sessionId`, `campaignId`, `reviewText`, `sentenceBankDraft`, `aiPolished`, `wordCount`, `sentenceCount`, `generationNumber`, `wasRegenerated`. |
| **ConcernSubmission** | `backend/models/ConcernSubmission.js` | One per concern. `campaignId`, `sessionId` (optional), `patientName`, `patientContact`, `concernText`, `status` (new, reviewed, resolved), `reviewedBy`, `reviewedAt`. |
| **ReviewEvent** | `backend/models/ReviewEvent.js` | Analytics events. `campaignId`, `sessionId`, `eventType` (session_started, path_selected, review_generated, review_copied, google_clicked, concern_submitted), `metadata`. |

---

## 3. Backend API (`backend/routes/qrReviews.js`)

**Mount:** `app.use('/api/qr-reviews', qrReviewsRoutes)` in `server.js`.

**Rate limits (public):**
- `generateLimiter`: 10 req/min for generate/regenerate.
- `concernLimiter`: 5 req/min for concern submit.
- `publicLimiter`: 30 req/min for other public endpoints.

### 3.1 Admin (authenticateToken + authorizeRole(['admin']))

| Method | Path | Description |
|--------|------|-------------|
| GET | `/campaigns` | List all campaigns, populated with customer, plus stats (sessionCount, copiedCount, concernCount). |
| POST | `/campaigns` | Create campaign. Required body: `clinicName`, `googleReviewUrl`. Optional: `customerId`, `slug`, `isActive`, `experienceHighlights`, `adminEmail`, `logoUrl`. 400 if slug duplicate. |
| GET | `/campaigns/:id` | Get one campaign (populate customer). |
| PUT | `/campaigns/:id` | Update campaign (same fields as create). |
| DELETE | `/campaigns/:id` | Delete campaign and all related ReviewEvent, ReviewGeneration, ConcernSubmission, ReviewSession. |
| GET | `/campaigns/:id/stats` | Funnel stats: scans, pathGreat, pathConcern, reviewsGenerated, copyClicks, googleClicks, concernSubmissions, concernsNew, conversion rates (scanToGenerate, generateToCopy, copyToGoogle), recentSessions. Uses ReviewEvent first, falls back to session/counts. |
| GET | `/campaigns/:id/concerns` | List concerns for campaign, sorted by createdAt desc. |
| PUT | `/campaigns/:campaignId/concerns/:concernId` | Update concern status (new/reviewed/resolved), set reviewedBy, reviewedAt. |
| GET | `/campaigns/:id/qr-code` | Generate QR image. Query: `format` (png|svg), `size` (default 300). QR payload URL is **hardcoded**: `https://www.clinimediaportal.ca/r/${campaign.slug}`. Returns `{ qrCodeData, format, url }`. |

### 3.2 Customer (authenticateToken + authorizeRole(['customer']))

| Method | Path | Description |
|--------|------|-------------|
| GET | `/my-campaigns` | Campaigns where `customerId === req.user._id`, with same stats shape. |
| GET | `/my-campaigns/:id/stats` | Same funnel stats as admin, but campaign must belong to customer. |
| GET | `/my-campaigns/:id/concerns` | Concerns for that campaign; campaign must belong to customer. |

### 3.3 Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/public/:slug` | Get campaign by slug, `isActive: true`. Returns `clinicName`, `experienceHighlights` (label + category only), `isActive`, `logoUrl`. 404 if not found or inactive. |
| POST | `/public/:slug/session` | Create session. Body: `patientName`, `selectedHighlights`, `freeText`, `staffName`, `reviewLength`, `pathSelected`. Saves session, tracks `session_started` and optionally `path_selected`. Returns `sessionToken`, `sessionId`. |
| POST | `/public/:slug/generate` | Generate review. Body: `sessionToken`. Validates session and campaign, enforces `MAX_GENERATIONS` (6). Resolves selected highlight labels to full chips from campaign, calls `generateReview()` from service, saves ReviewGeneration, increments session.generationCount, sets status `review_generated`, tracks `review_generated`. Returns `reviewText`, `aiPolished`, `generationNumber`, `remainingGenerations`. |
| POST | `/public/:slug/regenerate` | Same as generate but for “regenerate” action; same cap and logic. |
| POST | `/public/:slug/copied` | Mark session as copied. Body: `sessionToken`. Sets session status `copied`, tracks `review_copied`. Returns `googleReviewUrl` from campaign. |
| POST | `/public/:slug/google-clicked` | Track click. Body: `sessionToken`. Sets session `googleClicked: true`, tracks `google_clicked`. |
| POST | `/public/:slug/concern` | Submit concern. Body: `sessionToken`, `patientName`, `patientContact`, `concernText`. Validates `concernText` length ≥ 10. Optionally links to session and sets session status `concern_submitted`. Creates ConcernSubmission, tracks `concern_submitted`, sends email via `EmailService.sendConcernNotification` to `campaign.adminEmail` or fallback. Returns message and `googleReviewUrl`. |

---

## 4. Review Generation Service (`backend/services/reviewGenerationService.js`)

- **buildDraft(clinicName, selectedChips, extras):** From `sentenceBanks.js`. Uses openings (with {{CLINIC}}), one random sentence per selected chip (from campaign’s chip sentences), optional staff/freeText, closings. Length: short (1–2 sentences, 20–50 words) or medium (3–5 sentences, 50–110 words).
- **polishWithAI(draft, clinicName, opts):** If OpenAI and `OPENAI_API_KEY` exist, calls GPT (e.g. gpt-4o-mini) to lightly rewrite; rules: clinic name once, no emojis/hashtags/SEO phrases, natural tone.
- **validateReview(text, clinicName, reviewLength):** Checks word/sentence counts, clinic name count (exactly 1), no banned phrases, no emojis.
- **generateReview({ clinicName, selectedChips, freeText, staffName, reviewLength }):** Builds draft, optionally polishes with AI, validates; returns `reviewText`, `sentenceBankDraft`, `aiPolished`, `wordCount`, `sentenceCount`.

**Sentence bank** (`backend/services/sentenceBanks.js`): Openings and closings with `{{CLINIC}}`; chip-specific sentences come from the campaign’s `experienceHighlights[].sentences`.

---

## 5. Frontend

### 5.1 Public flow (no login)

- **Route:** `/r/:slug` → `QRReviewPage` (App.tsx).
- **Logic:** `useQRReview()` in `QRReviewLogic.tsx`. Uses `VITE_API_BASE_URL` as `API`.
- **Steps:**
  1. **Load:** `GET /qr-reviews/public/:slug` → set campaign, step `entry`.
  2. **Entry:** User enters name (optional), then either “Great experience” or “I have a concern.”
  3. **Great path:** `goToWhatStoodOut()` → step `what_stood_out`. User picks 2–4 highlights (MIN_CHIPS=2, MAX_CHIPS=4), optional freeText, staffName, review length. `submitHighlightsAndGenerate()` → `POST .../session` with `pathSelected: 'great'` → then `POST .../generate` with sessionToken → step `great_experience`, show review text.
  4. **Regenerate:** `POST .../regenerate` (same sessionToken), update text and remaining count (max 6).
  5. **Copy:** `navigator.clipboard.writeText(reviewText)`, then `POST .../copied` → get `googleReviewUrl` for “Leave a Google review” button.
  6. **Open Google:** `POST .../google-clicked` then `window.open(googleReviewUrl)`.
  7. **Concern path:** `startConcernFlow()` → `POST .../session` with `pathSelected: 'concern'` → step `concern`. User fills concern (min 10 chars). `submitConcern()` → `POST .../concern` → step `concern_submitted`.

### 5.2 Admin

- **Route:** `/admin/qr-reviews` → `QRReviewsPage` (AdminLayout).
- **Logic:** `useQRReviews()` in `QRReviewsLogic.tsx`. Token: `localStorage.getItem('adminToken')`.
- **Calls:** `GET/POST/PUT/DELETE /qr-reviews/campaigns`, `GET /campaigns/:id/stats`, `GET /campaigns/:id/concerns`, `PUT /campaigns/:cid/concerns/:concernId`, `GET /campaigns/:id/qr-code?format=&size=400`. QR download uses returned `qrCodeData` (data URL for PNG or SVG string).

### 5.3 Customer

- **Route:** `/customer/qr-reviews` → `CustomerQRReviewsPage` (CustomerPortalLayout).
- **Logic:** Token: `localStorage.getItem('customerToken')`. Only **my** campaigns: `GET /qr-reviews/my-campaigns`, `GET /qr-reviews/my-campaigns/:id/stats`, `GET /qr-reviews/my-campaigns/:id/concerns`. No campaign create/edit/delete, no QR generation (customer only views their campaigns and stats/concerns).

---

## 6. QR Code URL and Production

- **Backend** (qrReviews.js, GET `/campaigns/:id/qr-code`):  
  `url = (FRONTEND_URL || 'https://www.clinimediaportal.ca') + '/r/' + campaign.slug` (trailing slash on base stripped). So production uses default; local dev can set `FRONTEND_URL=http://localhost:5173` so generated QRs point to local frontend for testing.

---

## 7. Consistency and Edge Cases

| Area | Status / note |
|------|----------------|
| Slug uniqueness | Enforced by schema and 11000 handling on create/update. |
| Session token | Created in session document, returned once; all subsequent public calls use it. |
| Generation cap | 6 per session; backend and frontend both use MAX_GENERATIONS (backend) / remainingGenerations. |
| Concern min length | Backend 10 chars; frontend shows “at least 10 characters” and validates before submit. |
| Campaign active | Public routes require `isActive: true` for lookup and session/create; copied/google-clicked/concern only require campaign by slug (concern also checks isActive). |
| Event vs session counts | Stats prefer ReviewEvent counts, fall back to session/counts; consistent with funnel. |
| Customer scope | Customer only sees `customerId === req.user._id`; admin sees all. |

---

## 8. Summary Table

| Layer | What it does |
|-------|----------------|
| **ReviewCampaign** | Per-clinic config: slug, name, Google Review URL, highlights (label/category/sentences), admin email, logo. |
| **ReviewSession** | One per scan; stores path (great/concern), choices, and status through the funnel. |
| **ReviewGeneration** | Stored text per “generate” (sentence draft + optional AI polish). |
| **ConcernSubmission** | Patient concern + status workflow; email to admin. |
| **ReviewEvent** | Funnel analytics (session_started, path_selected, review_generated, review_copied, google_clicked, concern_submitted). |
| **Public flow** | Load by slug → session → (great: highlights → generate/regenerate → copy → google) or (concern: submit). |
| **Admin** | CRUD campaigns, view stats/concerns, update concern status, generate/download QR (URL fixed to production). |
| **Customer** | View own campaigns and their stats/concerns only. |
| **Review text** | Sentence bank + optional OpenAI polish; validation for length, clinic name once, no banned phrases/emojis. |

---

## 9. Optional Improvement: Configurable QR base URL

If you want QRs to point to localhost or another domain in dev/staging, you could change the QR endpoint to:

```js
const baseUrl = process.env.FRONTEND_URL || 'https://www.clinimediaportal.ca';
const url = `${baseUrl}/r/${campaign.slug}`;
```

Then set `FRONTEND_URL` per environment (e.g. `http://localhost:5173` for local). Right now the logic is correct and consistent; the only hardcoded assumption is production base URL for the QR link.
