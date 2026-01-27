# Context for ChatGPT: Appointment Booking Deduplication in Call Tracking

**Copy everything below the line into ChatGPT to get advice on our implementation.**

---

## 1. WHAT WE BUILT

We have a **call tracking system** for medical/dental clinics. Inbound calls hit a Twilio number, go through an IVR (option 1 = new patient, 2 = existing), get forwarded to the clinic, and are recorded. We use **Twilio Conversational Intelligence** to get a text summary of each call, then run **AI (OpenAI) + keyword fallback** to set a per-call flag: **`appointmentBooked`** = `true` / `false` / `null` (not analyzed).

**Problem we saw:** The same person (same phone number) called **twice in 2 minutes** (e.g. 12:25 and 12:27). Both calls were marked **"Booked"** because each call’s summary indicated an appointment was confirmed. Our **stats** were counting **2 appointments** when it was almost certainly the **same booking** (e.g. they called back to confirm or had a quick follow-up).

**What we implemented:** We changed how we **count** “Appointments Booked” in our **stats** (dashboard numbers). We did **not** change how we set `appointmentBooked` on each call.

---

## 2. OUR DEDUPLICATION RULE

**Stats (e.g. “Appointments Booked”, “New Patient Appointments Booked”):**

- **Before:** `count` of CallLogs where `appointmentBooked === true` (and for new-patient stats, also `menuChoice === '1'`).
- **After:** We count **unique `(from, hour)`** where `appointmentBooked === true`:
  - **`from`** = caller phone number (Twilio `From`, E.164, e.g. `+14379862011`).
  - **`hour`** = `YYYY-MM-DDTHH` from `startedAt` via MongoDB `$dateToString` (UTC).

So: **same number + 2+ “Booked” calls in the same hour = 1** in the count (e.g. 12:25 and 12:27 both Booked → 1). Different hours (e.g. 12:50 and 1:10) = 2.

**Per-call “Booked” in the table:** Unchanged. Each row still shows `appointmentBooked` from the AI/keyword logic. We only deduplicate in the **aggregate stats**.

---

## 3. RELEVANT CODE

### 3.1 CallLog model (MongoDB/Mongoose)

- **`from`**: string, **required** (caller number from Twilio).
- **`startedAt`**: Date, default `Date.now`, indexed.
- **`appointmentBooked`**: Boolean, default **null** (null = not analyzed, true = booked, false = not booked).
- **`menuChoice`**: `'1'` | `'2'` | null (1 = new patient, 2 = existing).
- **`customerId`**: ObjectId (clinic). Stats are always scoped to one `customerId` and optional `startDate` / `endDate` on `startedAt`.

### 3.2 How `appointmentBooked` is set (per call, we did NOT change this)

- **Source:** Twilio Conversational Intelligence gives us a **text summary** of the call.
- **`detectAppointmentBooked(summary)`:**
  1. **Primary:** OpenAI `gpt-4o-mini`, prompt: did the call result in an appointment **confirmed/scheduled/booked**? YES/NO. Rate limited (e.g. 2/min); on 429 or limit → returns `null` → we use keyword fallback.
  2. **Fallback:** Keyword rules:
     - **Negative phrases** (e.g. “fully booked”, “no availability”, “will call back”) → `false`.
     - **Positive phrases** (e.g. “appointment confirmed”, “scheduled for”, “booked for”) → `true`.
     - Otherwise → `false`.
- This runs when:
  - The CI webhook receives a `TranscriptSid` (we fetch the summary, then call `detectAppointmentBooked`), and
  - When a user manually fetches/refreshes the summary for a call.
- Each CallLog is evaluated **independently**; there is **no** cross-call or cross-number logic when setting `appointmentBooked`.

### 3.3 Stats aggregation (what we changed)

**Endpoint:** `GET /api/twilio/call-logs/stats`. Query params: `startDate`, `endDate` (optional, `yyyy-MM-dd`). Auth: `customerId = req.user.id`.

**Base `query`:**  
`{ customerId }` and, if `startDate`/`endDate` are provided,  
`startedAt: { $gte: new Date(startDate + 'T00:00:00.000Z'), $lte: new Date(endDate + 'T23:59:59.999Z') }`.

**Appointments Booked (new logic):**

```javascript
const bookedAgg = await CallLog.aggregate([
  { $match: { ...query, appointmentBooked: true } },
  { $group: { _id: { from: '$from', hour: { $dateToString: { format: '%Y-%m-%dT%H', date: '$startedAt' } } } } },
  { $count: 'unique' }
]);
const appointmentsBooked = bookedAgg[0]?.unique ?? 0;
```

**New Patient Appointments Booked:**  
Same, but `$match` also includes `menuChoice: '1'`.

---

## 4. DETAILS WE’RE UNCERTAIN ABOUT

We’d like your view on:

1. **Deduplication key: `(from, day)` in UTC**  
   - Is “one booking per caller per calendar day” a reasonable rule for a clinic?  
   - We’re intentionally undercounting the rare case: same person, **two different** appointments (e.g. for two family members) in one day, to avoid overcounting the much more common “called back to confirm / follow-up” case. Is that trade-off reasonable?

2. **Using UTC for `day`**  
   - `$dateToString` on `startedAt` without a timezone uses UTC. Clinics are in different timezones (e.g. US, Canada). A call at **11pm local** might fall on the **next calendar day in UTC**.  
   - Should we pass a clinic timezone into `$dateToString` (e.g. `America/Toronto`) so “day” aligns with the clinic’s business day? We’d need to store or infer the clinic’s timezone (we don’t currently).

3. **`from` format and identity**  
   - Twilio usually sends `from` in E.164 (e.g. `+14379862011`). We don’t normalize before grouping.  
   - If the same person called from two numbers (e.g. cell vs office) on the same day, we’d count **2**. We’re OK with that for now.  
   - Any pitfalls with `from` (empty, `null`, or non-E.164 in legacy data)? Our schema has `from` required; we haven’t special-cased null in the aggregation.

4. **Alternatives we considered**  
   - **Time window (e.g. 2–4 hours):** Same number, two “Booked” calls within X hours = 1. We chose “per day” for simplicity. Would a **time-window** (e.g. 4–6 hours) be better for healthcare, or is per-day enough?  
   - **Only count the “first” Booked call per (from, day):** We’re effectively doing that by grouping and counting distinct `(from, day)`. We don’t need to mark one call as “the” booking; we only need the count. Is that sufficient, or is there value in storing a “countsAsUniqueBooking” (or similar) on one CallLog per (from, day)?

5. **Per-row “Booked” vs stats**  
   - We kept the **per-call** `appointmentBooked` as-is so the table still shows which individual calls looked like a booking. The **stats** use the deduped count. Any UX or reporting issues with that split?

6. **Edge cases**  
   - Call at **23:59** and another at **00:01** “next day” in UTC: we’d count **2** (different days). Is that acceptable, or should we care about “within N hours” across midnight?  
   - What if the **first** call is “not booked” and the **second** (follow-up) is “booked”? Our rule counts 1 for that (from, day). That seems right; do you agree?

---

## 5. WHAT WE’D LIKE FROM YOU

Please:

1. **Validate the approach:** Is **deduplicating by (caller number, calendar day)** for “Appointments Booked” stats a sound and industry-reasonable choice for a clinic call-tracking product?
2. **Timezone:** Should we move from UTC to clinic-local “day,” and if yes, what’s the least painful way (e.g. require timezone in clinic settings, or infer from `callerState`/address)?
3. **Refinements:** Would you add a **time-window** (e.g. 4–6 hours) instead of or in addition to per-day? Any other tweaks (e.g. only count the *first* Booked call per (from, day) in some other metric)?
4. **Edge cases:** Any important edge cases we’re missing (e.g. multi-location clinics, call centers, different `from` formats)?
5. **UX/labels:** We show “unique callers per day” under the Appointments stat and a tooltip: “Same caller booking twice in one day (e.g. to confirm) counts as one.” Is that clear enough, or would you change the wording?

---

## 6. TECHNICAL SUMMARY (for quick reference)

| Item | Value |
|------|--------|
| **Deduplication key** | `(from, hour)` with `hour = $dateToString('%Y-%m-%dT%H', startedAt)` (UTC) |
| **Scope** | Stats only: “Appointments Booked”, “New Patient Appointments Booked”. Per-call `appointmentBooked` unchanged. |
| **DataSource** | `CallLog` with `appointmentBooked === true` (and `menuChoice === '1'` for new-patient stat). |
| **`appointmentBooked` source** | Twilio CI summary → OpenAI YES/NO or keyword fallback; per-call, no cross-call logic. |
| **Date range** | `startedAt` in `[startDate 00:00:00Z, endDate 23:59:59Z]` when `startDate`/`endDate` are provided. |

---

## 7. OUR DOUBLE-CHECK (implementation review)

- **`query` in `$match`:** `query` is `{ customerId }` or `{ customerId, startedAt: { $gte, $lte } }`. Dates are `new Date(...)`, so `$match` is valid. We use the same `query` for all other stats (e.g. `totalCalls`, `answeredCalls`), so the date filter is consistent.
- **`$group` by `from` and `hour`:** `from` is required in the schema. `hour` is `%Y-%m-%dT%H` (e.g. `2026-01-21T12`). If any legacy doc had `from` null/undefined, it would still group. Optional: add `from: { $exists: true, $ne: null, $ne: '' }` to `$match` to exclude those.
- **Empty aggregation:** `bookedAgg[0]?.unique ?? 0` correctly yields `0` when there are no booked calls.
- **New Patient stat:** Same pipeline with `menuChoice: '1'`; deduplication by `(from, day)` is applied there too.

---

*End of context for ChatGPT.*
