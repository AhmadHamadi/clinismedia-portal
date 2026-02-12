# Files changed for Meta Leads (this conversation)

All edits were in these files only. Nothing else was touched.

## Backend

| File | What changed |
|------|----------------|
| **backend/controllers/metaLeadsController.js** | Added `normalizeSubjectForMapping()` and use it when **creating** and **updating** subject mappings (so stored subject matches incoming email format). Added `testSubject()` for GET `/admin/test-subject`. |
| **backend/services/metaLeadsEmailService.js** | Log when IMAP connects; log summary after each check ("X emails found, Y leads created"); added `testSubjectMatch()` for the test-subject API. Comment tweak for config. |
| **backend/routes/metaLeads.js** | New route: `GET /admin/test-subject?subject=...` (admin only). |
| **backend/.env** | Comments only: Meta Leads section explaining leads@clinimedia.ca and optional LEADS_EMAIL_* (no new variables set). |
| **backend/scripts/checkLeadsEmailConfig.js** | Comment only (same config as service). |

## Frontend

| File | What changed |
|------|----------------|
| **frontend/src/components/Admin/MetaLeadsManagementPage.tsx** | "Test subject line" input + Test button; "Check Emails Now" now shows the result (emails found, leads created) in the alert. |

## Docs (new/updated)

| File | What changed |
|------|----------------|
| **docs/META_LEADS_REVIEW.md** | Full review + troubleshooting. |
| **docs/META_LEADS_VERIFICATION.md** | Verification checklist. |
| **docs/META_LEADS_FILES_CHANGED.md** | This file. |

---

**Not changed:**  
`MetaLead` model, `metaLeads` routes (except adding one GET), customer `MetaLeadsPage`, auth, sessionManager, server startup, or how IMAP credentials are read. Subject **matching** logic in `findCustomerBySubject` was not changed (only how we **save** new/updated mappings).
