# Add Receptionist – Plan Verification Report

**Reviewed:** Full codebase cross-check against the agreed plan.  
**Conclusion:** The plan is **accurate and the simplest workable approach**. A few clarifications and one optional hardening are noted below.

---

## Implemented

Implementation is **complete**. All items in this plan have been implemented.

- **Checklist and verification steps:** See [RECEPTIONIST_IMPLEMENTATION_CHECKLIST.md](./RECEPTIONIST_IMPLEMENTATION_CHECKLIST.md) for a concise list of backend/frontend changes, route middleware, and **How to Run Manual Verification**.
- **Test receptionist:** From `backend/`: `node scripts/seedReceptionist.js <customerUsername> <name> <username> <email> <password> [y|n]`. Use `--help` for usage.

---

## 1. Backend – User & Auth

| Item | Plan | Codebase | Verified |
|------|------|----------|----------|
| User.role enum | Add `'receptionist'` | `["admin","customer","employee"]` in `models/User.js` | ✓ |
| User.location | Required only when `role === 'customer'` | `required: function(){ return this.role === "customer" }` | ✓ Receptionist stays optional |
| parentCustomerId | `{ type: ObjectId, ref: 'User' }`, optional | Not present | ✓ To add |
| canBookMediaDay | `{ type: Boolean, default: false }` | Not present | ✓ To add |
| authController login | For `user.role === 'receptionist'`: include `parentCustomerId` (string) and `canBookMediaDay` in response `user` and in JWT | JWT is `{ id, role }`; response `user` has `id,name,username,email,role,department` | ✓ To add for receptionist only |

**Note:** In JWT use `parentCustomerId: user.parentCustomerId?.toString?.() || user.parentCustomerId` so it’s a string in the token. `authenticateToken` does not need changes; decoded JWT fields (including `parentCustomerId`, `canBookMediaDay`) are already on `req.user`.

---

## 2. Backend – New Middleware

| Middleware | Plan | Verified |
|------------|------|----------|
| **resolveEffectiveCustomerId** | `req.effectiveCustomerId = req.user.parentCustomerId \|\| req.user._id` | ✓ Use only on routes with `authorizeRole(['customer','receptionist'])`. |
| **requireCanBookMediaDay** | If `req.user.role === 'receptionist'` and `req.user.canBookMediaDay !== true` → 403 | ✓ Correct; customers don’t need `canBookMediaDay`. |
| **allowBookingAccess** | If admin/customer/employee → next(); else if receptionist and `canBookMediaDay === true` → next(); else 403 | ✓ For `GET /blocked-dates` and `GET /bookings/accepted` (no `resolveEffectiveCustomerId`). |

**Optional hardening:** In `resolveEffectiveCustomerId`, if `role === 'receptionist'` and `!req.user.parentCustomerId`, return 403 to avoid mis‑scoped behaviour for bad data.

---

## 3. Backend – Meta Leads

- **Routes** (`routes/metaLeads.js`): All 6 customer routes use `authorizeRole(['customer'])`. Change to `authorizeRole(['customer','receptionist'])` and add `resolveEffectiveCustomerId` before the controller. ✓
- **Controller** (`metaLeadsController.js`): In all 6 customer methods, replace `const customerId = req.user._id || req.user.id` with `const customerId = req.effectiveCustomerId`. ✓  
- `getLeadDetails` uses `MetaLead` with `customerId` and `.populate('customerId','name email')`; for receptionists `customerId` will be the clinic (`effectiveCustomerId`). ✓

---

## 4. Backend – Bookings

- **Routes to update (4):**  
  `GET /my-bookings`, `GET /next-eligible-date`, `POST /`, `DELETE /:id`  
  - Use: `authenticateToken`, `authorizeRole(['customer','receptionist'])`, `requireCanBookMediaDay`, `resolveEffectiveCustomerId`, then handler. ✓
- **In handlers:** Replace every use of `req.user._id` (or `req.user.id`) as the **customer** with `req.effectiveCustomerId`:
  - `Booking.find({ customer: ... })` ✓  
  - `getNextEligibleDate(...)` ✓  
  - `checkBookingEligibility(..., date)` ✓  
  - `new Booking({ customer: ... })` ✓  
  - `User.findById(...)` for confirmation emails → use `req.effectiveCustomerId` (clinic) ✓  
  - `booking.customer` check in `DELETE` → use `req.effectiveCustomerId` ✓  

- **GET /accepted:** Keep `authenticateToken`, add `allowBookingAccess` only (no `resolveEffectiveCustomerId`). ✓  
- **GET /available-dates:** Leave `authorizeRole('customer')` only; not used by the customer Media Day flow. ✓  

`utils/bookingEligibility.js`: no change; it receives `customerId` and uses `User.findById(customerId)` for `bookingIntervalMonths`. Passing `req.effectiveCustomerId` (clinic) is correct. ✓

---

## 5. Backend – Blocked Dates

- **GET /** `routes/blockedDates.js`: Keep `authenticateToken`, add `allowBookingAccess`. ✓  

---

## 6. Backend – Customer Notifications

- **Routes:** `unread-counts`, `mark-read`, `mark-all-read` use `authorizeRole('customer')` (string). Change to `authorizeRole(['customer','receptionist'])` and add `resolveEffectiveCustomerId` before the handler. ✓  
- **Handlers:** Replace every `req.user._id` used as `customerId` with `req.effectiveCustomerId` (findOne, `new CustomerNotification`, `MetaLead.countDocuments`, `CallLog.countDocuments`, and all branches in `mark-read` and `mark-all-read`). ✓  
- **increment** route: do not change. ✓  

---

## 7. Backend – GET /customers/profile

- **Allow receptionist:** Change  
  `if (!customer || customer.role !== "customer")`  
  to  
  `if (!customer || (customer.role !== "customer" && customer.role !== "receptionist"))`. ✓  
- **Media Day:** When `customer.role === 'receptionist'` and `customer.parentCustomerId` exists: load parent `User`, then respond with a plain object (e.g. `customer.toObject()`) with `bookingIntervalMonths` set from the parent. ✓  

`CustomerMediaDayBookingPage` and `CustomerMediaDayBookingLogic` use `GET /customers/profile` and `GET /bookings/next-eligible-date`; with the above, no frontend changes are needed there. ✓  

---

## 8. Backend – Receptionist CRUD & DELETE customer

- **Placement:** Add `GET /:customerId/receptionists`, `POST /:customerId/receptionists`, `PATCH /:customerId/receptionists/:receptionistId`, `DELETE /:customerId/receptionists/:receptionistId` **before** `DELETE /:id` and `PUT /:id` in `routes/customers.js` to avoid path conflicts. ✓  
- **GET /:customerId/receptionists:** `authenticateToken`, `authorizeRole(['admin'])`; ensure `customerId` exists and `role === 'customer'`;  
  `User.find({ parentCustomerId: customerId, role: 'receptionist' }).select('name username canBookMediaDay _id')`. ✓  
- **POST /:customerId/receptionists:** Body `{ name, username, email, password, canBookMediaDay }`; auth; validate `customerId`; duplicate check on `username` and `email`; create with `role: 'receptionist'`, `parentCustomerId: customerId`, `canBookMediaDay: !!canBookMediaDay`, no `location`. ✓  
- **PATCH /:customerId/receptionists/:receptionistId:** Body `{ canBookMediaDay }` and optionally `{ password }`; load receptionist; ensure `parentCustomerId.toString() === customerId` and `role === 'receptionist'`; update `canBookMediaDay` and hashed `password` if provided. ✓  
- **DELETE /:customerId/receptionists/:receptionistId:** Same load and ownership check as PATCH; delete User. ✓  
- **DELETE /customers/:id:** In the existing cleanup block, add  
  `User.deleteMany({ parentCustomerId: id, role: 'receptionist' })`. ✓  

---

## 9. Frontend – Login

- **handleSubmit:** Add  
  `else if (user.role === "receptionist") {`  
  - `localStorage`: `customerToken`, `customerData` (same keys as customer; ensure `customerData` includes `parentCustomerId` and `canBookMediaDay` from `user`).  
  - Navigate: if `leadId` → `/customer/meta-leads`; else if `returnUrl` → `returnUrl`; else → `/customer/meta-leads`.  
- **useEffect (already logged in):** When `customerToken` exists and `auth/validate` succeeds, the default path (when no `leadId` or `returnUrl`) should use `customerData` from localStorage: if `role === 'receptionist'` → `/customer/meta-leads`, else → `/customer/dashboard`. ✓  

`ProtectedRoute` and `auth/validate`: receptionists use `customerToken`; `validate` only needs to return 200. No change required. ✓  

---

## 10. Frontend – CustomerPortalLayout

- **allowedPages / route guard:**  
  - Parse `customerData` from localStorage;  
  - `role = customerData?.role`, `canBook = customerData?.canBookMediaDay === true`;  
  - `allowedPages = (role === 'receptionist') ? (canBook ? ['meta-leads','media-day-booking'] : ['meta-leads']) : null`.  
  - `currentPageKey`: if pathname is `/customer` or `/customer/` → `'dashboard'`; else `pathname.replace(/^\/customer\/?/, '') || 'dashboard'`.  
  - `firstAllowed`: if `role === 'receptionist'` → `'/customer/meta-leads'`, else `'/customer/dashboard'`.  
  - If `Array.isArray(allowedPages) && allowedPages.length > 0 && !allowedPages.includes(currentPageKey)` →  
    `return <Navigate to={firstAllowed} replace />`. ✓  
- **Sidebar:** Pass `allowedPages` to `CustomerSidebar`. ✓  

---

## 11. Frontend – CustomerSidebar

- **Props:** Add `allowedPages?: string[] | null`. ✓  
- **Filtering:** For `mainActionsItems`, `marketingInsightsItems`, `trackingItems`:  
  - `pageKey = path.replace(/^\/customer\/?/, '')` (e.g. `dashboard`, `meta-leads`, `media-day-booking`).  
  - If `allowedPages != null`, filter to items whose `pageKey` is in `allowedPages`; else show all.  
  - Render a section only if its filtered list is non‑empty. ✓  
- **unread-counts / QuickBooks:** No change; 403 for receptionists on QuickBooks is acceptable. ✓  

---

## 12. Frontend – Edit Customer & Receptionists

- **CustomerManagementLogic:**  
  - State: `receptionists`, `addReceptionistModal`, `receptionistForm` (e.g. `{ name, username, email, password, canBookMediaDay }`).  
  - When opening Edit (`handleEditClick`): call `GET /customers/${customer._id}/receptionists` and set `receptionists`.  
  - Handlers: `handleAddReceptionist` (POST, then refetch, close modal), `handleRemoveReceptionist` (DELETE, then refetch), and optionally `handleEditReceptionist` (PATCH for `canBookMediaDay` and password). ✓  
- **CustomerManagementPage (Edit modal):**  
  - After the main form and before Cancel/Save, add a **Receptionists** block:  
    - List: for each `r` in `receptionists`: name, username, “Can book: Y/N”, [Edit] [Remove].  
    - [Add Receptionist] opens the add form/modal.  
  - Add form: Name, Username, Email, Password, “Can book media day” (Y/N). ✓  
- **Add Customer:** No change. ✓  

---

## 13. authorizeRole

- `authorizeRole` uses `roles.includes(req.user.role)`.  
- For `authorizeRole(['customer','receptionist'])` it behaves correctly.  
- For customer‑only routes, `authorizeRole('customer')` or `authorizeRole(['customer'])` both work. ✓  

---

## 14. Out of Scope / Pre-existing

- **Booking model:** Uses `customer`, not `customerId`. In `customers.js` delete, `Booking.deleteMany({ customerId })` will not match; it should be `{ customer: customerId }`. Not part of this plan; fix separately if desired.  
- **BlockedDate:** No `customerId`; delete uses `BlockedDate.deleteMany({ customerId })` which won’t match. Blocked dates are global; this may be intentional. Not part of this plan.  
- **PUT /customers/profile:** Plan does not change it. Receptionists could update their own name/email; if the form sends `location` or `bookingIntervalMonths`, consider stripping them for `role === 'receptionist'` in a follow-up.  

---

## 15. Summary

| Area | Plan status | Notes |
|------|-------------|-------|
| User model | ✓ | Add `receptionist`, `parentCustomerId`, `canBookMediaDay`. |
| Auth (login, JWT) | ✓ | Add `parentCustomerId`, `canBookMediaDay` for receptionist. |
| Middleware | ✓ | `resolveEffectiveCustomerId`, `requireCanBookMediaDay`, `allowBookingAccess`. |
| Meta leads | ✓ | 6 routes + controller `customerId` → `effectiveCustomerId`. |
| Bookings | ✓ | 4 routes + handlers; GET /accepted and GET /blocked-dates use `allowBookingAccess`. |
| Customer notifications | ✓ | 3 routes + all `customerId` uses → `effectiveCustomerId`. |
| GET /customers/profile | ✓ | Allow receptionist + attach parent’s `bookingIntervalMonths`. |
| Receptionist CRUD + DELETE cleanup | ✓ | 4 routes before `/:id`; delete receptionists when deleting customer. |
| Login | ✓ | Receptionist branch + “already logged in” default path from `customerData`. |
| CustomerPortalLayout | ✓ | `allowedPages`, guard, `firstAllowed`, pass `allowedPages` to sidebar. |
| CustomerSidebar | ✓ | `allowedPages`, filter by `pageKey`, hide empty sections. |
| CustomerManagement (Edit) | ✓ | Receptionists block, Add/Remove, optional Edit. |

The plan is **accurate and sufficient**. It is the simplest approach that: creates receptionists as linked users, reuses the customer portal and `customerToken`, restricts access via `allowedPages` and `requireCanBookMediaDay`/`allowBookingAccess`, and scopes data with `effectiveCustomerId` and the parent’s `bookingIntervalMonths` for Media Day.

Implementation can proceed as specified; the only recommended addition is the optional 403 in `resolveEffectiveCustomerId` when `role === 'receptionist'` and `!parentCustomerId`.

---

## 16. Code Cross-Check (Exact Locations)

Verified against the current codebase. Line/file references below.

### 16.1 authorizeRole: string vs array

- `authorizeRole(roles)` uses `roles.includes(req.user.role)`.
- **String** (e.g. `authorizeRole('customer')`): `'customer'.includes('customer')` → true; `'customer'.includes('receptionist')` → false. Used in: `customerNotifications.js` (unread-counts, mark-read, mark-all-read), `bookings.js` (my-bookings, next-eligible-date, POST /, available-dates, DELETE /:id), `blockedDates.js` (post, delete), others.
- **Array** (e.g. `authorizeRole(['customer','receptionist'])`): `['customer','receptionist'].includes('receptionist')` → true. Use arrays when allowing both customer and receptionist.

### 16.2 Backend – files and patterns

| File | What to change |
|------|----------------|
| **models/User.js** | role enum add `'receptionist'`; add `parentCustomerId` (ObjectId, ref User, optional), `canBookMediaDay` (Boolean, default false). |
| **controllers/authController.js** | In `login`, for `user.role === 'receptionist'`: add `parentCustomerId`, `canBookMediaDay` to JWT payload and to `user` in `res.json`. |
| **middleware/** | New: `resolveEffectiveCustomerId.js`, `requireCanBookMediaDay.js`, `allowBookingAccess.js`. |
| **routes/metaLeads.js** | 6 customer routes (leads, stats, leads/:leadId, status, appointment, notes): `authorizeRole(['customer'])` → `authorizeRole(['customer','receptionist'])`, insert `resolveEffectiveCustomerId` before the controller. |
| **controllers/metaLeadsController.js** | Replace `req.user._id || req.user.id` with `req.effectiveCustomerId` in: getCustomerLeads, getCustomerLeadStats, updateLeadStatus, updateAppointmentStatus, updateLeadNotes, getLeadDetails. |
| **routes/bookings.js** | my-bookings, next-eligible-date, POST /, DELETE /:id: add `authorizeRole(['customer','receptionist'])`, `requireCanBookMediaDay`, `resolveEffectiveCustomerId`; in handlers use `req.effectiveCustomerId` instead of `req.user._id` (Booking.find, getNextEligibleDate, checkBookingEligibility, new Booking, User.findById for email, `booking.customer` check in DELETE). GET /accepted: add `allowBookingAccess` after `authenticateToken`. |
| **routes/blockedDates.js** | GET /: add `allowBookingAccess` after `authenticateToken`. |
| **routes/customerNotifications.js** | unread-counts, mark-read, mark-all-read: `authorizeRole('customer')` → `authorizeRole(['customer','receptionist'])`, add `resolveEffectiveCustomerId`; in handlers replace every `req.user._id` used as customerId with `req.effectiveCustomerId` (unread-counts: findOne, new CustomerNotification, MetaLead.countDocuments, CallLog.countDocuments; mark-read: findOne/new in callLogs branch and in main branch; mark-all-read: findOne, new). **Note:** mark-read’s `metaLeads` branch returns early and does not use customerId; no change there. |
| **routes/customers.js** | GET /profile: 404 condition to allow `receptionist`; when `role === 'receptionist'` and `parentCustomerId`, load parent, build response with parent’s `bookingIntervalMonths`. Insert the 4 receptionist routes **after** POST / (≈ line 126) and **before** DELETE /:id (≈ line 128). DELETE /:id: in cleanup, add `User.deleteMany({ parentCustomerId: id, role: 'receptionist' })`. |
| **routes/customers.js** | GET /profile uses `User.findById(req.user.id)`. `authenticateToken` sets `req.user._id` from `req.user.id`; both exist. |

### 16.3 customers.js route order and DELETE cleanup

- Current order: GET /profile, GET /, POST /, DELETE /:id, PUT /:id, PUT /profile, GET /:id/portal-visibility, PUT /:id/portal-visibility, PATCH /:id/facebook-disconnect.
- Insert: `GET /:customerId/receptionists`, `POST /:customerId/receptionists`, `PATCH /:customerId/receptionists/:receptionistId`, `DELETE /:customerId/receptionists/:receptionistId` between POST / and DELETE /:id. No conflict with GET /:id/portal-visibility (different path suffix).

### 16.4 Booking model vs customers.js delete

- **Booking** schema: `customer` (ObjectId ref User). No `customerId`.
- **customers.js** delete uses `Booking.deleteMany({ customerId })`, which does not match. Out of scope; fix separately with `{ customer: customerId }` if desired.

### 16.5 Frontend – files and patterns

| File | What to change |
|------|----------------|
| **Login.tsx** | handleSubmit: add `else if (user.role === "receptionist")` with customerToken/customerData (include `parentCustomerId`, `canBookMediaDay`), navigate: leadId → meta-leads, returnUrl → returnUrl, else → meta-leads. useEffect (customerToken + validate): when no leadId/returnUrl, use `customerData` from localStorage; if `role === 'receptionist'` → `/customer/meta-leads`, else → `/customer/dashboard`. |
| **CustomerPortalLayout.tsx** | Parse `customerData` from localStorage; compute `allowedPages`, `currentPageKey`, `firstAllowed`; route guard with `<Navigate to={firstAllowed} replace />` when `allowedPages` is array and `currentPageKey` not in it; pass `allowedPages` to `CustomerSidebar`. |
| **CustomerSidebar.tsx** | Props: `allowedPages?: string[] | null`. Derive `pageKey` as `item.path.replace(/^\/customer\/?/, '')`; if `allowedPages != null`, filter each of mainActionsItems, marketingInsightsItems, trackingItems to `allowedPages.includes(pageKey)`; render a section only if its filtered list is non‑empty. |
| **CustomerManagementLogic.tsx** | State: `receptionists`, `addReceptionistModal`, `receptionistForm`. In `handleEditClick`: after `setEditFormData`/`setEditModalOpen`, call `GET /customers/${customer._id}/receptionists` and `setReceptionists`. Handlers: `handleAddReceptionist`, `handleRemoveReceptionist`, optionally `handleEditReceptionist`. Return these from the hook. |
| **CustomerManagementPage.tsx** | In Edit modal, after the main form (after bookingIntervalMonths select) and before the Cancel/Save div: Receptionists block (list with Add/Edit/Remove, Add Receptionist modal with name, username, email, password, canBookMediaDay). |

### 16.6 API base paths (server.js)

- `/api/customers` → customers.js (profile, receptionist CRUD).
- `/api/customer-notifications` → customerNotifications.js.
- `/api/bookings` → bookings.js.
- `/api/blocked-dates` → blockedDates.js.
- `/api/meta-leads` → metaLeads.js.

All of the above match the plan and verification. No further code changes are required for the verification to be accurate.
