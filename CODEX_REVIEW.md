# CliniMedia Portal — Codex Review Document
**Last updated:** April 15, 2026  
**Repo:** `C:\Users\ahmad\Desktop\clinismedia-portal` (this is the REAL repo)  
**Other copy:** `C:\Users\ahmad\OneDrive\Desktop\clinismedia-portal` — simplified dev scaffold, ignore it

---

## 1. What This Project Is

A multi-tenant SaaS portal for dental clinics managed by CliniMedia.  
Three portals in one app: **Admin**, **Customer (clinic)**, and **Employee**.

- **Admin** manages all clinics, integrations, bookings, employees, and content
- **Customer (clinic)** views their marketing performance, calls, invoices, gallery, onboarding, and leads
- **Employee** manages their schedule and media day availability

**Production URL:** `https://api.clinimediaportal.ca` (backend), frontend is deployed separately  
**Local dev:**
- Backend → `http://localhost:5000` (`node server.js` in `backend/`)
- Frontend → `http://localhost:5175` (`npm run dev` in `frontend/`)

---

## 2. Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite, React Router v7, Axios |
| Backend | Node.js, Express 5, MongoDB (Mongoose), JWT auth |
| Database | MongoDB Atlas (cluster: `clinimediacluster1`) |
| Telephony | Twilio (phone numbers, call routing, call logs, recordings) |
| AI Receptionist | Retell AI (after-hours AI agent, SIP routing, call analysis) |
| Integrations | Facebook/Meta, Google Ads, Google Business, Instagram, QuickBooks, Synology |
| Email | Nodemailer via `mail.clinimedia.ca` |
| Background services | Google Business token refresh, QuickBooks token refresh, Meta Leads email monitoring, scheduled emails |

---

## 3. Authentication

- JWT tokens stored in localStorage by role:
  - `adminToken` — admin users
  - `customerToken` — customer and receptionist users
  - `employeeToken` — employee users
- Token payload: `{ id, role }`
- Middleware: `backend/middleware/authenticateToken.js`
- Role guard: `backend/middleware/authorizeRole.js`
- Session management: `backend/middleware/sessionManager.js` (daily reset at 9 AM UTC)
- `/auth/validate` endpoint used by frontend to verify tokens on load
- Login redirects by role:
  - admin → `/admin`
  - customer → `/customer/dashboard`
  - receptionist → `/customer/meta-leads`
  - employee → `/employee/dashboard`
- Special: receptionist is stored as `customerToken` but has `role: "receptionist"` and `parentCustomerId`

---

## 4. Full File Structure (Frontend)

```
frontend/src/
├── components/
│   ├── Admin/
│   │   ├── AdminDash/                    # Admin dashboard (stats, quick actions)
│   │   ├── AdminMediaDayBooking/         # Admin view of media day bookings
│   │   ├── CustomerManagement/           # CRUD for clinic accounts
│   │   ├── EmployeeManagement/           # CRUD for employees
│   │   ├── FacebookManagement/           # Connect Facebook pages per clinic
│   │   ├── GoogleAdsManagement/          # Connect Google Ads accounts
│   │   ├── GoogleBusinessManagement/     # Google Business Profile management
│   │   ├── InstagramInsightsManagement/  # Instagram insights per clinic
│   │   ├── QRReviews/                    # QR code review campaigns
│   │   ├── QuickBooksManagement/         # QuickBooks integration
│   │   ├── SharedFolderManagement/       # Synology shared folder notes
│   │   ├── TwilioManagement/             # Connect Twilio numbers to clinics
│   │   ├── AIReceptionManagement/        # ✅ NEW — Retell AI config per clinic
│   │   │   ├── AIReceptionManagementLogic.tsx
│   │   │   └── AIReceptionManagementPage.tsx
│   │   ├── AdminGalleryPage.tsx
│   │   ├── AdminInvoicePage.tsx
│   │   ├── AdminLayout.tsx               # ✅ UPDATED — added /ai-reception route
│   │   ├── AdminNotificationPage.tsx
│   │   ├── AdminNotificationPopup.tsx
│   │   ├── MediaDayCalendar.tsx
│   │   ├── MetaLeadsManagementPage.tsx
│   │   ├── OnboardingTasks.tsx
│   │   ├── Settings.tsx
│   │   └── SidebarMenu.tsx               # ✅ UPDATED — added "Manage AI Reception" nav item
│   │
│   ├── Customer/
│   │   ├── CustomerDash/                 # Customer dashboard (upcoming media day, quick stats)
│   │   ├── CustomerMediaDayBooking/      # Book media day appointments
│   │   ├── AIReceptionPage.tsx           # ✅ NEW — customer view of AI reception status
│   │   ├── CallLogsPage.tsx              # Twilio call history & stats (full)
│   │   ├── CustomerGalleryPage.tsx
│   │   ├── CustomerInvoicePage.tsx
│   │   ├── CustomerOnboardingTasks.tsx
│   │   ├── CustomerPortalLayout.tsx      # ✅ UPDATED — added /ai-reception route
│   │   ├── CustomerQRReviewsPage.tsx
│   │   ├── CustomerQuickBooksInvoicesPage.tsx
│   │   ├── CustomerSidebar.tsx           # ✅ UPDATED — added "AI Reception" nav item (TRACKING section)
│   │   ├── FacebookInsightsPage.tsx
│   │   ├── FacebookIntegrationPage.tsx
│   │   ├── GoogleAdsPage.tsx
│   │   ├── GoogleBusinessAnalyticsPage.tsx
│   │   ├── InstagramInsightsPage.tsx
│   │   ├── MetaLeadsPage.tsx
│   │   ├── NotificationCenter.tsx
│   │   ├── NotificationPage.tsx
│   │   ├── ProtectedRoute.tsx
│   │   ├── ReceptionistCallLogsPage.tsx  # Simplified call log view for receptionists
│   │   └── SharedMediaPage.tsx
│   │
│   ├── Employee/
│   │   ├── EmployeeDash/
│   │   ├── EmployeeMediaDayBooking/
│   │   ├── EmployeeNotificationPage.tsx
│   │   ├── EmployeePortalLayout.tsx
│   │   └── EmployeeSidebar.tsx
│   │
│   ├── Public/
│   │   └── QRReview/                     # Public QR review page (no auth) at /r/:slug
│   │
│   ├── Login.tsx                         # Handles all 3 roles + receptionist login
│   └── PageTitle.tsx
```

---

## 5. Full File Structure (Backend)

```
backend/
├── config/
│   └── db.js                             # MongoDB connection
├── controllers/
│   ├── authController.js                 # Register, login, logout
│   ├── metaLeadsController.js
│   └── onboardingTaskController.js
├── middleware/
│   ├── authenticateToken.js              # JWT verification
│   ├── authorizeRole.js                  # Role-based access
│   ├── resolveEffectiveCustomerId.js     # Receptionist → parent customer
│   ├── requireCanBookMediaDay.js
│   ├── allowBookingAccess.js
│   └── sessionManager.js                # Daily session reset
├── models/
│   ├── User.js                           # Main user schema (admin/customer/employee/receptionist)
│   │                                     # Includes: twilioPhoneNumber, aiReceptionistSettings
│   ├── Booking.js
│   ├── BlockedDate.js
│   ├── CallLog.js                        # Twilio call records
│   ├── ClientNote.js
│   ├── CustomerNotification.js
│   ├── EmailNotificationSettings.js
│   ├── GalleryItem.js + AssignedGalleryItem.js
│   ├── GoogleBusinessInsights.js
│   ├── Insights.js
│   ├── InstaMediaInsight.js + InstaUserInsight.js + InstagramInsightImage.js
│   ├── Invoice.js + AssignedInvoice.js
│   ├── MetaLead.js + MetaLeadFolderMapping.js + MetaLeadSubjectMapping.js
│   ├── OnboardingTask.js + AssignedOnboardingTask.js
│   ├── QuickBooksCustomerMapping.js
│   ├── ReviewCampaign.js + ReviewEvent.js + ReviewGeneration.js + ReviewSession.js
│   └── ConcernSubmission.js
├── routes/
│   ├── auth.js                           # POST /login, /register, /logout, GET /validate
│   ├── bookings.js
│   ├── blockedDates.js
│   ├── clientNotes.js
│   ├── customerNotifications.js
│   ├── customers.js                      # GET/POST/PATCH /customers
│   ├── emailNotificationSettings.js
│   ├── employees.js
│   ├── facebook.js
│   ├── gallery.js
│   ├── googleAds.js
│   ├── googleBusiness.js
│   ├── instagramInsights.js + instagramInsightsApi.js + instagramInsightsImages.js
│   ├── invoices.js
│   ├── metaLeads.js
│   ├── onboardingTasks.js
│   ├── qrReviews.js
│   ├── quickbooks.js
│   ├── retell.js                         # ✅ AI receptionist settings API
│   ├── sharedFolders.js
│   └── twilio.js                         # Twilio call routing, webhooks, call logs
├── services/
│   ├── emailService.js
│   ├── googleAdsTokenRefreshService.js
│   ├── googleBusinessAdminTokenRefreshService.js
│   ├── googleBusinessDataRefreshService.js
│   ├── metaLeadsEmailService.js
│   ├── onboardingEmailService.js
│   ├── quickbooksService.js + quickbooksTokenRefreshService.js
│   ├── reviewGenerationService.js
│   ├── scheduledEmailService.js
│   └── storageService.js
└── server.js                             # Main Express app, port 5000
```

---

## 6. Admin Portal — All Routes

| Route | Page | Purpose |
|---|---|---|
| `/admin` | AdminDashPage | Overview — pending bookings, unread notes, quick actions |
| `/admin/media` | AdminMediaDayBookingPage | View/manage all media day bookings |
| `/admin/onboarding` | OnboardingTasks | Manage onboarding task templates |
| `/admin/customers` | CustomerManagementPage | Create/edit/delete clinic accounts |
| `/admin/employees` | EmployeeManagementPage | Create/edit/delete employees |
| `/admin/gallery` | AdminGalleryPage | Manage which gallery items are visible |
| `/admin/invoices` | AdminInvoicePage | Manage invoices |
| `/admin/notifications` | AdminNotificationPage | View/send notifications |
| `/admin/facebook` | FacebookManagementPage | Connect Facebook pages per clinic |
| `/admin/google-ads` | GoogleAdsManagementPage | Connect Google Ads accounts |
| `/admin/google-business` | GoogleBusinessManagementPage | Google Business Profile |
| `/admin/twilio` | TwilioManagementPage | Assign Twilio numbers, set forward numbers, menu message |
| `/admin/ai-reception` | AIReceptionManagementPage | **✅ NEW** — Configure Retell AI per clinic |
| `/admin/instagram-insights` | InstagramInsightsManagementPage | Manage Instagram connections |
| `/admin/meta-leads` | MetaLeadsManagementPage | View/manage Meta Leads |
| `/admin/quickbooks` | QuickBooksManagementPage | QuickBooks integration |
| `/admin/qr-reviews` | QRReviewsPage | QR code review campaigns |
| `/admin/shared-folders` | SharedFolderManagementPage | Synology shared folder management |
| `/admin/settings` | Settings | Admin preferences |

---

## 7. Customer Portal — All Routes

| Route | Page | Who sees it |
|---|---|---|
| `/customer/dashboard` | CustomerDashPage | All customers |
| `/customer/media-day-booking` | CustomerMediaDayBookingPage | All customers (receptionists if `canBookMediaDay=true`) |
| `/customer/onboarding-tasks` | CustomerOnboardingTasks | All customers |
| `/customer/gallery` | CustomerGalleryPage | All customers |
| `/customer/shared-media` | SharedMediaPage | All customers |
| `/customer/quickbooks-invoices` | CustomerQuickBooksInvoicesPage | All customers |
| `/customer/facebook-insights` | FacebookInsightsPage | All customers |
| `/customer/facebook-integration` | FacebookIntegrationPage | All customers |
| `/customer/google-ads` | GoogleAdsPage | All customers |
| `/customer/google-business-analytics` | GoogleBusinessAnalyticsPage | All customers |
| `/customer/instagram-insights` | InstagramInsightsPage | All customers |
| `/customer/qr-reviews` | CustomerQRReviewsPage | All customers |
| `/customer/call-logs` | CallLogsPage / ReceptionistCallLogsPage | All (receptionists get simplified view) |
| `/customer/ai-reception` | AIReceptionPage | **✅ NEW** — Shows AI reception status & business hours |
| `/customer/meta-leads` | MetaLeadsPage | All customers + receptionists |
| `/customer/notifications` | NotificationPage | All customers |

**Receptionist restriction:** receptionists (`role: "receptionist"`) only see: `call-logs`, `meta-leads`, and `media-day-booking` (if `canBookMediaDay=true`). All other pages are hidden and redirected away.

---

## 8. Twilio + Retell Integration

### How it currently works

1. Each clinic has a Twilio phone number set in Twilio Console with webhook pointing to the backend
2. Inbound call → Twilio POSTs to `/api/twilio/voice/incoming`
3. Backend finds the clinic by their assigned `twilioPhoneNumber`
4. Checks business hours stored in `User.aiReceptionistSettings.businessHours`
5. If **open** → returns TwiML `<Dial>` to forward to clinic phone
6. If **closed** + AI enabled → registers call with Retell API → returns TwiML `<Dial><Sip>` to route to Retell SIP URI
7. If AI fails → plays after-hours message

### Retell webhook
- Retell sends events (`call_started`, `call_ended`, `call_analyzed`) to a webhook URL
- Webhook endpoint still needs to be **built and registered** (see "Still To Do" below)

### User model AI fields (`User.aiReceptionistSettings`)

```js
{
  enabled: Boolean,                       // Master toggle
  provider: "retell",                     // Always retell
  routingMode: "off" | "after_hours" | "always_ai",
  telephonyMode: "sip_uri" | "phone_number" | "custom",
  retellAgentId: String,                  // e.g. "agent_1d686e94c10b276375bd33044f"
  retellSipUri: String,                   // e.g. "sip:xxxxx@sip.retellai.com"
  retellPhoneNumber: String,              // If using phone number mode
  timezone: String,                       // e.g. "America/Toronto"
  sendMissedCallsToAi: Boolean,           // Route missed business-hours calls to AI
  afterHoursMessage: String,              // Fallback TTS message
  businessHours: {                        // Per-day schedule
    monday:    { enabled: true,  start: "09:00", end: "17:00" },
    tuesday:   { enabled: true,  start: "09:00", end: "17:00" },
    wednesday: { enabled: true,  start: "09:00", end: "17:00" },
    thursday:  { enabled: true,  start: "09:00", end: "17:00" },
    friday:    { enabled: false, start: "09:00", end: "17:00" },
    saturday:  { enabled: false, start: "09:00", end: "17:00" },
    sunday:    { enabled: false, start: "09:00", end: "17:00" },
  }
}
```

### Existing backend Retell API (`backend/routes/retell.js`)

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/api/retell/settings/:clinicId` | Admin | Read a clinic's AI settings |
| PUT | `/api/retell/settings/:clinicId` | Admin | Save a clinic's AI settings |
| GET | `/api/retell/configuration` | Customer | Read-only view of own AI settings |

### Dentistry on 66 — known config
- Twilio number: `+16479302693`
- Clinic phone: `+14169212473`
- Timezone: `America/Toronto`
- Business hours: Monday–Thursday, 9:00 AM–5:00 PM
- Retell Agent ID: `agent_1d686e94c10b276375bd33044f`

---

## 9. Environment Variables

### Backend (`backend/.env`)

| Variable | Status | Notes |
|---|---|---|
| `PORT` | `5000` | Backend listens here |
| `MONGODB_URI` | ✅ Set | Atlas cluster |
| `JWT_SECRET` | ⚠️ Placeholder | **Must change before production** — currently `some_super_secret_key_you_create` |
| `FRONTEND_URL` | `http://localhost:5173` | Update for production |
| `TWILIO_ACCOUNT_SID` | ✅ Set | |
| `TWILIO_AUTH_TOKEN` | ✅ Set | Fixed spacing issue (was `= value` with spaces) |
| `TWILIO_API_KEY_SID` | ✅ Set | |
| `TWILIO_API_KEY_SECRET` | ✅ Set | |
| `TWILIO_VI_SERVICE_SID` | ✅ Set | |
| `RETELL_API_KEY` | ❌ Empty | **Must fill in** — from Retell Dashboard → API Keys (webhook badge key) |
| `OPENAI_API_KEY` | ✅ Set | |
| `FB_APP_ID` / `FB_APP_SECRET` | ✅ Set | |
| `GOOGLE_ADS_*` | ✅ Set | |
| `GOOGLE_BUSINESS_*` | ✅ Set | |
| `EMAIL_*` / `LEADS_EMAIL_*` | ✅ Set | |
| `QUICKBOOKS_*` | ✅ Set | |
| `SYNOLOGY_*` | ✅ Set | |
| `BACKEND_URL` | Set to ngrok URL | Update when testing webhooks locally |

### Frontend (`frontend/.env.development`)

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `http://localhost:5000/api` |
| `VITE_BACKEND_BASE_URL` | `http://localhost:5000` |

---

## 10. What Was Done in This Session

### ✅ Completed

1. **Explored real repo** — `C:\Users\ahmad\Desktop\clinismedia-portal` — fully mapped all 70+ files, all routes, all models, all services

2. **Created Admin AI Reception Management page** (`frontend/src/components/Admin/AIReceptionManagement/`)
   - Clinic list with on/off badges
   - Enable/disable toggle per clinic
   - Routing mode: Off / After Hours / Always AI
   - Retell Agent ID, SIP URI, phone number (depends on telephony mode)
   - After-hours fallback message
   - Per-day business hours editor (Mon–Sun toggles, open/close time pickers)
   - Calls existing `GET /api/retell/settings/:clinicId` and `PUT /api/retell/settings/:clinicId`

3. **Created Customer AI Reception page** (`frontend/src/components/Customer/AIReceptionPage.tsx`)
   - Shows clinic's current AI reception status (Active/Inactive badge)
   - Routing mode display
   - Full business hours schedule (open days vs AI days)
   - Fallback message display
   - Calls existing `GET /api/retell/configuration`

4. **Wired Admin AI Reception into AdminLayout** (`/admin/ai-reception` route added)

5. **Wired Customer AI Reception into CustomerPortalLayout** (`/customer/ai-reception` route added)

6. **Updated Admin SidebarMenu** — "Manage AI Reception" added under INTEGRATIONS section (below Manage Twilio), with robot icon

7. **Updated Customer Sidebar** — "AI Reception" added under TRACKING section (between Call Logs and Meta Leads), with robot icon

8. **Added `RETELL_API_KEY=` placeholder** to `backend/.env`

9. **Fixed pre-existing JSX bug** in `AdminDashPage.tsx` (mismatched `</div>` closing a `<section>` — was blocking frontend from compiling)

10. **Started both local servers:**
    - Backend: `http://localhost:5000`
    - Frontend: `http://localhost:5175`

---

## 11. Still To Do

### 🔴 Critical (required for Retell to work end-to-end)

1. **Fill in `RETELL_API_KEY`** in `backend/.env`
   - Go to Retell Dashboard → API Keys
   - Use the key with the **webhook badge**
   - This key is also the signing secret for webhook verification

2. **Build Retell webhook handler** in `backend/routes/retell.js`
   - Currently the route file only has admin settings + customer read endpoints
   - Need to add `POST /api/retell/webhook` that:
     - Verifies `x-retell-signature` with HMAC-SHA256 using `RETELL_API_KEY`
     - Handles `call_started`, `call_ended`, `call_analyzed` events
     - Stores call data (transcript, summary, extracted fields) — needs a `RetellCall` model
   - **Important:** Must register this route BEFORE `express.json()` in `server.js` so it gets raw body for signature verification

3. **Create `RetellCall` model** (`backend/models/RetellCall.js`)
   - Fields: retellCallId, customerId (ref: User), agentId, fromNumber, toNumber
   - callStatus, startTimestamp, endTimestamp, disconnectionReason
   - transcript, recordingUrl
   - callAnalysis: { callSummary, callSuccessful, userSentiment, callerName, email, reasonForCall, callbackNumber, symptomsMentioned, preferredCallbackTime, patientType, urgencyLevel, locationWorksForCaller, recommendedFollowUp }
   - twilioCallSid (for linking back to Twilio call)

4. **Add call logs API to retell.js**
   - `GET /api/retell/calls` — paginated call list (customer sees own calls, admin can filter by clinic)
   - `GET /api/retell/calls/:id` — full call detail

5. **Update Customer AI Reception page** to show call log table
   - Once RetellCall model + API exist, the customer page should show a table of past AI-handled calls
   - Each row: date/time, caller name, caller number, duration, urgency, sentiment, "View" button
   - "View" opens a drawer with full transcript + analysis + recording audio player

6. **Configure Retell webhook URL** in Retell Dashboard
   - URL: `https://api.clinimediaportal.ca/api/retell/webhook`
   - For local testing: use ngrok → `https://your-ngrok-url.ngrok-free.dev/api/retell/webhook`
   - Update `BACKEND_URL` in `.env` when using ngrok

7. **Configure Dentistry on 66 in admin portal**
   - Go to Admin → Manage AI Reception → select Dentistry on 66
   - Set: Agent ID = `agent_1d686e94c10b276375bd33044f`
   - Routing mode = After Hours
   - Mon–Thu, 09:00–17:00
   - Hit Save

### 🟡 Important (security & production readiness)

8. **Change `JWT_SECRET`** in `backend/.env` — current value is the placeholder `some_super_secret_key_you_create`. Replace with a random 32+ character string before any real users log in.

9. **Twilio webhook signature validation** — public Twilio webhook endpoints (`/api/twilio/voice/incoming`, `/api/twilio/voice/status-callback`) should validate the `X-Twilio-Signature` header using `TWILIO_AUTH_TOKEN`. Currently unauthenticated — anyone who discovers the URL can spoof calls.

10. **Test Retell SIP routing locally**
    - Make a test call to `+16479302693` outside business hours
    - Verify Twilio calls the portal, portal registers with Retell, TwiML returns SIP URI
    - Monitor backend logs for `[Retell] call_started`

### 🟢 Nice to Have (future improvements)

11. **Role-based redirect after customer login** — currently all customers go to `/customer/dashboard`. Receptionists correctly go to `/customer/meta-leads`. No changes needed here, it already works.

12. **Add AI reception calls to Customer Sidebar notification badge** — if there are unread Retell calls, show a count badge next to "AI Reception" in the sidebar (same pattern as Call Logs uses `callLogs` from `customer-notifications/unread-counts`)

13. **Link Retell calls to Twilio CallSid** — pass `X-Twilio-Call-Sid` SIP header when routing to Retell, store it in RetellCall, use it to join the two records for unified call reporting

14. **Add Retell call data to Admin Twilio Management page** — show AI-handled calls alongside regular Twilio call logs for admin review

---

## 12. Twilio Webhook URLs (Set in Twilio Console per number)

| Field | URL |
|---|---|
| Voice Webhook (POST) | `https://api.clinimediaportal.ca/api/twilio/voice/incoming` |
| Status Callback (POST) | `https://api.clinimediaportal.ca/api/twilio/voice/status-callback` |

For local testing with ngrok:
- Replace `https://api.clinimediaportal.ca` with your ngrok URL
- Update `BACKEND_URL` in `.env` accordingly

---

## 13. Retell Webhook (Set in Retell Dashboard)

| Field | Value |
|---|---|
| Webhook URL | `https://api.clinimediaportal.ca/api/retell/webhook` |
| Signing | Uses `RETELL_API_KEY` as HMAC-SHA256 secret |
| Signature header | `x-retell-signature` |
| Events to handle | `call_started`, `call_ended`, `call_analyzed` |

**Key rule:** The webhook route must receive the **raw body** (not parsed JSON) for signature verification. In Express, register the retell webhook route BEFORE `app.use(express.json())`.

---

## 14. Important Patterns for New Code

### Frontend API calls (Admin)
```tsx
const token = localStorage.getItem('adminToken');
const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/your-endpoint`, {
  headers: { Authorization: `Bearer ${token}` }
});
```

### Frontend API calls (Customer)
```tsx
const token = localStorage.getItem('customerToken');
const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/your-endpoint`, {
  headers: { Authorization: `Bearer ${token}` }
});
```

### Adding a new Admin page
1. Create `frontend/src/components/Admin/YourPage/YourPageLogic.tsx` + `YourPagePage.tsx`
2. Import and add `<Route path="/your-route" element={<YourPagePage />} />` in `AdminLayout.tsx`
3. Add nav item to the correct section array in `SidebarMenu.tsx`

### Adding a new Customer page
1. Create `frontend/src/components/Customer/YourPage.tsx`
2. Import and add `<Route path="your-route" element={<YourPage />} />` in `CustomerPortalLayout.tsx`
3. Add nav item to correct section array in `CustomerSidebar.tsx` with a `pageKey`
4. If receptionists should NOT see it, don't add its `pageKey` to the `allowedPages` array in `CustomerPortalLayout.tsx`

### Backend auth middleware usage
```js
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');
const resolveEffectiveCustomerId = require('../middleware/resolveEffectiveCustomerId');

// Admin only
router.get('/admin-endpoint', authenticateToken, authorizeRole(['admin']), handler);

// Customer or receptionist (uses parent customer ID automatically)
router.get('/customer-endpoint', authenticateToken, authorizeRole(['customer', 'receptionist']), resolveEffectiveCustomerId, handler);
// Access customer ID via req.effectiveCustomerId
```
