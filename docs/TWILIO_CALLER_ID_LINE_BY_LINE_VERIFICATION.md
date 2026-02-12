# Twilio Caller ID – Line-by-Line Verification

Every relevant line in `backend/routes/twilio.js` is listed below with its role and verification.

---

## Section 1: Top of file – no callerId logic

| Line | Exact content | Verification |
|------|----------------|--------------|
| 30 | `// Escape text for safe use inside TwiML (Say content and attributes)` | Comment only. |
| 31 | `// Prevents "application error has occurred" when clinic name or menu message contains &, <, >, etc.` | Comment only. |
| 32 | `function escapeTwiML(text) {` | Used for Say text, not for Dial callerId. |
| 33–40 | (escapeTwiML body) | No callerId. |
| 41 | `}` | End of escapeTwiML. |
| 42 | (blank) | — |
| 43 | `// Voice validation function - ensures only valid voices are used` | Comment only. |
| 44–58 | `validateAndGetVoice` | Voice only. No callerId, no From/To for Dial. |

**Check:** There is no `isValidDialCallerId`, no `dialCallerIdAttr`, and no code that builds a `callerId` attribute for Dial. ✅

---

## Section 2: POST /voice/incoming – request and From

| Line | Exact content | Verification |
|------|----------------|--------------|
| 1024 | `router.post('/voice/incoming', async (req, res) => {` | Incoming webhook. |
| 1025 | `try {` | — |
| 1026 | `const { From, To, CallSid, Digits, CallStatus } = req.body;` | **From** is read from Twilio. ✅ |
| 1027 | (blank) | — |
| 1028 | `console.log(\`📞 Incoming call received:\`);` | Log. |
| 1029 | `console.log(\`   From: ${From}\`);` | **From** is logged. ✅ |
| 1030 | `console.log(\`   To: ${To}\`);` | To logged (not used for Dial callerId). |

**Check:** From is taken from `req.body` and logged. ✅

---

## Section 3: Caller ID comment and log (no callerId set)

| Line | Exact content | Verification |
|------|----------------|--------------|
| 1217 | `// Caller ID: we do NOT set callerId on <Dial>. Twilio default = inbound caller's ID, so clinic sees` | Documents that we never set callerId. ✅ |
| 1218 | `// patient's number when available, or Private/Unknown when patient blocks ID. Never override = can't mess up.` | Documents intent. ✅ |
| 1219 | `console.log(\`   Caller ID: From="${From}" (stored in CallLog); Dial=no callerId (Twilio default: clinic sees patient number or Private/Unknown)\`);` | Logs From and states Dial has no callerId. ✅ |

**Check:** No variable is set for callerId. Only comments and one log line. ✅

---

## Section 4: CallLog – store From as Twilio sent it

| Line | Exact content | Verification |
|------|----------------|--------------|
| 1224 | `// Store From exactly as Twilio sent it (e.g. +1..., or "anonymous" when caller blocks ID) for logs/reporting` | Comment. ✅ |
| 1225 | `const logData = {` | Start of log payload. |
| 1226 | `customerId: clinic._id,` | — |
| 1227 | `twilioPhoneNumber: To,` | To = tracking number (for which clinic). |
| 1228 | `callSid: CallSid,` | — |
| 1229 | `from: From,` | **from** is Twilio’s **From** (number or "anonymous"). ✅ |
| 1230 | `to: To,` | — |
| 1231 | `direction: 'inbound',` | — |
| 1232 | `status: CallStatus || 'ringing',` | — |
| 1233 | `startedAt: new Date()` | — |
| 1234 | `};` | — |

**Check:** CallLog always gets `from: From`. We never set `from: To` or any callerId here. ✅

---

## Section 5: First Dial (menu + recording)

| Line | Exact content | Verification |
|------|----------------|--------------|
| 1286 | `twiML = \`<?xml version="1.0" encoding="UTF-8"?>` | Start of TwiML. |
| 1287 | `<Response>` | — |
| 1288 | `  <Dial timeout="30" action="${voicemailCallback}" record="record-from-answer" recordingStatusCallback=...` | **Dial has no callerId attribute.** Only `timeout="30"` and other attrs. ✅ |
| 1289 | `    <Number>${forwardNumber}</Number>` | — |
| 1290 | `  </Dial>` | — |

**Check:** This Dial tag does not contain the string `callerId`. ✅

---

## Section 6: Second Dial (menu, no recording)

| Line | Exact content | Verification |
|------|----------------|--------------|
| 1295 | `twiML = \`<?xml version="1.0" encoding="UTF-8"?>` | — |
| 1296 | `<Response>` | — |
| 1297 | `  <Dial timeout="30" action="${voicemailCallback}" statusCallback=...` | **No callerId.** ✅ |
| 1298 | `    <Number>${forwardNumber}</Number>` | — |
| 1299 | `  </Dial>` | — |

**Check:** No callerId. ✅

---

## Section 7: Third Dial (no menu, with recording)

| Line | Exact content | Verification |
|------|----------------|--------------|
| 1341 | `twiML = \`<?xml version="1.0" encoding="UTF-8"?>` | — |
| 1342 | `<Response>` | — |
| 1343 | `  <Dial timeout="30" action="${voicemailCallback}" record="record-from-answer" recordingStatusCallback=...` | **No callerId.** ✅ |
| 1344 | `    <Number>${forwardNumber}</Number>` | — |
| 1345 | `  </Dial>` | — |

**Check:** No callerId. ✅

---

## Section 8: Fourth Dial (no menu, no recording)

| Line | Exact content | Verification |
|------|----------------|--------------|
| 1350 | `twiML = \`<?xml version="1.0" encoding="UTF-8"?>` | — |
| 1351 | `<Response>` | — |
| 1352 | `  <Dial timeout="30" action="${voicemailCallback}" statusCallback=...` | **No callerId.** ✅ |
| 1353 | `    <Number>${forwardNumber}</Number>` | — |
| 1354 | `  </Dial>` | — |

**Check:** No callerId. ✅

---

## Section 9: Error handler (no Dial, no callerId)

| Line | Exact content | Verification |
|------|----------------|--------------|
| 1371 | `} catch (error) {` | — |
| 1374 | `const errorTwiML = \`<?xml version="1.0" encoding="UTF-8"?>` | Error TwiML. |
| 1375 | `<Response>` | — |
| 1376 | `  <Say voice="${TTS_VOICE}" language="en-US">Sorry, an error occurred...` | Say only, no Dial. ✅ |
| 1377 | `  <Hangup/>` | — |
| 1378 | `</Response>\`;` | — |

**Check:** No Dial and no callerId in error path. ✅

---

## Section 10: Status-callback – From preserved

| Line | Exact content | Verification |
|------|----------------|--------------|
| 1386 | `From,` | From destructured from req.body. ✅ |
| 1434 | `from: From,` | callInfo.from = From. ✅ |
| 1446 | `console.log(\`   From: ${callInfo.from}\`);` | From logged. ✅ |
| 1464 | `from: From,` | updateData.from = From (CallLog update). ✅ |

**Check:** Status-callback uses and stores From; it does not set callerId anywhere. ✅

---

## Section 11: Dial-status webhook – From logged

| Line | Exact content | Verification |
|------|----------------|--------------|
| 1863 | `From,` | From from req.body. ✅ |
| 1876 | `console.log(\`   From: ${From \|\| 'not provided'}\`);` | From logged. ✅ |

**Check:** Dial-status receives and logs From; it does not modify CallLog.from (that was set at incoming). ✅

---

## Grep check (whole file)

- **"callerId"** appears only at:
  - **1217** (comment): "we do NOT set callerId on <Dial>"
  - **1219** (log string): "Dial=no callerId"
- There is **no** `callerId=` in any template literal.
- There is **no** `callerId="${To}"` or `callerId="${From}"` in the codebase.

**Check:** No code path can send a callerId on Dial. ✅

---

## Summary table

| Requirement | Line(s) | Status |
|-------------|---------|--------|
| From from Twilio | 1026 | ✅ |
| From logged on incoming | 1029, 1219 | ✅ |
| CallLog.from = From | 1229, 1465 | ✅ |
| No callerId on Dial #1 | 1288 | ✅ |
| No callerId on Dial #2 | 1297 | ✅ |
| No callerId on Dial #3 | 1343 | ✅ |
| No callerId on Dial #4 | 1352 | ✅ |
| Status-callback keeps From | 1386, 1434, 1464 | ✅ |
| Dial-status logs From | 1863, 1876 | ✅ |

**Result: Every listed line is correct. CallerId is never set on Dial; From is always stored and logged.**
