# Twilio – Full Review & “Which Line” (Line 1 / Line 2) Explained

This document reviews everything Twilio-related in the portal and clarifies **how calls are routed and whether a receptionist’s “Line 1” or “Line 2” is affected**.

---

## 1. Executive summary

- **Twilio** is used for **inbound call handling**: one Twilio number per clinic, optional IVR menu, then **forward** to one or two clinic phone numbers.
- **“Which line” the call goes to** is decided by the **caller’s menu choice** (1 or 2), **not** by which receptionist is logged in or “has” Line 1 or Line 2.
- The app does **not** have a concept of “receptionist Line 1” or “receptionist Line 2.” It has:
  - **New patient forward number** (menu option **1**)
  - **Existing patient forward number** (menu option **2**)
- If the clinic physically uses “Line 1” for new patients and “Line 2” for existing, then configuring those numbers in the portal as New / Existing will send Press 1 → Line 1 and Press 2 → Line 2. The receptionist doesn’t choose; the caller does.

---

## 2. Twilio configuration (environment)

| Variable | Purpose |
|----------|---------|
| `TWILIO_ACCOUNT_SID` | Required. Twilio account. |
| `TWILIO_AUTH_TOKEN` | Auth (fallback if no API key). |
| `TWILIO_API_KEY_SID` + `TWILIO_API_KEY_SECRET` | Preferred over Auth Token. |
| `TWILIO_VI_SERVICE_SID` | Voice Intelligence (transcription/summary). |
| `TWILIO_ENABLE_MENU` | `true` = IVR “Press 1 for new, 2 for existing.” |
| `TWILIO_ENABLE_RECORDING` | `true` = record answered calls. |
| `TWILIO_ENABLE_TRANSCRIPTION` | `true` = use CI for transcript/summary. |
| `TWILIO_MENU_MESSAGE` | Optional global IVR message override. |
| `BACKEND_URL` (or `RAILWAY_PUBLIC_DOMAIN`) | Base URL for Twilio webhooks. |

**Current `.env` (from your backend):**

- `TWILIO_ENABLE_MENU=true` → IVR menu is **on** (1 = new, 2 = existing).
- `TWILIO_ENABLE_RECORDING=true`, `TWILIO_ENABLE_TRANSCRIPTION=true` → recording and CI are on.

---

## 3. Per-clinic data (User / clinic)

Stored on the **customer (clinic)** user:

| Field | Meaning |
|-------|--------|
| `twilioPhoneNumber` | The Twilio number callers dial (e.g. main clinic line). |
| `twilioForwardNumber` | Default/legacy single forward number. |
| `twilioForwardNumberNew` | Forward when caller presses **1** (new patient). |
| `twilioForwardNumberExisting` | Forward when caller presses **2** (existing patient). |
| `twilioMenuMessage` | Custom IVR text; else default “Thank you for calling [clinic]. Press 1 for new…” |
| `twilioVoice` | TTS voice for IVR (validated server-side). |

There is **no** “receptionist” or “line” field. Routing is **only** by clinic + menu digit.

---

## 4. How “which line” is chosen (incoming call flow)

### 4.1 Webhook

1. Call hits the clinic’s **Twilio number**.
2. Twilio POSTs to **`/api/twilio/voice/incoming`** with `From`, `To`, `CallSid`, and (after menu) `Digits` (1 or 2).

### 4.2 Clinic lookup

- Clinic is found by **`To`** (the Twilio number), with several format variants (with/without `+`, with/without country code, regex fallback).
- At least one of `twilioForwardNumber`, `twilioForwardNumberNew`, `twilioForwardNumberExisting` must be set.

### 4.3 Forward number selection (this is “which line”)

**If `TWILIO_ENABLE_MENU` is `false` (no menu):**

- One number is used:
  - `forwardNumber = twilioForwardNumber || twilioForwardNumberNew || twilioForwardNumberExisting`
- All calls go to that one number. No “Line 1 vs Line 2” in the app.

**If `TWILIO_ENABLE_MENU` is `true` (menu enabled):**

- **First request (no `Digits`):** TwiML plays the menu (“Press 1 for new patients, 2 for existing”) and `<Gather>`; no dial yet.
- **Second request (with `Digits`):**
  - **Digits === '1' (new patient):**  
    `forwardNumber = twilioForwardNumberNew || twilioForwardNumberExisting || twilioForwardNumber`
  - **Digits === '2' (existing patient):**  
    `forwardNumber = twilioForwardNumberExisting || twilioForwardNumberNew || twilioForwardNumber`

So:

- **Press 1** → ring **New patient** number (and fallbacks if that’s not set).
- **Press 2** → ring **Existing patient** number (and fallbacks if that’s not set).

If the clinic’s “Line 1” is the new-patient line and “Line 2” is the existing-patient line, then in Admin you set:

- **New patient forward number** = Line 1  
- **Existing patient forward number** = Line 2  

Result: caller choice **1** → Line 1, **2** → Line 2. **Receptionists do not affect this**; they just answer whichever line rings.

### 4.4 After the number is chosen

- Optional disclosure (“This call may be recorded…”).
- Optional start of Voice Intelligence transcription.
- `<Dial>` to the chosen `forwardNumber` (E.164, e.g. `+1…`).
- Timeout 30s; on no-answer → voicemail flow.
- Caller ID on the forwarded call is **not** overridden (clinic sees caller or “Private/Unknown”).

---

## 5. Admin “Connect” behavior (when only one number is set)

When an admin connects a Twilio number to a clinic (`POST /api/twilio/connect`):

- If **menu is enabled** (`TWILIO_ENABLE_MENU=true`):
  - Only **default** forward given → that number is used for **both** New and Existing (`twilioForwardNumberNew` and `twilioForwardNumberExisting` both set to it).
  - Only **New** given → Existing is set to the same as New (and default = New).
  - Only **Existing** given → New is set to the same as Existing (and default = Existing).
  - **Both New and Existing** given, no default → default is set to New.
- So with menu on, you can have one physical line for both options, or two different numbers (e.g. Line 1 and Line 2).

---

## 6. Receptionists and “Line 1 / Line 2”

- **Receptionists do not have a “Line 1” or “Line 2” in the app.** There are no per-receptionist line assignments.
- **Routing is only:** caller dials Twilio number → (if menu) caller presses 1 or 2 → app picks `twilioForwardNumberNew` or `twilioForwardNumberExisting` → Twilio dials that number.
- **Who answers** (receptionist at desk 1 vs desk 2) is determined by **which physical line/phone** the clinic assigned to New vs Existing in the portal. The app does not know or care which receptionist is on which line.
- Receptionists **cannot** change Twilio config, do not have Call Logs in the UI (no `call-logs` in `allowedPages`), and get 403 on customer Twilio API routes. They don’t affect “which line” a call goes to.

---

## 7. Call logs and status

- **CallLog** is created/updated per call: `customerId` (clinic), `callSid`, `from`, `to`, `menuChoice` ('1' or '2'), `dialCallStatus`, `recordingSid`, etc.
- **Answered vs missed** is determined by dial-status (and recording/summary); see `TWILIO_COMPLETE_WORKFLOW_REVIEW.md`.
- **Call Logs page and API** are customer-only; receptionists don’t see call logs in this app.

---

## 8. Quick reference: “Does the app decide which line (Line 1 or 2) a call goes to?”

| Question | Answer |
|----------|--------|
| Does the app have “Line 1” and “Line 2” as concepts? | No. It has “New patient forward number” and “Existing patient forward number.” |
| Who decides which number is rung? | The **caller**, by pressing 1 or 2 (when menu is on). |
| Can a receptionist change which line gets the call? | No. Receptionists don’t control routing. |
| If our “Line 1” is new patients and “Line 2” is existing? | In Admin, set **New patient forward number** = Line 1, **Existing patient forward number** = Line 2. Then Press 1 → Line 1, Press 2 → Line 2. |
| What if menu is off? | All calls go to a single forward number (default or the only one set). No 1/2 split. |

---

## 9. “Same number for both” + phone has Line 1 and Line 2 (your case)

**Setup:** The receptionist’s **phone** has two physical lines (Line 1 and Line 2), but in the portal **New** and **Existing** are both set to the **same** phone number. So Press 1 and Press 2 both make us dial that one number.

**What we do:** We send Twilio a single `<Dial><Number>+1…</Number></Dial>` to that number. We do **not** send any “line” or “appearance” info—we only dial a number.

**Who decides which line rings (or if the second call gets busy)?**  
The **phone carrier / phone system** (and sometimes the handset/PBX), **not** our app.

- If the carrier rolls a second call to Line 2 when Line 1 is busy, that’s carrier behavior.
- If the second call gets busy or voicemail when Line 1 is in use, that’s also carrier/phone system behavior.

We have no way to tell the network “send this call to Line 2.” So:

| Question | Answer |
|----------|--------|
| Is it our fault if a second call doesn’t go to Line 2 when they’re already on Line 1? | **No.** We only dial one number; we can’t choose “Line 1” vs “Line 2” on the phone. |
| Who controls that? | **Phone carrier / phone system.** (Rollover, hunt groups, busy behavior, etc.) |
| What *can* we control? | **Which phone number** we dial. If Line 1 and Line 2 have **different** numbers, set New → Line 1’s number and Existing → Line 2’s number; then Press 1 rings Line 1, Press 2 rings Line 2, and a second call can ring Line 2 even if they’re on Line 1. |

**Summary:** With “same number regardless” of 1 or 2, the line issue (second call not going to Line 2) is **not our fault**—it’s carrier/phone system behavior. To have the **caller’s choice** (1 vs 2) actually pick which line rings, the clinic needs two different numbers (one per line) and must set those in the portal as New vs Existing.

---

## 10. Busy or on a call → does it keep ringing or go to voicemail?

**Short answer:** We do **not** keep the caller ringing. When the forward number is **busy** or **doesn’t answer**, Twilio ends the `<Dial>` and requests our **voicemail** URL. We then **automatically** play “Please leave a message after the tone…” and record. So the caller is taken to voicemail; we don’t “send them back” to a different line.

**Flow:**

1. Call comes in → we `<Dial timeout="30" action=".../voice/voicemail?CallSid=...">` to the clinic’s forward number.
2. **If the clinic answers:** The call connects. When they hang up, Twilio hits the action URL with `DialCallStatus=completed` (and we already got `answered` via statusCallback). Our voicemail handler sees “completed/answered” and returns **silent Hangup** — no voicemail prompt.
3. **If the clinic is busy:** Twilio gets a busy signal (or the carrier reports busy). The Dial ends. Twilio requests our voicemail URL with `DialCallStatus=busy`. We do **not** treat `busy` as “connected”; we treat it as “not answered.” So we **prompt for voicemail** and record.
4. **If the clinic doesn’t answer within 30 seconds:** Dial times out. Twilio requests our voicemail URL with `DialCallStatus=no-answer`. We prompt for voicemail and record.
5. **If the dial fails** (e.g. invalid number): `DialCallStatus=failed` or `canceled` → same: we prompt for voicemail.

**Code (voicemail GET):**

- We only skip voicemail when `DialCallStatus` is one of: `completed`, `answered`, `connected` (call was connected).
- For `busy`, `no-answer`, `failed`, `canceled` (and anything else), we play the “Please leave a message after the tone…” TwiML and record.

So: **when they’re busy or on a call, we do not keep the caller ringing; we take them to voicemail automatically.** The 30-second timeout is how long we **ring** the forward number; after that (or as soon as Twilio reports busy), the caller hears the voicemail prompt.

---

## 11. Audio quality: voice not clear / other person sounds far away (vs direct call)

**What you’re seeing:** Calling the clinic **through** Twilio (forwarding) sounds less clear or “far away” compared to calling the same clinic number **directly** (without Twilio).

**Is that normal?**  
It’s **common** with any call forwarding or “middle” provider, not unique to our app. It’s not “broken,” but the experience can be slightly worse than a direct call.

**Why it can happen:**

1. **Two legs instead of one**  
   - Direct: Caller ↔ Clinic (one path).  
   - With Twilio: Caller ↔ Twilio ↔ Clinic (two legs). Each leg can add a bit of latency, compression, or codec changes, so the combined call can sound a bit flatter or more distant.

2. **Codecs**  
   Twilio (and the carriers) choose the audio codec on each leg. We don’t set codecs in the app; Twilio handles that. Transcoding between codecs on the two legs can make voice slightly less clear or “further away.”

3. **Recording / transcription**  
   We use `record="record-from-answer"` and optional Voice Intelligence (transcription). These run in parallel and usually don’t change the **live** audio you hear, but in some setups they can be a factor. If you want to test, you can temporarily turn off recording/transcription in `.env` and see if the **subjective** quality changes.

4. **Network / carrier**  
   Quality also depends on the caller’s and clinic’s network/carrier (Wi‑Fi, mobile, landline). A weak or congested link on either side can make the Twilio leg sound worse.

**What we do in code:**  
We use a normal `<Dial><Number>…</Number></Dial>` with no custom codec or audio tweaks. So we’re not doing anything special that would make it worse; the difference is mainly from having Twilio in the path.

**What can help:**

- **Twilio’s side:** They have [audio quality troubleshooting](https://help.twilio.com/articles/360021745354) and [Voice Trace](https://help.twilio.com/hc/en-us/articles/360038021053) / Voice Insights for specific calls. Useful if one leg (e.g. caller → Twilio or Twilio → clinic) is bad.
- **Your side:** Good internet/phone connection on both caller and clinic; if the clinic uses VoIP or Wi‑Fi for the forwarded line, that can add to the “far away” feel.
- **Quick test:** Temporarily set `TWILIO_ENABLE_RECORDING=false` and `TWILIO_ENABLE_TRANSCRIPTION=false` in `.env`, restart, and compare. If it’s the same, the cause is likely the two-legged path/codecs/network, not our recording/transcription.

**Summary:** Slightly less clear or “far away” sound on Twilio-forwarded calls vs direct is a **normal trade-off** of putting a forwarding layer in the middle. If it’s **very** bad (muffled, choppy, dropouts), it’s worth checking Twilio’s tools and the network on both sides; we don’t add any custom audio settings that would cause that.

**What you can do on Twilio (after turning off recording/transcription):**

1. **Voice Insights** — In [Twilio Console → Monitor → Logs → Calls](https://console.twilio.com), open a call that had bad audio. Use **Voice Insights** (or Call Summary) for that Call SID to see metrics (packet loss, jitter, latency) on each leg (caller→Twilio vs Twilio→clinic). That tells you which side is degrading.

2. **Voice Trace** — [Twilio Console → Voice → Settings](https://console.twilio.com/us1/develop/voice/settings). Enable **Voice Trace**. Twilio will capture RTP for calls so you (or Twilio Support) can listen to the actual audio and see where it gets bad. Traces are kept ~10 days. You can then open a support ticket with a Call SID and ask Twilio to check that call.

3. **Open a ticket with Twilio** — With a specific **Call SID** from a bad call (and Voice Trace enabled for that period), contact Twilio Support. Ask them to review that call's audio path and whether anything can be improved on their side (carrier/edge, region). For PSTN-to-PSTN we don't set codecs in TwiML; Twilio and the carriers negotiate. Support may have account-level or carrier-side options.

4. **Network / clinic side** — If the clinic's **forward number** is a mobile or VoIP line, that leg is often the weak one (cellular/VoIP compression). Where possible, test with a **landline** or a different carrier for the clinic number to see if the "far away" sound improves. Good Wi‑Fi/connection on both caller and clinic also helps.

There is no codec or "HD voice" switch in our `<Dial>` TwiML for PSTN; Twilio handles that with the carrier. So the main levers are: use Twilio's tools to see which leg is bad, then either improve that side's network or ask Twilio Support if they can suggest carrier/edge tweaks.

---

## 12. Files involved

- **Backend:** `backend/routes/twilio.js` (incoming webhook ~1041–1285, connect ~755–930, credentials, all TwiML).
- **Models:** `backend/models/User.js` (Twilio fields), `backend/models/CallLog.js`.
- **Frontend:** Admin `TwilioManagementPage.tsx` / `TwilioManagementLogic.tsx` (connect form: phone number, forward, forward new, forward existing, menu message, voice). Customer `CallLogsPage.tsx` (call logs and config display).
- **Env:** `backend/.env` (Twilio vars and `TWILIO_ENABLE_MENU` etc.).

---

## 13. Summary

- **Twilio** in this app = one number per clinic, optional “Press 1 / Press 2” menu, then forward to one or two clinic numbers.
- **“Which line”** = which **forward number** is used. That is chosen **only** by:
  - **Menu off:** single forward number for all calls.
  - **Menu on:** caller’s keypress — **1** → New patient number, **2** → Existing patient number.
- **Receptionists** don’t control routing; they just answer the line that rings. To have “Line 1” and “Line 2” in the physical sense, configure the two forward numbers in Admin (New = Line 1, Existing = Line 2, or vice versa) and keep `TWILIO_ENABLE_MENU=true`.
