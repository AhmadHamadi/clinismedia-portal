# Twilio Caller ID – Before/After and Verification

## What we had before (original)

- **Dial:** All `<Dial>` verbs used `callerId="${To}"`.
- **Effect:** The clinic **always** saw the **tracking number** (the number the patient called), never the patient’s real number or “no caller ID”.

## What we have now (current code) – “remove callerId entirely”

- **We do not set `callerId` on `<Dial>` at all.** Every `<Dial>` is just `<Dial timeout="30" action="..." ...>` with no callerId attribute.
- **Twilio’s default** when callerId is omitted: *“Caller’s callerId”* = the inbound caller’s number (or withheld value). So:
  - **Normal call** → clinic sees the **patient’s number**.
  - **Patient blocks caller ID** → clinic sees **Private / Unknown / No Caller ID** (carrier-dependent), and the call **still rings**.
- **Why this is best practice:** If we never set callerId, we can never accidentally set it to `To` (tracking number) again. Twilio’s default does the right thing in all cases.
- **Logs/CallLog:** We still store `from: From` everywhere, so we always have what Twilio sent (number or `"anonymous"`) for reporting.

## Promise to clinics (copy-ready)

- **“You’ll see the patient’s number when it’s available.”**
- **“If the patient blocks caller ID, you’ll still get the call, but it’ll show Private/Unknown.”**
- **“If you have them saved in contacts, your phone may show their name.”** (Name comes from the clinic’s contacts or carrier CNAM, not from Twilio.)

## Twilio docs (source of truth)

- **Default callerId:** *“Default value: Caller's callerId”* — when you don’t set callerId on `<Dial>`, the dialed party sees the inbound caller’s number (or withheld value).
- **Withheld:** When the caller blocks ID, Twilio sends `From="anonymous"`. With default callerId, that is passed through; the clinic’s carrier shows Private/Unknown/etc.
- **Rule:** Do not set callerId on `<Dial>` so you never override the default and can’t accidentally show the tracking number again.

## 100% confirmation

| Scenario | From (Twilio) | We set callerId? | Clinic sees | Call rings? |
|----------|----------------|------------------|-------------|-------------|
| Normal call | e.g. `+15551234567` | **No (never set)** | Patient’s number (Twilio default) | Yes |
| Blocked caller ID | `anonymous` | **No (never set)** | Private / Unknown / No Caller ID (Twilio default) | Yes |
| Logs/CallLog | (any) | N/A | We always store `From` as-is | N/A |
