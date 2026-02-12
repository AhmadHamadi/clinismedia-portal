# Meta Leads – Full Review

## Where leads appear for the customer

**Leads assigned to a clinic (by subject or folder mapping) appear on that customer’s Meta Leads page.**  
That’s the **Customer portal → Meta Leads** page: the one with the “Recent Leads” table, stats (Total Leads, Contacted, Not Contacted, Appointments), date/status filters, and the “Manage” action per lead. Each customer only sees leads that belong to their clinic.

---

## 1. Who can “send” leads?

**Nobody in the portal sends leads.** The flow is:

- **Facebook/Meta** sends lead notification emails when someone submits a lead form on a clinic’s Facebook/Instagram ad.
- Those emails are sent **to** `leads@clinimedia.ca` (by Meta’s servers).
- The **backend** connects to that mailbox via **IMAP**, reads **UNSEEN** emails, and creates **MetaLead** records in the database.
- Customers and receptionists only **view and update** leads (status, notes, appointment) in the portal; they do not send anything to the leads inbox.

So: **only Meta/Facebook sends emails to the leads address.** The portal only reads from it and displays/updates data.

---

## 2. Connection to leads@clinimedia.ca

### How it’s configured

- **Service:** `backend/services/metaLeadsEmailService.js`
- **Inbox:** Uses IMAP (port 993, TLS) to connect to the **leads** mailbox.
- **Defaults (if not set in .env):**
  - `LEADS_EMAIL_USER` → `leads@clinimedia.ca`
  - `LEADS_EMAIL_PASS` → uses `EMAIL_PASS` or `EMAIL_PASSWORD`
  - `LEADS_EMAIL_HOST` → uses `EMAIL_HOST` or `mail.clinimedia.ca`
  - `LEADS_EMAIL_IMAP_PORT` → `993`

### Your current .env

- `EMAIL_HOST=mail.clinimedia.ca`
- `EMAIL_USER=notifications@clinimedia.ca`
- `EMAIL_PASS=Clini$Media@2025`
- **No** `LEADS_EMAIL_USER`, `LEADS_EMAIL_PASS`, or `LEADS_EMAIL_HOST` are set.

So in practice the app uses:

- **User:** `leads@clinimedia.ca` (default)
- **Password:** `EMAIL_PASS` (set)
- **Host:** `mail.clinimedia.ca` (set)

So you **are** effectively connected to the same mail host as notifications; the leads mailbox is assumed to be `leads@clinimedia.ca` with the same password as in `EMAIL_PASS`.

### Important checks

1. **Correct address**  
   If the real mailbox is **leads@clinismedia.ca** (with an “s” in “clinismedia”), then set in `.env`:
   ```env
   LEADS_EMAIL_USER=leads@clinismedia.ca
   ```
   Otherwise the default `leads@clinimedia.ca` is used.

2. **Separate password for leads**  
   If the leads mailbox has a different password, set:
   ```env
   LEADS_EMAIL_PASS=your_leads_mailbox_password
   ```

3. **Verify IMAP**  
   From the backend folder run:
   ```bash
   node scripts/checkLeadsEmailConfig.js
   ```
   This checks IMAP login and inbox access for the leads mailbox.

---

## 3. Subject and folder logic (who gets which lead)

### Assignment order

1. **Folder (IMAP folder) first**  
   If the email is in a folder that has a **Folder Mapping** in Admin → Manage Meta Leads (e.g. “Burlington Dental Centre” → Clinic A), that clinic gets the lead.

2. **Subject line fallback**  
   If there’s no folder match (e.g. email in INBOX), the **Subject Mapping** is used: the email subject is matched (exact, then case‑insensitive, then partial) to a mapping; the linked clinic gets the lead.

3. **No match**  
   If neither folder nor subject matches any mapping, **no lead is created** and the email stays **unread** so it can be retried after an admin adds a mapping.

### Who can configure this

- **Admin only:**  
  - Subject Mappings (email subject → clinic)  
  - Folder Mappings (IMAP folder name → clinic)  
  - “Check Emails Now” (manual run of the same IMAP check the job does)

- **Customers and receptionists** cannot add or edit subject/folder mappings; they only see and update leads for their clinic.

---

## 4. Who can see the Meta Leads page and what they see

| Role           | Page / API access | What they see |
|----------------|-------------------|----------------|
| **Customer**   | Customer portal → “Meta Leads” | Only leads assigned to **their** clinic (`effectiveCustomerId` = their user id). |
| **Receptionist** | Same “Meta Leads” page | Only leads for the **parent clinic** (`effectiveCustomerId` = `parentCustomerId`). |
| **Admin**      | Admin → “Manage Meta Leads” | Subject mappings, folder mappings, “Check Emails Now”. Admin can also call API to get all leads (filterable by customer). |

- All customer-side Meta Leads API routes use:
  - `authenticateToken`
  - `authorizeRole(['customer','receptionist'])`
  - `resolveEffectiveCustomerId`  
  So receptionists always see the parent clinic’s leads, not other clinics.

---

## 5. Automatic email checking

- **On server start:** `metaLeadsEmailService.startMonitoring(intervalMinutes)` runs.
- **Interval:** From `META_LEADS_CHECK_INTERVAL` (minutes); default **3** (see `server.js`).
- **Lookback:** Last **7 days** of UNSEEN emails (so brief downtime doesn’t skip leads).
- **Deduplication:** By `emailMessageId` so the same email doesn’t create duplicate leads.

So yes: the app is built to stay connected to the leads mailbox by polling it every few minutes (and optionally when admin clicks “Check Emails Now”).

---

## 6. Summary checklist

| Item | Status |
|------|--------|
| Portal sends leads to leads@… | No – only Meta sends emails to that address. |
| Backend reads from leads@… | Yes – IMAP to `LEADS_EMAIL_USER` / `EMAIL_HOST` / `EMAIL_PASS` (or LEADS_* overrides). |
| Connected to leads@clinimedia.ca (or your configured address) | Yes, if that mailbox exists on `mail.clinimedia.ca` with the same (or LEADS_EMAIL_*) password and IMAP enabled. |
| Subject/folder logic | Folder first, then subject; only admins configure mappings. |
| Customers see only their leads | Yes – by `customerId` / `effectiveCustomerId`. |
| Receptionists see only parent clinic’s leads | Yes – `resolveEffectiveCustomerId` uses `parentCustomerId`. |
| Recommend setting `LEADS_EMAIL_USER` in .env if different from default | If your real address is e.g. leads@clinismedia.ca, set it explicitly. |
| Verify IMAP | Run `node scripts/checkLeadsEmailConfig.js` from `backend`. |

---

## 7. Troubleshooting: “No clients receiving leads”

### A. Verify IMAP connection to leads@clinimedia.ca

1. **Run the config check** (from `backend` folder):
   ```bash
   node scripts/checkLeadsEmailConfig.js
   ```
   - If it fails: fix `LEADS_EMAIL_USER`, `LEADS_EMAIL_PASS` (or `EMAIL_PASS`), `LEADS_EMAIL_HOST` in `.env`. The **leads** mailbox may have a **different password** than `notifications@`; if so, set `LEADS_EMAIL_PASS=...` for the leads inbox.
   - If it succeeds: the server can log in; next check is subject matching and UNSEEN emails.

2. **Check server logs** when the backend runs:
   - You should see: `[Meta Leads] Connected to leads@clinimedia.ca (IMAP)...` when a check runs.
   - After each check: `[Meta Leads] Check done: X email(s) found, Y lead(s) created.`
   - If you see **Connection failed** or **ECONNREFUSED / ETIMEDOUT**: wrong host/port, or firewall, or wrong credentials.

### B. Subject line must match what you set in Manage Meta Leads

- Leads are assigned **by subject line** when the email is in a folder with no folder mapping (e.g. INBOX). The subject is **normalized** (whitespace collapsed, trim).
- **Use “Test subject line”** on Admin → Manage Meta Leads: paste the **exact subject** from a real Facebook lead email. If it says “No mapping”, add (or edit) a **Subject Mapping** so the stored subject matches. New mappings are stored normalized so they match incoming emails.
- If Facebook sends e.g. `CliniMedia - Burlington Dental Leads` and your mapping is `CliniMedia - Burlington Dental Centre Leads`, it won’t match. Copy the subject from a real email and add that as the mapping (or use Test to see the normalized form).

### C. Emails must be UNSEEN

- The service only processes **UNSEEN** emails. If you or someone opened them in webmail, they’re marked SEEN and won’t be picked up.
- To reprocess old emails you’d need to mark them unread in webmail, then click **Check Emails Now**, or add a separate “process all” path (not implemented by default).

### D. Summary checklist when no one receives leads

| Check | Action |
|-------|--------|
| IMAP login | Run `node scripts/checkLeadsEmailConfig.js`; fix credentials/host if it fails. |
| Separate leads password | If leads@ has its own password, set `LEADS_EMAIL_PASS` in `.env`. |
| Subject matches | Use “Test subject line” on Manage Meta Leads; add/fix subject mapping to match. |
| Stored subjects normalized | New/updated subject mappings are stored with normalized whitespace so they match. |
| Server logs | Look for `[Meta Leads] Check done: X email(s) found, Y lead(s) created` and any errors. |
| Check Emails Now | Use the button and check the alert (emails found vs leads created); check server log for “No subject mapping for …”. |
