# CliniMedia Portal – Complete Codebase Guide

This document provides a **full explanation** of the CliniMedia Portal codebase so any AI assistant (e.g., Claude) or developer can understand the entire system: structure, workflow, AI usage, environment variables, and how everything fits together.

---

## 1. High-Level Overview

**CliniMedia Portal** is a centralized B2B portal for **clinics (customers)** and **employees** managed by an **admin**. It handles:

- Media day scheduling and booking
- Integrations (Google Ads, Google Business Profile, Facebook, Twilio call tracking, QuickBooks, Meta Leads)
- Gallery, invoices, onboarding tasks, shared folders, notifications
- Call tracking with AI-powered appointment detection

**Architecture:** Monorepo with a React (Vite) frontend and Express.js backend, both talking to MongoDB.

---

## 2. Directory Structure

```
clinismedia-portal/
├── backend/                    # Express.js API server
│   ├── config/                 # DB, email, S3 configuration
│   │   ├── db.js
│   │   ├── email_config.js
│   │   └── s3Client.js
│   ├── controllers/            # Business logic (auth, metaLeads, onboarding)
│   ├── middleware/             # Auth, roles, session, customer resolution
│   ├── models/                 # Mongoose schemas (User, Booking, CallLog, etc.)
│   ├── routes/                 # API route handlers (auth, customers, twilio, etc.)
│   ├── services/               # Background jobs, email, token refresh, data refresh
│   ├── scripts/                # One-off scripts (seed, fix, check)
│   ├── utils/                  # Helpers (booking eligibility, etc.)
│   ├── uploads/                # Static uploads (invoices, gallery, instagram)
│   ├── server.js               # Entry point, CORS, routes, scheduled jobs
│   └── .env                    # Backend environment variables
│
├── frontend/                   # React + Vite SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── Admin/          # Admin-only pages (dashboard, settings, integrations)
│   │   │   ├── Customer/       # Customer (clinic) portal pages
│   │   │   └── Employee/       # Employee portal (media day, dashboard)
│   │   ├── utils/              # auth.ts, formatPhone.ts
│   │   ├── assets/
│   │   ├── App.tsx             # Router, routes, role-based protection
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── .env                    # Frontend env (VITE_* only)
│
└── *.md                        # Documentation (this file, CODEBASE_REFERENCE, etc.)
```

---

## 3. Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite, React Router 7, Tailwind CSS, Axios |
| **Backend** | Node.js, Express 5, MongoDB (Mongoose) |
| **Auth** | JWT (7-day expiry) + in-memory session manager (daily reset ~9 AM) |
| **AI** | OpenAI API (gpt-4o-mini) for appointment detection in call summaries |
| **Deployment** | Railway (production API at `api.clinimediaportal.ca`, frontend at `www.clinimediaportal.ca`) |

---

## 4. Roles & Access

| Role | Description | Main Capabilities |
|------|-------------|-------------------|
| **admin** | CliniMedia staff | Full management: customers, employees, integrations, settings, all CRUD |
| **customer** | Clinic / location | Portal: dashboard, media day booking, gallery, invoices, integrations (per clinic) |
| **employee** | Photography / web / social | Media day calendar, accept sessions, dashboard |

**Routing:**
- `/` → redirect to `/login`
- `/login` → username/password, supports `returnUrl`, `leadId`
- `/admin/*` → AdminLayout + SidebarMenu
- `/customer/*` → CustomerPortalLayout + CustomerSidebar
- `/employee/*` → EmployeePortalLayout (dashboard, media-day-calendar, etc.)

All non-login routes are wrapped in `ProtectedRoute` which validates JWT and role.

---

## 5. Authentication & API Flow

### Login
- **Endpoint:** `POST /api/auth/login`
- **Body:** `{ username, password }`
- **Response:** `{ token, user }`
- Frontend stores in `localStorage`:
  - `adminToken` / `customerToken` / `employeeToken`
  - `adminData` / `customerData` / `employeeData` (user object)

### Token Validation
- **Backend:** `authenticateToken` middleware (JWT + `sessionManager.isValidSession`), then `authorizeRole(['admin'|'customer'|'employee'])` where needed.
- **Frontend:** `ProtectedRoute` calls `GET /api/auth/validate` (Bearer token). Validates at most every 5 minutes; on failure clears tokens and redirects to `/login?returnUrl=...`.

### API Base URL
- Frontend uses `import.meta.env.VITE_API_BASE_URL` (e.g. `http://localhost:5000/api` or `https://api.clinimediaportal.ca/api`).
- All API calls include `Authorization: Bearer <token>`.
- **Important:** `VITE_API_BASE_URL` is baked in at **build time**; for production it must point to the production API.

---

## 6. AI Tokens & AI Decisions

### Where AI Is Used
AI is used **only** in **call tracking** (Twilio) for **appointment detection**:
- After a call is recorded and transcribed, Twilio Voice Intelligence produces a **conversation summary**.
- The backend sends that summary to **OpenAI** to decide: was an appointment successfully booked? (YES/NO).
- Result is stored in `CallLog.appointmentBooked` and shown in the customer portal.

### How It Works
1. **Twilio Voice Intelligence (CI):**
   - `TWILIO_VI_SERVICE_SID` enables Twilio’s Conversational Intelligence.
   - When `TWILIO_ENABLE_TRANSCRIPTION=true`, the backend creates a CI transcript from the recording.
   - Twilio’s CI produces a “Conversation Summary” operator result.

2. **Conversation Summary → OpenAI:**
   - `fetchConversationSummary(transcriptSid)` fetches the summary from Twilio’s OperatorResults.
   - `detectAppointmentBookedWithAI(summaryText)` calls OpenAI with a prompt: “Was an appointment successfully booked?”
   - Model: `gpt-4o-mini`, `max_tokens: 10`, `temperature: 0.1`.
   - Response must start with “YES” or “NO”; anything else falls back to keyword matching.

3. **Fallback:**
   - If `OPENAI_API_KEY` is missing or OpenAI fails → `detectAppointmentBookedWithKeywords(summaryText)` (simple positive/negative keyword matching).

### Rate Limiting
- **2 requests per minute** to OpenAI (to stay under free-tier limits).
- If rate limit is hit, the request is queued and waits until the window resets.

### Environment Variable for AI
- **`OPENAI_API_KEY`** (backend `.env`): Your OpenAI API key. Get it from https://platform.openai.com/api-keys
- Without this key, AI is disabled and keyword fallback is used.

### Code Location
- **File:** `backend/routes/twilio.js`
- **Functions:** `detectAppointmentBookedWithAI`, `detectAppointmentBookedWithKeywords`, `detectAppointmentBooked`
- **Trigger:** CI webhook `POST /api/twilio/ci-status` when the transcript is ready.

---

## 7. Environment Variables (.env)

### Backend (backend/.env)

| Variable | Purpose |
|----------|---------|
| **Core** | |
| `MONGODB_URI` | MongoDB connection string (required) |
| `JWT_SECRET` | Secret for signing JWT tokens (required) |
| `PORT` | Server port (default 3000; often 5000 locally) |
| `NODE_ENV` | `development` or `production` |
| **CORS / URLs** | |
| `FRONTEND_URL` | Frontend origin for CORS (e.g. `https://www.clinimediaportal.ca`, `http://localhost:5173`) |
| `BACKEND_URL` | Full backend URL (e.g. `https://api.clinimediaportal.ca`) for webhooks |
| `RAILWAY_PUBLIC_DOMAIN` | Auto-set on Railway (e.g. `api.clinimediaportal.ca`) |
| **Email** | |
| `EMAIL_HOST` | SMTP host (default: `mail.clinimedia.ca`) |
| `EMAIL_PORT` | SMTP port (465 or 587) |
| `EMAIL_USER` | SMTP user |
| `EMAIL_PASS` / `EMAIL_PASSWORD` | SMTP password |
| **Leads Email** (Meta Leads) | |
| `LEADS_EMAIL_USER` | IMAP user for leads inbox |
| `LEADS_EMAIL_PASS` | IMAP password |
| `LEADS_EMAIL_HOST` | IMAP host |
| `LEADS_EMAIL_IMAP_PORT` | IMAP port (default 993) |
| `META_LEADS_CHECK_INTERVAL` | Minutes between Meta leads checks (default 3) |
| **Twilio** | |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID (required) |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token (fallback if no API keys) |
| `TWILIO_API_KEY_SID` | Twilio API Key SID (recommended) |
| `TWILIO_API_KEY_SECRET` | Twilio API Key Secret |
| `TWILIO_VI_SERVICE_SID` | Voice Intelligence service for transcription |
| `TWILIO_ENABLE_MENU` | `true` to enable IVR menu (1=new, 2=existing) |
| `TWILIO_ENABLE_RECORDING` | `true` to record calls |
| `TWILIO_ENABLE_TRANSCRIPTION` | `true` to enable CI transcription |
| `TWILIO_MENU_MESSAGE` | Custom IVR message text |
| **OpenAI (AI)** | |
| `OPENAI_API_KEY` | OpenAI API key for appointment detection (optional; uses keyword fallback if missing) |
| **Google Ads** | |
| `GOOGLE_ADS_CLIENT_ID` | OAuth client ID |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_ADS_REDIRECT_URI` | OAuth redirect (often auto-built) |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads API developer token |
| **Google Business Profile** | |
| `GOOGLE_BUSINESS_CLIENT_ID` | OAuth client ID |
| `GOOGLE_BUSINESS_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_BUSINESS_REDIRECT_URI` | OAuth callback URL (often auto-built) |
| **Facebook** | |
| `FB_APP_ID` | Facebook App ID |
| `FB_APP_SECRET` | Facebook App secret |
| `FB_REDIRECT_URI` | OAuth redirect URI |
| **QuickBooks** | |
| `QUICKBOOKS_CLIENT_ID` | QuickBooks OAuth client ID |
| `QUICKBOOKS_CLIENT_SECRET` | QuickBooks OAuth client secret |
| `QUICKBOOKS_ENVIRONMENT` | `sandbox` or `production` |
| **AWS S3** (optional) | |
| `AWS_S3_BUCKET_NAME` | S3 bucket for file storage |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_ENDPOINT_URL` | S3-compatible endpoint (e.g. Cloudflare R2) |
| `AWS_DEFAULT_REGION` | Region (default `auto`) |

### Frontend (frontend/.env)

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Full API base URL including `/api` (e.g. `http://localhost:5000/api` or `https://api.clinimediaportal.ca/api`) |
| `VITE_BACKEND_BASE_URL` | Base URL for static assets (no `/api`; e.g. `http://localhost:5000` or `https://api.clinimediaportal.ca`) |
| `VITE_PORT` | Dev server port (default 5173) |

**Note:** Only `VITE_*` variables are exposed to the frontend. They are injected at **build time**, so production builds must use production URLs.

---

## 8. Main Workflows

### Media Day Booking
1. **Eligibility:** `backend/utils/bookingEligibility.js` uses `User.bookingIntervalMonths` and last accepted booking to compute next eligible date (snapped to month-start in `America/Toronto`).
2. **Customer:** Books via `CustomerMediaDayBookingPage` → `POST /bookings`, `GET /bookings/next-eligible-date`, `GET /bookings/my-bookings`.
3. **Admin:** Can create bookings without eligibility (`POST /bookings/admin-create`), update status, assign photographer.
4. **Employee:** Can accept sessions via `PATCH /bookings/:id/accept-session`.

### Call Tracking (Twilio → AI)
1. Incoming call → `POST /api/twilio/voice/incoming` → IVR (optional) → Dial to clinic.
2. Recording completed → `POST /api/twilio/voice/recording-status` → CI transcript created if transcription enabled.
3. CI transcript ready → `POST /api/twilio/ci-status` → `fetchConversationSummary` → `detectAppointmentBooked(summary)` (OpenAI or keyword) → `CallLog.appointmentBooked` set.

### Integrations (OAuth)
- **Google Ads, Google Business, Facebook:** Admin connects once; tokens stored in `User` (admin or customer). Token refresh services run every 30s (QuickBooks, Google Ads, Google Business).
- **Google Business:** Admin assigns profile to customer via `googleBusinessProfileId`; backend prefers admin tokens for insights.

### Session / Daily Reset
- `sessionManager` (in-memory): tracks `loginDate`; after 9 AM, sessions from previous days are invalid.
- `cleanupOldSessions` and `forceDailyReset` run hourly from `server.js`.

---

## 9. Backend Services & Jobs (server.js)

| Service | Schedule / Trigger |
|---------|--------------------|
| **GoogleBusinessDataRefreshService** | 8 AM daily + on startup |
| **ScheduledEmailService** | 9 AM daily + on startup |
| **sessionManager** cleanup | Every hour |
| **metaLeadsEmailService** | Every N minutes (`META_LEADS_CHECK_INTERVAL`, default 3) |
| **QuickBooksTokenRefreshService** | Every 30s |
| **GoogleAdsTokenRefreshService** | Every 30s |
| **GoogleBusinessAdminTokenRefreshService** | Every 30s |

---

## 10. API Routes Map

| Prefix | Purpose |
|--------|---------|
| `/api/auth` | login, logout, register, validate |
| `/api/customers` | profile, CRUD, portal-visibility, facebook-disconnect |
| `/api/employees` | Employee CRUD |
| `/api/bookings` | Media-day: create, list, status, next-eligible, admin-create, employee |
| `/api/blocked-dates` | List, create, delete |
| `/api/onboarding-tasks` | CRUD, assignments |
| `/api/facebook` | OAuth, save-page, disconnect, insights |
| `/api/google-ads` | OAuth, accounts, KPIs, daily, campaigns |
| `/api/google-business` | OAuth, admin profiles, save-profile, business-insights, disconnect |
| `/api/twilio` | Numbers, connect, disconnect, call-logs, voice webhooks, recording, voicemail |
| `/api/quickbooks` | Connect, callback, status, customers, invoices, PDF |
| `/api/meta-leads` | Customer leads/stats, admin leads, subject-mappings |
| `/api/gallery` | CRUD, assign, assigned |
| `/api/invoices` | Upload, assign, file/view |
| `/api/shared-folders` | assign, remove, my-folder |
| `/api/client-notes` | create, my-notes, all |
| `/api/customer-notifications` | unread-counts, mark-read, mark-all-read |
| `/api/instagram-insights` | insights, my-insights, upload, list, images |

---

## 11. Core Models (MongoDB)

| Model | Purpose |
|-------|---------|
| **User** | All users; roles; integration fields (facebook*, googleAds*, googleBusiness*, twilio*, quickbooks*, sharedFolder*, bookingIntervalMonths, etc.) |
| **Booking** | Media-day: customer, date, status, photographer, notes |
| **BlockedDate** | Admin-blocked calendar dates |
| **CallLog** | Twilio calls: customerId, from, to, status, recordingUrl, summaryText, appointmentBooked |
| **GalleryItem**, **AssignedGalleryItem** | Gallery content and per-customer assignment |
| **Invoice**, **AssignedInvoice** | Invoices and per-customer assignment |
| **OnboardingTask**, **AssignedOnboardingTask** | Tasks and per-customer assignment |
| **ClientNote** | Shared-folder notes |
| **CustomerNotification** | Section-based unread counts |
| **MetaLead**, **MetaLeadSubjectMapping** | Meta Leads and subject mapping |
| **GoogleBusinessInsights** | Cached Google Business metrics |
| **QuickBooksCustomerMapping** | Portal customer ↔ QuickBooks customer |

---

## 12. Frontend Patterns

- **Logic vs UI:** Many features use `*Logic.tsx` (hooks, API calls, state) and `*Page.tsx` (UI).
- **Auth:** `utils/auth.ts` has `logout`, `clearAllSessions`, `getCurrentUser`.
- **Customer ID:** From `localStorage` `customerData` → `_id`, or from `GET /customers/profile`.

---

## 13. Quick Reference: Where Things Live

| Topic | Backend | Frontend |
|-------|---------|----------|
| Auth | `routes/auth.js`, `controllers/authController.js`, `middleware/authenticateToken.js`, `sessionManager.js` | `Login.tsx`, `ProtectedRoute.tsx`, `utils/auth.ts` |
| AI (appointment detection) | `routes/twilio.js` (detectAppointmentBookedWithAI, OPENAI_API_KEY) | N/A (backend only) |
| Media day | `routes/bookings.js`, `utils/bookingEligibility.js` | `AdminMediaDayBooking*`, `CustomerMediaDayBooking*`, `EmployeeMediaDayBooking*` |
| Call tracking | `routes/twilio.js` | `TwilioManagementPage`, `CallLogsPage` |
| Google Business | `routes/googleBusiness.js`, `services/googleBusiness*` | `GoogleBusinessManagementPage`, `GoogleBusinessAnalyticsPage` |
| QuickBooks | `routes/quickbooks.js`, `services/quickbooksService.js` | `QuickBooksManagementPage`, `CustomerQuickBooksInvoicesPage` |
| Meta Leads | `routes/metaLeads.js`, `controllers/metaLeadsController.js` | `MetaLeadsManagementPage`, `MetaLeadsPage` |

---

## 14. Conventions

- **Backend:** CommonJS (`require`/`module.exports`). Routes: `router.get/post(..., authenticateToken, authorizeRole(...), handler)`.
- **Frontend:** TS/TSX, functional components, Axios. Base: `import.meta.env.VITE_API_BASE_URL`.
- **Errors:** Backend returns `{ error, details?, requiresReauth? }`; frontend uses `err.response?.data`.

---

This guide should give a complete picture of the CliniMedia Portal codebase for any developer or AI assistant working on the project.
