# Meta Leads – Code Verification Checklist

This doc confirms the full flow so nothing in other files breaks it.

## 1. Backend – Server & monitoring

| File | Check | Status |
|------|--------|--------|
| `server.js` | `metaLeadsEmailService` required, `app.use('/api/meta-leads', metaLeadsRoutes)`, `metaLeadsEmailService.startMonitoring(leadsCheckInterval)` on startup | OK |

## 2. Backend – Routes & middleware

| File | Check | Status |
|------|--------|--------|
| `routes/metaLeads.js` | Customer routes: `authenticateToken` → `authorizeRole(['customer','receptionist'])` → `resolveEffectiveCustomerId` → controller. Admin routes: `authorizeRole(['admin'])`. Paths: `/customer/leads`, `/customer/stats`, `/customer/leads/:leadId`, PATCH status/appointment/notes, admin mappings + test-subject + check-emails | OK |
| `middleware/authenticateToken.js` | Verifies JWT, sets `req.user` (_id, role, parentCustomerId for receptionist). Uses same JWT_SECRET for admin and customer tokens | OK |
| `middleware/authorizeRole.js` | Allows only listed roles; customer routes use `['customer','receptionist']` | OK |
| `middleware/resolveEffectiveCustomerId.js` | Sets `req.effectiveCustomerId = req.user.parentCustomerId \|\| req.user._id` so receptionists see parent clinic’s leads | OK |

## 3. Backend – Controller & models

| File | Check | Status |
|------|--------|--------|
| `controllers/metaLeadsController.js` | `getCustomerLeads` / `getCustomerLeadStats` use `req.effectiveCustomerId`; query is `{ customerId }`. Subject mappings created/updated with `normalizeSubjectForMapping()` so they match incoming emails | OK |
| `models/MetaLead.js` | `customerId` (ref User) required, indexed; status, emailDate, etc. | OK |
| `models/MetaLeadSubjectMapping.js` | `customerId`, `emailSubject`, `emailSubjectLower`, `isActive` | OK |
| `models/MetaLeadFolderMapping.js` | `customerId`, `folderName`, `folderNameLower`, `isActive` | OK |

## 4. Backend – Email service

| File | Check | Status |
|------|--------|--------|
| `services/metaLeadsEmailService.js` | IMAP to `LEADS_EMAIL_USER` or `leads@clinimedia.ca`, password from `LEADS_EMAIL_PASS` or `EMAIL_PASS`. `findCustomerBySubject()` (exact → case-insensitive → partial). `processEmail()`: folder customer or subject match → `new MetaLead({ customerId: customer._id, ... })` → save. `startMonitoring(intervalMinutes)` runs on server start | OK |

## 5. Backend – Auth & notifications

| File | Check | Status |
|------|--------|--------|
| `routes/auth.js` | `GET /validate` returns `user.parentCustomerId` and `user.canBookMediaDay` for receptionist | OK |
| `controllers/authController.js` | Login puts `parentCustomerId` and `canBookMediaDay` in JWT for receptionist; `sessionManager.addSession(user._id, token, user.role)` | OK |
| `routes/customerNotifications.js` | `unread-counts` uses `resolveEffectiveCustomerId`; `metaLeads` count = `MetaLead.countDocuments({ customerId, status: 'new' })`. `mark-read/metaLeads` accepted | OK |

## 6. Frontend – Customer Meta Leads page

| File | Check | Status |
|------|--------|--------|
| `CustomerPortalLayout.tsx` | Route `meta-leads` → `<MetaLeadsPage />`. Receptionist `allowedPages` includes `'meta-leads'`. On `/customer/meta-leads`, calls `mark-read/metaLeads` | OK |
| `MetaLeadsPage.tsx` | Uses `customerToken`, `GET ${VITE_API_BASE_URL}/meta-leads/customer/leads` and `.../customer/stats` with params; PATCH status, appointment, notes. Displays leads and stats | OK |
| `CustomerSidebar.tsx` | "Meta Leads" link to `/customer/meta-leads`, section `metaLeads` for badge | OK |
| `CustomerDashPage.tsx` | Meta Leads card navigates to `/customer/meta-leads`, shows `unreadCounts.metaLeads` | OK |

## 7. Frontend – Admin & API base URL

| File | Check | Status |
|------|--------|--------|
| `MetaLeadsManagementPage.tsx` | Uses `adminToken`; GET/POST/PATCH/DELETE subject and folder mappings; POST check-emails; GET test-subject. `VITE_API_BASE_URL` used for all | OK |
| `AdminLayout.tsx` | Route `/meta-leads` → `<MetaLeadsManagementPage />` | OK |
| `frontend/.env` | `VITE_API_BASE_URL=http://localhost:5000/api` so requests go to `/api/meta-leads/...` | OK |

## 8. Flow summary

1. **Ingestion:** Server starts → `metaLeadsEmailService.startMonitoring(3)` → every 3 min (or `META_LEADS_CHECK_INTERVAL`) IMAP to leads@clinimedia.ca → UNSEEN emails → for each: folder or subject match → `MetaLead` created with `customerId` = mapped clinic.
2. **Customer view:** Customer or receptionist logs in → JWT has `_id` and (if receptionist) `parentCustomerId`. Frontend calls `GET /api/meta-leads/customer/leads` with `Authorization: Bearer <customerToken>`. Backend sets `req.effectiveCustomerId` → `MetaLead.find({ customerId: req.effectiveCustomerId })` → leads appear on that customer’s Meta Leads page.
3. **No cross‑clinic leakage:** All customer-side meta-leads routes use `resolveEffectiveCustomerId`; controller uses only `req.effectiveCustomerId` in queries.

## 9. Files that could affect Meta Leads (none break it)

- **sessionManager.js** – Validates session by `userId` + `role`; no special case that would block meta-leads.
- **twilio.js** – No reference to MetaLead or meta-leads routes.
- **authController.js** – Login adds session and JWT payload; receptionist gets `parentCustomerId` and `canBookMediaDay`.

Conclusion: The chain from IMAP → MetaLead (customerId) → API (effectiveCustomerId) → customer Meta Leads page is consistent; no other file was found that would break it.
