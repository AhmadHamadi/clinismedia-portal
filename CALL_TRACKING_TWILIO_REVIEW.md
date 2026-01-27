# Call Tracking & Twilio – Line-by-Line Review

This document is a detailed review of all call-tracking and Twilio logic in the codebase.

---

## 1. Models

### 1.1 CallLog (`backend/models/CallLog.js`)

| Field | Type | Notes |
|-------|------|--------|
| `customerId` | ObjectId, required, index | **Clinic (customer) that owns the Twilio number.** Resolved from `User` where `twilioPhoneNumber` = called number. |
| `twilioPhoneNumber` | String, required, index | The Twilio number that was called (`To` from Twilio). |
| `callSid` | String, required, unique, index | Twilio Call SID. |
| `from`, `to` | String, required | Caller and called number. |
| `direction` | enum `inbound` \| `outbound` | Default `inbound`. |
| `status` | String, required, index | Twilio CallStatus: `ringing`, `in-progress`, `completed`, etc. |
| `dialCallStatus` | enum \| null | **Whether the clinic answered:** `answered`, `no-answer`, `busy`, `failed`, `canceled`. Set by dial-status (authoritative), status-callback (fallback), recording-status, ci-status, voicemail. |
| `duration` | Number | Seconds. **Answered only:** 0 for missed. Minimum 1 when `dialCallStatus === 'answered'`. |
| `menuChoice` | `'1'` \| `'2'` \| null | 1 = new patient, 2 = existing. From `<Gather>`. |
| `startedAt`, `endedAt` | Date | `startedAt` default `Date.now`; `endedAt` when finished. |
| `recordingUrl`, `recordingSid` | String \| null | **Main call** when `record-from-answer`; for **voicemail-only** calls, `recordingSid` is reused for the voicemail recording (voicemail-status sets it). |
| `callerName`, `callerCity`, `callerState`, `callerZip`, `callerCountry` | String \| null | From Twilio `CallerName`, `FromCity`, etc. |
| `qualityMetrics` | `{ jitter, packetLoss, latency, audioQuality }` | From status-callback when present. |
| `price`, `priceUnit` | Number, String | From status-callback. |
| `ringingDuration`, `answerTime` | Number, Date | When clinic answered. |
| `transcriptUrl`, `transcriptSid`, `transcriptText` | String \| null | Legacy; CI uses `transcriptSid` for lookup. |
| `summaryText`, `summaryReady` | String, Boolean | **Conversational Intelligence** summary; `summaryReady` used to know when to run appointment detection. |
| `voicemailUrl`, `voicemailDuration` | String, Number \| null | Set by voicemail-status. For playback, voicemail uses `recordingSid` (overloaded for voicemail SID when voicemail-only). |
| `appointmentBooked` | Boolean \| null | `true` = yes, `false` = no, `null` = not analyzed. From CI summary via OpenAI or keyword fallback. |

**Indexes:** `{ customerId: 1, startedAt: -1 }`, `{ twilioPhoneNumber: 1, startedAt: -1 }`.

---

### 1.2 User – Twilio fields (`backend/models/User.js`)

| Field | Purpose |
|-------|---------|
| `twilioPhoneNumber` | Twilio number owned by the clinic (e.g. `+1…`). |
| `twilioForwardNumber` | Default/legacy forward. |
| `twilioForwardNumberNew` | Forward when menu `1` (new patient). |
| `twilioForwardNumberExisting` | Forward when menu `2` (existing). |
| `twilioMenuMessage` | Custom IVR message; else default with clinic name. |
| `twilioVoice` | TTS voice; validated against `VALID_TWILIO_VOICES`, else `TTS_VOICE`. |

---

### 1.3 CustomerNotification – callLogs (`backend/models/CustomerNotification.js`)

```js
callLogs: { lastViewed: Date | null }
```

- **Unread count:** `CallLog.countDocuments({ customerId, startedAt: { $gt: lastViewed } })` if `lastViewed` set; else count all for `customerId`.
- **Mark read:** `mark-read/callLogs` sets `callLogs.lastViewed = new Date()`.

---

## 2. Twilio Routes (`backend/routes/twilio.js`)

### 2.1 Auth & config

- **Credentials:** `getTwilioCredentials()` prefers `TWILIO_API_KEY_SID` + `TWILIO_API_KEY_SECRET`, else `TWILIO_AUTH_TOKEN`. API and CI helpers retry with Auth Token on 401/403 when using API Key.
- **Voice:** `TTS_VOICE = 'Google.en-US-Chirp3-HD-Aoede'`. `validateAndGetVoice()` only allows that; anything else is replaced by `TTS_VOICE`.

---

### 2.2 Webhooks (no `authenticateToken`; called by Twilio)

#### POST `/api/twilio/voice/incoming`

- **Role:** Resolve clinic from `To`, play IVR (if `TWILIO_ENABLE_MENU`), forward, optional recording/transcription, create/update `CallLog`.
- **Clinic lookup:** `User.findOne` with:
  - `twilioPhoneNumber` in: `normalizedTo`, `To`, `normalizedTo.replace(/^\+/,'')`, `To.replace(/^\+/,'')`;
  - then `twilioPhoneNumber: { $regex: toWithoutCountry }` (`To` without `+1`).
- **Requirement:** At least one of `twilioForwardNumber`, `twilioForwardNumberNew`, `twilioForwardNumberExisting`.
- **CallLog:** `CallSid` → `findOneAndUpdate( { callSid }, logData, { upsert: true } )`.  
  `logData`: `customerId: clinic._id`, `twilioPhoneNumber: To`, `from`, `to`, `direction: 'inbound'`, `status`, `startedAt`; `menuChoice` if `Digits`.
- **TwiML:** If menu: first `Gather` (menu), on Digits: disclosure (if recording/transcription), `<Start><Transcription>` (if `TWILIO_VI_SERVICE_SID`), `<Dial>` with `record`, `recordingStatusCallback`, `statusCallback` (dial-status), `action` (voicemail on timeout).  
  If no menu: same minus `Gather`, straight to disclosure + transcription + `Dial`.

---

#### POST `/api/twilio/voice/status-callback`

- **Role:** Update `CallLog` with status, duration, caller/quality/price, `dialCallStatus` when `DialCallStatus` not yet set (fallback).
- **Clinic:** `User.findOne({ twilioPhoneNumber: To, role: 'customer' })` **only** (no multi-format like incoming).  
  ⚠️ **Gap:** If Twilio sends `To` in a different format than stored (e.g. `+1` vs `1`), clinic can be missed → `"No clinic found"`, no DB update. **Recommendation:** reuse the same multi-format logic as `/voice/incoming` or at least normalize `To` the same way.
- **dialCallStatus fallback (when missing):**
  - If `DialCallStatus`: `answered` → `dialCallStatus: 'answered'`, duration from `DialCallDuration` or `CallDuration` or 1; `completed` + previously `answered` → keep `answered`; `completed` and never `answered` → `no-answer`, duration 0; `no-answer`/`busy`/`failed`/`canceled` → same, duration 0.
  - If no `DialCallStatus` and `CallStatus` in `completed|failed|busy|no-answer|canceled` → `dialCallStatus: 'no-answer'` (or status), duration 0.
- **If `dialCallStatus` already set:** do not overwrite; only adjust `duration` if it was 0 for an answered call.
- **Other updates:** `menuChoice` preserved; `FromCity/State/Zip/Country`, `CallerName`; `qualityMetrics`; `price`; `startedAt` on `ringing`/`initiated`; `endedAt` on terminal status.

---

#### POST `/api/twilio/voice/dial-status`

- **Role:** **Authoritative** source for `dialCallStatus` and `duration` when `Dial` is used.
- **CallSid:** `ParentCallSid || CallSid`.
- **Overrides:**
  - If `recordingSid` or (`summaryText` and `summaryReady`) → `dialCallStatus: 'answered'`, duration ≥ 1.
  - Else if voicemail (no recording/summary and `voicemailUrl` or `dialCallStatus === 'no-answer'` with `voicemailDuration`) → `no-answer`, duration 0.
  - Else `DialCallStatus`: `answered` → `answered`, duration from `DialCallDuration` or 1; `completed` + previously `answered` → `answered`; `completed` and never `answered` → `no-answer`, duration 0; `no-answer`/`busy`/`failed`/`canceled` → same, duration 0.
- **menuChoice** preserved.

---

#### GET `/api/twilio/voice/voicemail` (query `CallSid`)

- **Role:** When `Dial` times out → play voicemail `Record` TwiML. If `DialCallStatus === 'answered'` → `<Hangup/>` (no voicemail).
- **Else:** If no `recordingSid` and no `summaryText`/`summaryReady`, set `dialCallStatus: 'no-answer'`. Then TwiML with `<Record>` and `voicemail-status` as `recordingStatusCallback`.

---

#### POST `/api/twilio/voice/voicemail-status`

- **Role:** Persist voicemail `RecordingUrl`, `RecordingDuration`, and **`recordingSid: RecordingSid`** for the voicemail.  
  For **voicemail-only** calls, `recordingSid` is the voicemail’s SID; `/voicemail/:callSid` uses it for playback. For answered calls, `recording-status` sets main `recordingSid`; voicemail flow does not run, so no overwrite.
- **dialCallStatus:** If no main `recordingSid` and no `summaryText`/`summaryReady` → `no-answer`, duration 0. If recording or summary exists → keep/preserve `answered`.

---

#### POST `/api/twilio/voice/recording-status`

- **Role:** Main call recording (`record-from-answer`). `RecordingSid` → `recordingSid`, `recordingUrl`; `dialCallStatus: 'answered'` if not already; duration from `RecordingDuration` when `RecordingStatus === 'completed'`, else keep or set 1 for answered.
- **CI:** If `TWILIO_ENABLE_TRANSCRIPTION` and `TWILIO_VI_SERVICE_SID` and `RecordingStatus === 'completed'`, call `createTranscriptFromRecording(RecordingSid)` and store `transcriptSid` and `summaryReady: false` for the CI webhook.

---

#### POST `/api/twilio/ci-status`

- **Role:** CI webhook when transcript is ready. `TranscriptSid` → `fetchConversationSummary` → `summaryText`, `summaryReady: true`, `detectAppointmentBooked(summary)` → `appointmentBooked`, and `dialCallStatus: 'answered'` (summary implies answered). Duration set to existing or 1.

---

### 2.3 AI & appointment detection

- **`detectAppointmentBookedWithAI`:** OpenAI `gpt-4o-mini`, YES/NO. Rate limit 2 req/min; on 429 or limit → returns `null` (fallback).
- **`detectAppointmentBookedWithKeywords`:** Negative phrases → `false`; positive → `true`; else `false`.
- **`detectAppointmentBooked`:** AI first; if `null`, keyword fallback.

---

### 2.4 Customer endpoints (require `authenticateToken`)

All of these use `req.user.id` and:

```js
const user = await User.findById(customerId);
if (!user || user.role !== 'customer') {
  return res.status(403).json({ error: 'Access denied. Customers only.' });
}
```

So **receptionists get 403** on every customer Twilio route.

| Route | Purpose | customerId | Receptionist |
|-------|---------|------------|--------------|
| **GET /call-logs** | List logs | `req.user.id` | 403 |
| **GET /call-logs/stats** | Stats | `req.user.id` | 403 |
| **GET /configuration** | Twilio config for clinic | `req.user.id` | 403 |
| **GET /recording/:recordingSid** | Stream main recording | `req.user.id`; `CallLog` by `recordingSid` + `customerId` | 403 |
| **GET /voicemail/:callSid** | Stream voicemail | `req.user.id`; `CallLog` by `callSid` + `customerId` + `voicemailUrl` exists; uses `callLog.recordingSid` (voicemail SID when voicemail-only) | 403 |
| **GET /call-logs/:callSid/summary** | Fetch summary | `req.user.id`; `CallLog` by `callSid` + `customerId` | 403 |
| **DELETE /call-logs** | Delete own logs | `req.user.id` | 403 |

Receptionists: `allowedPages` = `['meta-leads']` and optionally `['media-day-booking']`. **`call-logs` is not in `allowedPages`**, so they never get the Call Logs nav or page. The route guard would redirect `/customer/call-logs` to `meta-leads` (or `media-day-booking`).  
**Conclusion:** Call Logs are **customer-only by design**; receptionists do not have Call Logs access in UI or API.

---

### 2.5 Admin endpoints

- **GET /numbers**, **POST /connect**, **PATCH /update-message/:clinicId**, **PATCH /disconnect/:clinicId**: `authorizeRole('admin')`. Connect updates `User` and Twilio `VoiceUrl`/`StatusCallback` for the number.
- **DELETE /call-logs/:customerId**: `authorizeRole('admin')`; `CallLog.deleteMany({ customerId })`.
- **GET /test-credentials**, **GET /ai-status**: `authorizeRole('admin')`.

---

## 3. Customer notifications and callLogs

### 3.1 `GET /customer-notifications/unread-counts`

- **Auth:** `authorizeRole(['customer','receptionist'])`, `resolveEffectiveCustomerId` → `customerId = req.effectiveCustomerId`.
- **callLogs:**  
  - If `notification.callLogs.lastViewed` exists: `CallLog.countDocuments({ customerId, startedAt: { $gt: lastViewed } })`.  
  - Else: `CallLog.countDocuments({ customerId })`.

So **receptionists see the parent’s** callLogs unread count. They have no Call Logs page; the badge would only be visible if the dashboard (or another shared block) showed it. Receptionists are redirected away from dashboard, so in practice they do not see the callLogs badge.

---

### 3.2 `POST /customer-notifications/mark-read/:section`

- **callLogs:** `customerId = req.effectiveCustomerId`; ensure `CustomerNotification`; set `callLogs.lastViewed = new Date()` (create `callLogs` if needed).

---

### 3.3 `POST /customer-notifications/mark-all-read`

- **Logic:** Zeros `metaInsights`, `gallery`, `invoices`, `onboarding`, `instagramInsights` and their `lastUpdated`, and **callLogs.lastViewed**.  
- **Fixed.** Also sets `notification.callLogs.lastViewed = new Date()` (and creates `callLogs` if missing), so “Mark all read” clears the callLogs unread count.

---

## 4. Frontend

### 4.1 CallLogsPage

- **APIs:**  
  - `GET /twilio/call-logs` (params: `limit`, `offset`, `startDate`, `endDate`),  
  - `GET /twilio/call-logs/stats`,  
  - `GET /twilio/configuration`,  
  - `GET /twilio/recording/:recordingSid`,  
  - `GET /twilio/voicemail/:callSid` (when `voicemailUrl`),  
  - `GET /twilio/call-logs/:callSid/summary`,  
  - `DELETE /twilio/call-logs`.
- **On load:** `mark-read/callLogs` and `refreshCustomerNotifications`.  
- **Token:** `customerToken`. All above require `role === 'customer'` on backend, so only customers can use this page.

---

### 4.2 CustomerSidebar

- **callLogs:** `pageKey: "call-logs"`, `section: "callLogs"`. Filtered by `allowedPages`; receptionists do not have `call-logs`, so the Call Logs item is hidden.

---

### 4.3 CustomerDashPage

- **Tracking:** Call Logs and Meta Leads cards; `unreadCounts.callLogs`.  
- Receptionists are redirected from `/customer/dashboard`, so they do not see this.

---

### 4.4 CustomerPortalLayout

- **Routes:** `call-logs` → `CallLogsPage`.  
- **Clear badge:** `mark-read` is triggered for `metaInsights`, `gallery`, `invoices`, `onboarding`, `instagramInsights`, `metaLeads`, and `mark-all-read` on `notifications`. **No** `mark-read` for `callLogs` on route change; `CallLogsPage` does that on mount.

---

### 4.5 Admin TwilioManagement

- Uses `GET /twilio/numbers`, `POST /connect`, `PATCH /update-message/:clinicId`, `PATCH /disconnect/:clinicId`, and `DELETE /twilio/call-logs/:customerId` (admin only).

---

## 5. Flow summary

### Inbound call

1. **Twilio** → `POST /api/twilio/voice/incoming` (From, To, CallSid, Digits, CallStatus).
2. **Clinic:** `User` by `To` (multi-format). Require at least one forward number.
3. **CallLog:** `findOneAndUpdate` by `callSid` with `customerId`, `twilioPhoneNumber`, `from`, `to`, `direction`, `status`, `startedAt`, optional `menuChoice`.
4. **TwiML:** Menu (if enabled) → `Gather`; then disclosure + optional `<Start><Transcription>` + `<Dial>` with `record`, `recordingStatusCallback`, `statusCallback` (dial-status), `action` (voicemail).
5. **Twilio** → `POST /api/twilio/voice/status-callback` (and optionally dial-status) → `CallLog` updated: status, duration, `dialCallStatus` (fallback when dial-status has not set it), caller, quality, price, `endedAt`.
6. **Twilio** → `POST /api/twilio/voice/dial-status` → **authoritative** `dialCallStatus` and duration; overrides fallback when recording/summary or voicemail indicate answered vs missed.
7. **If Dial times out:** `GET /api/twilio/voice/voicemail` → `Record` → `POST /api/twilio/voice/voicemail-status` → `voicemailUrl`, `voicemailDuration`, `recordingSid` (voicemail), and `dialCallStatus: 'no-answer'` when no main recording/summary.
8. **If answered and recording on:** `POST /api/twilio/voice/recording-status` → `recordingSid`, `recordingUrl`, `dialCallStatus: 'answered'`, duration; if CI enabled, `createTranscriptFromRecording` and store `transcriptSid`.
9. **CI:** `POST /api/twilio/ci-status` with `TranscriptSid` → `fetchConversationSummary` → `summaryText`, `summaryReady`, `appointmentBooked`, `dialCallStatus: 'answered'`.

### Customer UI

- **Unread:** `unread-counts` uses `effectiveCustomerId`; callLogs = calls with `startedAt > lastViewed` (or all if no `lastViewed`).
- **Mark read:** `mark-read/callLogs` sets `callLogs.lastViewed`.  
- **Mark all read:** does **not** set `callLogs.lastViewed`.

---

## 6. Gaps and recommendations

| # | Item | Severity | Status |
|---|------|----------|--------|
| 1 | **status-callback clinic lookup** | Medium | **Fixed.** status-callback now uses the same multi-format `To`/normalization as `/voice/incoming`. |
| 2 | **mark-all-read and callLogs** | Low | **Fixed.** `mark-all-read` sets `callLogs.lastViewed` and initializes `callLogs` if missing. |
| 3 | **Receptionists and Call Logs** | N/A | By design, Call Logs are customer-only; receptionists have no `call-logs` in `allowedPages` and get 403 on all Twilio customer endpoints. Unread count uses `effectiveCustomerId`, but they never reach the Call Logs page. If product later wants receptionists to see Call Logs, add `call-logs` to `allowedPages` and switch the six customer Twilio routes to `authorizeRole(['customer','receptionist'])` + `resolveEffectiveCustomerId`, and use `req.effectiveCustomerId` instead of `req.user.id`. |

---

## 7. DB and IDs

- **CallLog.customerId** = clinic `User._id` (role `customer`), found via `twilioPhoneNumber` = `To`.
- **Receptionists:** `effectiveCustomerId = parentCustomerId` (same as that clinic `_id`). Unread count and `mark-read/callLogs` correctly use the parent’s `customerId`; they simply have no Call Logs UI/API access.

---

## 8. Environment

- **Twilio:** `TWILIO_ACCOUNT_SID`; `TWILIO_API_KEY_SID` + `TWILIO_API_KEY_SECRET` or `TWILIO_AUTH_TOKEN`; `TWILIO_VI_SERVICE_SID` for CI; `TWILIO_VI_SERVICE_SID` (and `TWILIO_ENABLE_TRANSCRIPTION`) for transcript-from-recording.
- **Flags:** `TWILIO_ENABLE_MENU`, `TWILIO_ENABLE_RECORDING`, `TWILIO_ENABLE_TRANSCRIPTION`.
- **OpenAI:** `OPENAI_API_KEY` for `appointmentBooked` (optional; keyword fallback if missing).
- **Backend URL:** `BACKEND_URL` or `RAILWAY_PUBLIC_DOMAIN` for webhooks.

---

*Review covers: `CallLog`, `User` Twilio fields, `CustomerNotification.callLogs`, `backend/routes/twilio.js`, `backend/routes/customerNotifications.js`, and frontend CallLogsPage, Sidebar, Dashboard, PortalLayout, Admin TwilioManagement.*
