# Twilio Docs Verification – Line-by-Line Against Official Twilio Documentation

This document cross-references **official Twilio documentation** with our implementation to confirm everything is correct.

---

## Source: Twilio Dial – callerId attribute

**URL:** https://www.twilio.com/docs/voice/twiml/dial#callerid

### From the docs

1. **Attributes table:** `callerId` | Allowed: *A valid phone number, or client identifier if dialing a &lt;Client&gt;* | **Default value: "Caller's callerId"**

2. **callerId section:**  
   *"When you use &lt;Dial&gt; in your response to Twilio's inbound call request, **the dialed party sees the inbound caller's number as the caller ID.**"*

3. **Example:**  
   *"1. Someone with a caller ID of 1-415-123-4567 calls your Twilio number.  
   2. You tell Twilio to execute a &lt;Dial&gt; verb to 1-858-987-6543 to handle the inbound call.  
   3. **The called party (1-858-987-6543) will see 1-415-123-4567 as the caller ID on the incoming call.**"*

4. **When you do set callerId:**  
   *"When using the &lt;Number&gt; noun, and **specifying a callerId** on your &lt;Dial&gt;, you can **set a different caller ID than the default**."*

**Conclusion:** If we **do not** specify `callerId` on `<Dial>`, the default is used → dialed party (clinic) sees the **inbound caller's number**. Our code does not set `callerId`, so we rely on this default. ✅

---

## Source: Twilio – Request parameters (From, To)

**URL:** https://www.twilio.com/docs/voice/twiml#twilios-request-to-your-application

### From the docs

| Parameter | Description (quoted) |
|-----------|----------------------|
| **From** | *"The phone number or client identifier of the **party that initiated the call**. Phone numbers are formatted with a '+' and country code (E.164). If a caller ID is **withheld or otherwise unavailable**, you may receive a string that contains **anonymous**, **unknown**, or other descriptions."* |
| **To** | *"The phone number or client identifier of the **called party**."* (i.e. the Twilio number that was dialed – our tracking number.) |

**Conclusion:**  
- **From** = caller (patient); can be a number or `"anonymous"` / `"unknown"` when withheld.  
- **To** = our tracking number (the number they called).  

We use **From** for the caller in logs and CallLog; we do **not** use To as caller ID on Dial. ✅

---

## Source: Twilio Changelog – Withheld caller ID

**URL:** https://twilio.com/en-us/changelog/changes-to-withheld-caller-id-behavior  
**Date:** May 17, 2023

### From the docs

*"Any Programmable Voice calls where the caller ID has been withheld will now display **anonymous** in the **From** field."*

**Conclusion:** When the patient blocks caller ID, Twilio sends `From="anonymous"`. We store that in CallLog and never pass it as `callerId` on Dial (we don’t set callerId at all), so Twilio’s default applies and the clinic sees withheld/Private/Unknown. ✅

---

## Line-by-line: Our code vs Twilio docs

### 1. Reading From and To (incoming webhook)

| Our code (line) | What we do | Twilio doc |
|-----------------|------------|------------|
| 1026 | `const { From, To, CallSid, Digits, CallStatus } = req.body;` | Request params: **From** = party that initiated the call; **To** = called party (Twilio number). ✅ |
| 1029 | `console.log(\`   From: ${From}\`);` | We log what Twilio sends (number or "anonymous"). ✅ |

### 2. Not setting callerId on Dial

| Our code (line) | What we do | Twilio doc |
|-----------------|------------|------------|
| 1217–1219 | Comment + log: we do NOT set callerId on &lt;Dial&gt;; Dial = no callerId. | Dial default = "Caller's callerId" = inbound caller’s number (or withheld). ✅ |
| 1288 | `<Dial timeout="30" action=...` (no callerId attribute) | Default applies → clinic sees inbound caller’s number. ✅ |
| 1297 | `<Dial timeout="30" action=...` (no callerId attribute) | Same. ✅ |
| 1343 | `<Dial timeout="30" action=...` (no callerId attribute) | Same. ✅ |
| 1352 | `<Dial timeout="30" action=...` (no callerId attribute) | Same. ✅ |

**Conclusion:** We never add a `callerId` attribute to any `<Dial>`. Twilio’s documented default behavior applies in all four Dial branches. ✅

### 3. Storing caller (From) for logs and portal

| Our code (line) | What we do | Twilio doc |
|-----------------|------------|------------|
| 1225 | Comment: store From exactly as Twilio sent (e.g. "anonymous" when blocked). | From = party that initiated the call; may be "anonymous" when withheld. ✅ |
| 1229 | `from: From` in logData | CallLog stores the **caller** (From), not the tracking number (To). ✅ |
| 1230 | `to: To` in logData | To = called party (tracking number); we keep it for which number was dialed. ✅ |

**Conclusion:** We persist **From** as the caller (patient number or "anonymous") and **To** as the dialed number (tracking number). This matches Twilio’s parameter definitions and supports correct display in the portal. ✅

### 4. Status callbacks and Dial-status

| Our code (line) | What we do | Twilio doc |
|-----------------|------------|------------|
| 1386 | `From` in status-callback req.body | Same request parameters sent to status callback. ✅ |
| 1464 | `from: From` in updateData | We keep CallLog.from in sync with Twilio’s From. ✅ |
| 1863, 1876 | Dial-status: read and log `From` | We never overwrite CallLog.from with To. ✅ |

**Conclusion:** All webhooks that touch CallLog preserve **From** as the caller, consistent with Twilio’s From/To definitions. ✅

---

## Summary table (docs vs implementation)

| Twilio doc fact | Our implementation | Match |
|-----------------|--------------------|--------|
| Dial callerId default = "Caller's callerId" (inbound caller) | We do not set callerId on any &lt;Dial&gt; | ✅ |
| Dialed party sees inbound caller’s number when callerId not set | We omit callerId → clinic sees patient number or withheld | ✅ |
| From = party that initiated the call (caller) | We use From for caller and store it in CallLog | ✅ |
| To = called party (our Twilio number) | We use To only for routing and twilioPhoneNumber, not as callerId | ✅ |
| Withheld → From = "anonymous" | We store From as-is; no callerId set so default applies | ✅ |

---

## Final check

- **No line in our code** sets `callerId` on `<Dial>` (no `callerId="${To}"`, no `callerId="${From}"`, no other value).
- **Every place** we need the “caller” we use **From** (incoming, CallLog, status-callback, dial-status).
- **Twilio’s documented default** for Dial when callerId is omitted matches our intent: clinic sees patient number, or Private/Unknown when From is withheld.

**Result: Implementation matches Twilio’s documentation line-by-line and is correct.**
