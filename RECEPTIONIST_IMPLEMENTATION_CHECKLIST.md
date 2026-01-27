# Receptionist Implementation Checklist

This document summarizes the **Add Receptionist** feature: admins create receptionists linked to a customer (`parentCustomerId`). Receptionists log in via the customer portal and see **Meta Leads** always, and **Media Day Booking** only when `canBookMediaDay` is true. All customer-scoped data uses `req.effectiveCustomerId` (parent for receptionist, self for customer).

---

## Backend

### Model

| File | Change |
|------|--------|
| `backend/models/User.js` | `role` enum includes `receptionist`; `parentCustomerId` (ObjectId, ref User, optional); `canBookMediaDay` (Boolean, default false); `location` required only when `role === 'customer'`. |

### Auth

| File | Change |
|------|--------|
| `backend/controllers/authController.js` | Login: JWT payload includes `id`, `role`, `name`; for `role === 'receptionist'` also `parentCustomerId` and `canBookMediaDay`. `user` response same. |
| `backend/routes/auth.js` | `GET /validate`: for `role === 'receptionist'`, response includes `parentCustomerId` and `canBookMediaDay`; `id` from `req.user._id \|\| req.user.id`. |

### Middleware

| File | Purpose |
|------|---------|
| `backend/middleware/resolveEffectiveCustomerId.js` | `req.effectiveCustomerId = req.user.parentCustomerId \|\| req.user._id \|\| req.user.id`; 403 if receptionist and no `parentCustomerId`. Use after `authorizeRole(['customer','receptionist'])`. |
| `backend/middleware/requireCanBookMediaDay.js` | 403 if `role === 'receptionist'` and `canBookMediaDay !== true`. Use after `authorizeRole` and before `resolveEffectiveCustomerId` on booking routes. |
| `backend/middleware/allowBookingAccess.js` | Allows admin, customer, employee; or receptionist with `canBookMediaDay === true`. Used for `GET /blocked-dates` and `GET /bookings/accepted`. |

> **JWT / `req.user`:** `authenticateToken` decodes the JWT and sets `req.user`. For receptionist, login puts `parentCustomerId` and `canBookMediaDay` in the JWT, so `req.user` has them. `authorizeRole` supports `['customer','receptionist']` via `roles.includes(req.user.role)`.

### Meta Leads

| Route | Middleware | Controller |
|-------|------------|------------|
| `GET /meta-leads/customer/leads` | `authorizeRole(['customer','receptionist'])`, `resolveEffectiveCustomerId` | `req.effectiveCustomerId` |
| `GET /meta-leads/customer/stats` | same | same |
| `GET /meta-leads/customer/leads/:leadId` | same | same |
| `PATCH /meta-leads/customer/leads/:leadId/status` | same | same |
| `PATCH /meta-leads/customer/leads/:leadId/appointment` | same | same |
| `PATCH /meta-leads/customer/leads/:leadId/notes` | same | same |

All six customer methods in `metaLeadsController.js` use `req.effectiveCustomerId`.

### Bookings

| Route | Middleware | Notes |
|-------|------------|-------|
| `GET /bookings/my-bookings` | `authorizeRole(['customer','receptionist'])`, `requireCanBookMediaDay`, `resolveEffectiveCustomerId` | Uses `req.effectiveCustomerId` |
| `GET /bookings/next-eligible-date` | same | same |
| `POST /bookings` | same | same |
| `DELETE /bookings/:id` | same | same; checks `booking.customer` equals `effectiveCustomerId` |
| `GET /bookings/accepted` | `allowBookingAccess` | Read‑only; no customer scoping |
| `GET /bookings/available-dates` | `authorizeRole(['customer','receptionist'])`, `requireCanBookMediaDay` | Global unavailable dates; no `resolveEffectiveCustomerId` |
| `GET /blocked-dates` | `allowBookingAccess` | Same as `/accepted` |

### Customer Notifications

| Route | Middleware | Notes |
|-------|------------|-------|
| `GET /customer-notifications/unread-counts` | `authorizeRole(['customer','receptionist'])`, `resolveEffectiveCustomerId` | Uses `req.effectiveCustomerId` |
| `POST /customer-notifications/mark-read/:section` | same | same |
| `POST /customer-notifications/mark-all-read` | same | same |
| `POST /customer-notifications/increment/:customerId/:section` | `authorizeRole('admin')` | Unchanged |

### Customers

| Route | Change |
|-------|--------|
| `GET /customers/profile` | Customer: return as-is. Receptionist with `parentCustomerId`: load parent, set `bookingIntervalMonths` and `parentName` on profile. |
| `PUT /customers/profile` | Receptionist: only `{ name, email, address }`; no `location` or `bookingIntervalMonths`. |
| `GET /customers/:customerId/receptionists` | Admin: list receptionists for customer. |
| `POST /customers/:customerId/receptionists` | Admin: create receptionist (name, username, email, password, canBookMediaDay). |
| `PATCH /customers/:customerId/receptionists/:receptionistId` | Admin: update name, username, email, canBookMediaDay; optional password (only if non‑empty). |
| `DELETE /customers/:customerId/receptionists/:receptionistId` | Admin: delete receptionist. |
| `DELETE /customers/:id` | Also `User.deleteMany({ parentCustomerId: customerId, role: 'receptionist' })`; `Booking.deleteMany({ customer: customerId })` (field is `customer`). No `BlockedDate.deleteMany` (BlockedDate has no `customerId`). |

---

## Frontend

### Login & Auth

| File | Change |
|------|--------|
| `frontend/src/components/Login.tsx` | Customer and receptionist: `customerToken` and `customerData`. Receptionist default redirect `/customer/meta-leads`; “already logged in” uses `customerData.role === 'receptionist'` → `/customer/meta-leads`, else `/customer/dashboard`. |
| `frontend/src/utils/auth.ts` | `getCurrentUser()` keeps `role` from `customerData` (`role: u.role \|\| 'customer'`). |

### Customer Portal Layout & Sidebar

| File | Change |
|------|--------|
| `CustomerPortalLayout.tsx` | On mount: if `customerToken`, call `GET /auth/validate`; merge `role`, `canBookMediaDay`, `parentCustomerId` into `customerData`. `allowedPages`: receptionist → `['meta-leads']` and, if `canBookMediaDay`, `['media-day-booking']`; customer → `null` (all). Route guard redirects when `pageKey` not in `allowedPages`. Passes `allowedPages` to `CustomerSidebar`. |
| `CustomerSidebar.tsx` | `allowedPages` prop; `filterItems()` filters nav by `allowedPages`; sections hidden when empty. QuickBooks unpaid: use `parentCustomerId` when `role === 'receptionist'`. |

### Customer Management (Admin)

| File | Change |
|------|--------|
| `CustomerManagementLogic.tsx` | `fetchReceptionists` on edit; `handleAddReceptionist`, `handleRemoveReceptionist`, `handleEditReceptionistClick`, `handleEditReceptionistSubmit`; PATCH sends `password` only when non‑empty. Returns `editingReceptionist`, `setEditingReceptionist`, and all receptionist-related state/handlers. |
| `CustomerManagementPage.tsx` | Edit Customer: Receptionists block (list, Add / Edit / Remove). Add Receptionist: name, username, email, password, canBookMediaDay. Edit Receptionist: name, username, email, password (“leave blank to keep current”), canBookMediaDay. |

### Route Protection

| File | Note |
|------|------|
| `ProtectedRoute.tsx` | For `requiredRole="customer"`, checks `customerToken` and `/auth/validate`. Does not check decoded role; receptionists with `customerToken` pass. |
| `App.tsx` | `/customer/*` uses `ProtectedRoute requiredRole="customer"`; no change. |

---

## Manual Verification

1. **Receptionist with `canBookMediaDay: false`**  
   - Only Meta Leads in sidebar and route guard; Media Day 403 and hidden.

2. **Receptionist with `canBookMediaDay: true`**  
   - Meta Leads + Media Day; `/blocked-dates`, `/bookings/my-bookings`, `next-eligible-date`, `accepted`, `POST`, `DELETE` work with `effectiveCustomerId`.

3. **Admin**  
   - In Edit Customer: receptionist CRUD; optional password in Edit; DELETE customer also deletes linked receptionists.

4. **`GET /auth/validate` and `CustomerPortalLayout`**  
   - After admin changes `canBookMediaDay`, reloading or re‑entering the customer portal should update `allowedPages` without re‑login (validate merges into `customerData` on mount).

---

## How to Run Manual Verification

**Prerequisites:** Backend and frontend running (e.g. `node server.js` in `backend/`, `npm run dev` in `frontend/`). `VITE_API_BASE_URL` must point to your backend (e.g. `http://localhost:5000/api`).

**Create a test receptionist (optional):** From `backend/`, run  
`node scripts/seedReceptionist.js <customerUsername> <name> <username> <email> <password> [y|n]`  
(e.g. `node scripts/seedReceptionist.js acmeclinic "Jane Doe" jane.recep jane@example.com secret123 y`). `y` = can book Media Day, `n` or omit = leads only. Use `--help` for full usage.

### 1. Admin: Receptionist CRUD

1. Log in as **admin** at `/login`.
2. Go to **Customer Management** (or the page that lists customers).
3. **Edit** an existing customer.
4. In the **Receptionists** block:
   - **Add:** Click "Add Receptionist", fill name, username, email, password; leave **Can book Media Day** unchecked → save. Then add a second with it **checked**.
   - **List:** Confirm both appear (e.g. "Leads only" vs "Media day").
   - **Edit:** Edit the "Leads only" one; check **Can book Media Day**, optionally change password; save. Reload Edit modal and confirm the change.
   - **Remove:** Remove one receptionist; confirm it disappears.
5. **DELETE customer:** Delete a customer that has receptionists; confirm linked receptionists are gone (e.g. in DB or by 404 on their login).

### 2. Receptionist with `canBookMediaDay: false` (Leads only)

1. Log out. Log in with a receptionist that has **Can book Media Day** unchecked.
2. You should be redirected to **Meta Leads** (`/customer/meta-leads`).
3. **Sidebar:** Only **Meta Leads** in TRACKING; Dashboard, Media Day, and other sections hidden.
4. Manually go to `/customer/media-day-booking` → you should be redirected to `/customer/meta-leads` by the route guard.
5. If you can trigger a direct API call to `POST /bookings` (e.g. via DevTools or another client), it should return **403** (requireCanBookMediaDay).

### 3. Receptionist with `canBookMediaDay: true`

1. Log in with a receptionist that has **Can book Media Day** checked.
2. **Sidebar:** **Meta Leads** and **Media Day Calendar** (and any other `allowedPages`).
3. Open **Media Day Calendar**; it should load (my-bookings, next-eligible-date, blocked-dates, accepted, POST, DELETE all use `effectiveCustomerId` or allowBookingAccess).
4. Create a booking as that receptionist; it should be associated with the **parent customer**, not the receptionist’s own `_id`.

### 4. Validate / `canBookMediaDay` update without re‑login

1. As **admin**, Edit the customer and **uncheck** "Can book Media Day" for a receptionist who currently has it.
2. As that **receptionist**, stay in the customer portal (or close and reopen the tab) and **reload** the page. CustomerPortalLayout calls `GET /auth/validate` on mount and merges `canBookMediaDay` into `customerData`.
3. **Media Day** should disappear from the sidebar and navigating to `/customer/media-day-booking` should redirect to Meta Leads.
4. (Optional) Admin checks "Can book Media Day" again; receptionist reloads → Media Day reappears.

---

## Optional / Notes

- **`GET /auth/validate` `name`:** JWT now includes `name` at login, so `req.user.name` is set and validate returns it.
- **`GET /bookings/available-dates`:** Allows `['customer','receptionist']` with `requireCanBookMediaDay`. The current Media Day UI uses `GET /blocked-dates` and `GET /bookings/accepted`; if another flow uses `available-dates`, it will work for receptionists with `canBookMediaDay`.
