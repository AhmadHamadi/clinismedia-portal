# CliniMedia Portal – Codebase Reference

This document summarizes how the frontend and backend fit together so we can tackle the next task accurately.

---

## 1. Stack & Repo Structure

| Layer | Tech |
|-------|------|
| **Frontend** | React 18, TypeScript, Vite, React Router 7, Tailwind, Axios |
| **Backend** | Node, Express 5, MongoDB (Mongoose) |
| **Auth** | JWT (7d expiry) + in-memory session manager (daily reset ~9 AM) |

**Monorepo layout:**
- `frontend/` – Vite + React
- `backend/` – Express API, models, services, routes

**API base URL:** `import.meta.env.VITE_API_BASE_URL` (e.g. `http://localhost:3000` or `https://api.clinimediaportal.ca`). Set in `.env` as `VITE_API_BASE_URL`.

---

## 2. Roles & Routing

### Roles (from `User` model)
- `admin` – full management
- `customer` – clinics (location required)
- `employee` – departments: `photography`, `web`, `social`

### Frontend routes (`App.tsx` + layouts)

| Path | Role | Layout | Notes |
|------|------|--------|-------|
| `/` | — | — | Redirect → `/login` |
| `/login` | — | — | Username/password; supports `returnUrl`, `leadId` |
| `/admin/*` | admin | `AdminLayout` + `SidebarMenu` | Nested under `ProtectedRoute` |
| `/customer/*` | customer | `CustomerPortalLayout` + `CustomerSidebar` | Nested under `ProtectedRoute` |
| `/employee/dashboard`, `/employee/media-day-calendar`, etc. | employee | `EmployeePortalLayout` | Each route wrapped in `ProtectedRoute` |

### Admin nested routes (`AdminLayout.tsx`)

| Path | Component |
|------|------------|
| `/admin` | `AdminDash` |
| `/admin/media` | `AdminMediaDayBookingPage` |
| `/admin/onboarding` | `OnboardingTasks` |
| `/admin/customers` | `CustomerManagementPage` |
| `/admin/employees` | `EmployeeManagementPage` |
| `/admin/gallery` | `AdminGalleryPage` |
| `/admin/settings` | `Settings` |
| `/admin/notifications` | `AdminNotificationPage` |
| `/admin/invoices` | `AdminInvoicePage` |
| `/admin/facebook` | `FacebookManagementPage` |
| `/admin/shared-folders` | `SharedFolderManagementPage` |
| `/admin/google-ads` | `GoogleAdsManagementPage` |
| `/admin/google-business` | `GoogleBusinessManagementPage` |
| `/admin/twilio` | `TwilioManagementPage` |
| `/admin/instagram-insights` | `InstagramInsightsManagementPage` |
| `/admin/meta-leads` | `MetaLeadsManagementPage` |
| `/admin/quickbooks` | `QuickBooksManagementPage` |

### Customer nested routes (`CustomerPortalLayout.tsx`)

| Path | Component |
|------|------------|
| `/customer/dashboard` | `CustomerDashPage` |
| `/customer/media-day-booking` | `CustomerMediaDayBookingPage` |
| `/customer/onboarding-tasks` | `CustomerOnboardingTasks` |
| `/customer/facebook-integration` | `FacebookIntegrationPage` |
| `/customer/facebook-insights` | `FacebookInsightsPage` |
| `/customer/instagram-insights` | `InstagramInsightsPage` |
| `/customer/shared-media` | `SharedMediaPage` |
| `/customer/gallery` | `CustomerGalleryPage` |
| `/customer/invoices` | `CustomerInvoicePage` |
| `/customer/notifications` | `NotificationPage` |
| `/customer/google-ads` | `GoogleAdsPage` |
| `/customer/google-business-analytics` | `GoogleBusinessAnalyticsPage` |
| `/customer/call-logs` | `CallLogsPage` |
| `/customer/meta-leads` | `MetaLeadsPage` |
| `/customer/quickbooks-invoices` | `CustomerQuickBooksInvoicesPage` |

---

## 3. Auth & API Usage

### Login (`/api/auth/login`)
- Body: `{ username, password }`
- Response: `{ token, user }` with `user.role`, `user.id`, etc.
- Frontend: stores `adminToken`/`customerToken`/`employeeToken` and `adminData`/`customerData`/`employeeData` in `localStorage`; redirects by role.

### Token checks
- **Backend:** `authenticateToken` (JWT + `sessionManager.isValidSession`), then `authorizeRole(['admin'|'customer'|'employee'])` where needed.
- **Frontend:** `ProtectedRoute` calls `GET /api/auth/validate` (uses `Bearer` token). Validates at most every 5 minutes; on failure clears tokens and redirects to `/login?returnUrl=...`.

### API calls
- All authenticated: `Authorization: Bearer <adminToken|customerToken|employeeToken>`.
- Base URL: `import.meta.env.VITE_API_BASE_URL` (no `/api` in the var; routes already live under `/api/...`).

---

## 4. Backend API Map

| Prefix | Purpose |
|--------|---------|
| `/api/auth` | `register`, `login`, `logout`, `validate` |
| `/api/customers` | `profile` (by `req.user.id`), CRUD, `portal-visibility`, `facebook-disconnect` |
| `/api/employees` | Employee CRUD |
| `/api/bookings` | Media-day: create, list, status, next-eligible, admin-create, employee, etc. |
| `/api/blocked-dates` | List, create, delete |
| `/api/onboarding-tasks` | CRUD, assignments |
| `/api/facebook` | OAuth, save-page, disconnect, insights |
| `/api/google-ads` | OAuth, accounts, KPIs, daily, campaigns, save-account, disconnect |
| `/api/google-business` | OAuth, admin profiles, save-profile, business-insights, disconnect, group-insights, manual-refresh |
| `/api/twilio` | Numbers, connect, disconnect, call-logs, voice webhooks, recording, voicemail, etc. |
| `/api/quickbooks` | Connect, callback, status, customers, map-customer, invoices, PDF |
| `/api/meta-leads` | Customer leads/stats/update; admin leads, subject-mappings, check-emails |
| `/api/gallery` | CRUD, assign, assigned, assignments |
| `/api/invoices` | Upload, assign, assigned, file/view |
| `/api/shared-folders` | assign, remove, my-folder |
| `/api/client-notes` | create, my-notes, all, unread-count, mark-read |
| `/api/customer-notifications` | unread-counts, mark-read, mark-all-read, increment |
| `/api/email-notification-settings` | (used by gallery and elsewhere for custom emails) |
| `/api/instagram-insights` | Multiple routers: insights, my-insights, upload, list, my-images, image, etc. |

Static uploads:
- `/uploads/instagram-insights`, `/uploads/invoices`, `/uploads/customer-logos`, `/uploads/gallery`

---

## 5. Core Models (MongoDB/Mongoose)

| Model | Role / use |
|-------|------------|
| **User** | All users. Roles, credentials, and many integration fields: `facebook*`, `googleAds*`, `googleBusiness*`, `twilio*`, `quickbooks*`, `sharedFolder*`, `bookingIntervalMonths`, `visibleGalleryItems`, `visibleInvoices`, etc. |
| **Booking** | Media-day: `customer`, `date`, `status` (pending/accepted/declined), `photographer`, `notes`, `adminMessage`, `employeeMessage` |
| **BlockedDate** | Admin-blocked calendar dates |
| **GalleryItem**, **AssignedGalleryItem** | Gallery content and per-customer assignment |
| **Invoice**, **AssignedInvoice** | Invoices and per-customer assignment |
| **OnboardingTask**, **AssignedOnboardingTask** | Tasks and per-customer assignment |
| **ClientNote** | Shared-folder / client notes |
| **CustomerNotification** | Section-based unread counts (e.g. metaInsights, gallery, metaLeads) |
| **EmailNotificationSettings** | Per-customer email preferences |
| **GoogleBusinessInsights** | Cached Google Business metrics |
| **MetaLead**, **MetaLeadSubjectMapping** | Meta/Leads and subject mapping |
| **QuickBooksCustomerMapping** | Portal customer ↔ QuickBooks customer |
| **CallLog** | Twilio call logs |
| **Insights**, **InstaUserInsight**, **InstaMediaInsight**, **InstagramInsightImage** | Facebook/Instagram insights and images |

---

## 6. Important Flows

### Media day booking
- **Eligibility:** `backend/utils/bookingEligibility.js` (`getIntervalMonths`, `calculateNextEligibleDate`, `checkBookingEligibility`, `getNextEligibleDate`). Uses `User.bookingIntervalMonths` (1–6 ↔ 12–2 per year) and last **accepted** booking; snaps to month-start in `America/Toronto`.
- **Customer:** `CustomerMediaDayBookingLogic` + `CustomerMediaDayBookingPage`; `GET /bookings/next-eligible-date`, `GET /bookings/my-bookings`, `POST /bookings`, `DELETE /bookings/:id`.
- **Admin:** `AdminMediaDayBookingLogic` + `AdminMediaDayBookingPage`; `POST /bookings/admin-create` (no eligibility), `PATCH /bookings/:id/status`, `PATCH /bookings/:id/photography`.
- **Employee:** `EmployeeMediaDayBookingLogic` + `EmployeeMediaDayBookingPage`; view and `PATCH /bookings/:id/accept-session`.

### Google Business
- **Admin:** OAuth → save admin tokens in `User` (admin); assign profile to customer (`googleBusinessProfileId`, `googleBusinessProfileName`, tokens). `GoogleBusinessAdminTokenRefreshService` refreshes admin tokens ~every 30s.
- **Customer:** `GET /customers/profile` (has `googleBusinessProfileId`?) → `GET /google-business/business-insights/:customerId`. Backend prefers **admin** tokens for insights when available.

### Session / daily reset
- `sessionManager`: in-memory; `loginDate`; after 9 AM, sessions from previous days are invalid.
- `ProtectedRoute` and `authenticateToken` rely on JWT + `sessionManager.isValidSession`.
- `cleanupOldSessions` and `forceDailyReset` run hourly from `server.js`.

---

## 7. Backend Services & Jobs (started in `server.js`)

| Service | Schedule / trigger |
|---------|--------------------|
| **GoogleBusinessDataRefreshService** | 8 AM daily + on startup |
| **ScheduledEmailService** (daily + proactive) | 9 AM daily + on startup |
| **sessionManager** cleanup | Every hour |
| **metaLeadsEmailService** | Every N minutes (`META_LEADS_CHECK_INTERVAL`, default 5) |
| **QuickBooksTokenRefreshService** | Every 30s |
| **GoogleAdsTokenRefreshService** | Every 30s |
| **GoogleBusinessAdminTokenRefreshService** | Every 30s |

---

## 8. Middleware

- **authenticateToken:** `Authorization: Bearer <token>`, JWT verify, `sessionManager.isValidSession` → `req.user` (`_id`, `role`, etc.).
- **authorizeRole(roles):** expects `req.user.role` in `roles`.

---

## 9. Frontend Patterns

- **Logic vs UI:** Many features use a `*Logic.tsx` (hooks, API calls, state) and `*Page.tsx` (UI). Examples: `AdminMediaDayBooking`, `CustomerMediaDayBooking`, `CustomerDash`, `AdminDash`, `TwilioManagement`, `GoogleAdsManagement`, `CustomerManagement`, `FacebookManagement`, `EmployeeMediaDayBooking`, `EmployeeDash`.
- **Tokens:** `localStorage` keys: `adminToken`, `customerToken`, `employeeToken`, `adminData`, `customerData`, `employeeData`. `auth.ts`: `logout`, `clearAllSessions`, `getCurrentUser`.
- **Customer ID:** Often from `localStorage` `customerData` → `_id` or `id`, or from `GET /customers/profile` when the backend derives it from `req.user.id`.

---

## 10. Config & Env

**Backend (e.g. `.env`):**
- `MONGODB_URI`, `JWT_SECRET`, `PORT`
- `FRONTEND_URL` (CORS)
- `VITE_API_BASE_URL` – only if server needs to know; frontend reads its own `VITE_*`.
- Integration-specific: Facebook, Google Ads, Google Business, Twilio, QuickBooks, AWS S3, etc.

**Frontend (e.g. `.env`):**
- `VITE_API_BASE_URL` – e.g. `http://localhost:3000` or `https://api.clinimediaportal.ca` (must match where the API is served; no `/api` suffix in the base).

---

## 11. Quick Index: Where Things Live

| Topic | Backend | Frontend |
|-------|---------|----------|
| Auth | `routes/auth.js`, `controllers/authController.js`, `middleware/authenticateToken.js`, `authorizeRole.js`, `sessionManager.js` | `Login.tsx`, `ProtectedRoute.tsx`, `utils/auth.ts` |
| Users / customers | `routes/customers.js`, `models/User.js` | `CustomerManagementPage`, `CustomerSidebar`, `CustomerPortalLayout`, dashboards |
| Media day | `routes/bookings.js`, `routes/blockedDates.js`, `utils/bookingEligibility.js` | `AdminMediaDayBooking*`, `CustomerMediaDayBooking*`, `EmployeeMediaDayBooking*` |
| Google Business | `routes/googleBusiness.js`, `services/googleBusinessAdminTokenRefreshService.js`, `googleBusinessDataRefreshService.js` | `GoogleBusinessManagementPage`, `GoogleBusinessAnalyticsPage` |
| Twilio / calls | `routes/twilio.js` | `TwilioManagementPage`, `CallLogsPage` |
| QuickBooks | `routes/quickbooks.js`, `services/quickbooksService.js`, `quickbooksTokenRefreshService.js` | `QuickBooksManagementPage`, `CustomerQuickBooksInvoicesPage` |
| Gallery | `routes/gallery.js`, `models/GalleryItem.js`, `AssignedGalleryItem.js` | `AdminGalleryPage`, `CustomerGalleryPage` |
| Invoices | `routes/invoices.js`, `models/Invoice.js`, `AssignedInvoice.js` | `AdminInvoicePage`, `CustomerInvoicePage` |
| Notifications | `routes/customerNotifications.js`, `CustomerNotification` | `CustomerSidebar`, `CustomerPortalLayout`, `NotificationPage`, `CustomerDash` |
| Meta / FB | `routes/facebook.js` | `FacebookManagementPage`, `FacebookIntegrationPage`, `FacebookInsightsPage` |
| Meta Leads | `routes/metaLeads.js`, `controllers/metaLeadsController.js` | `MetaLeadsManagementPage`, `MetaLeadsPage` |

---

## 12. Conventions

- **Backend:** CommonJS (`require`/`module.exports`). Route files: `router.get/post/put/patch/delete(..., authenticateToken, authorizeRole(...), handler)`.
- **Frontend:** TS/TSX, functional components, `axios` for API. API base: `import.meta.env.VITE_API_BASE_URL` (or `VITE_BACKEND_BASE_URL` where used for static assets).
- **Errors:** Backend returns `{ error, details?, requiresReauth? }`; frontend uses `err.response?.data` to show messages.

---

You can use this as the single reference for the next task; I’ll rely on it to stay consistent with the existing architecture.
