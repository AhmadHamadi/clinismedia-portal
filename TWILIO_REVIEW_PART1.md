# Twilio Integration - Complete System Review (Part 1)

## Overview
The Twilio integration provides phone call management, call forwarding, recording, transcription, AI-powered summaries, and automatic appointment booking detection for clinic customers. The system is fully functional in production, but AI booking detection logic needs verification.

## Phone Number Configuration

### Phone Number Setup
**File:** `backend/routes/twilio.js`
**Method:** `GET /api/twilio/numbers` (Lines 561-650)
**Access:** Admin only

**Functionality:**
- Lists all available Twilio phone numbers from the admin's Twilio account
- Uses Twilio API to fetch `IncomingPhoneNumbers`
- Returns phone numbers with their SIDs, capabilities, and status
- Supports both API Key authentication (recommended) and Auth Token fallback

**Key Code:**
```javascript
const numbers = await twilioRequest('GET', '/IncomingPhoneNumbers.json');
// Returns: { incoming_phone_numbers: [...] }
```

### Phone Number Connection
**Method:** `POST /api/twilio/connect` (Lines 686-859)
**Access:** Admin only
**Parameters:**
- `clinicId`: MongoDB ObjectId of the customer/clinic
- `phoneNumber`: Twilio phone number (E.164 format: +1XXXXXXXXXX)
- `forwardNumber`: Default forwarding number (optional if menu enabled)
- `forwardNumberNew`: Forwarding number for new patients (menu option 1)
- `forwardNumberExisting`: Forwarding number for existing patients (menu option 2)
- `menuMessage`: Custom menu message (optional)

**Functionality:**
1. Validates clinic exists and is a customer
2. Saves phone number and forwarding numbers to User document
3. Updates Twilio webhook configuration to point to backend
4. Sets webhook URLs:
   - Voice URL: `/api/twilio/voice/incoming`
   - Status Callback: `/api/twilio/voice/status-callback`
5. Returns updated user configuration

**Webhook Configuration:**
```javascript
// Updates Twilio phone number webhooks
VoiceUrl: `${baseUrl}/api/twilio/voice/incoming`
VoiceMethod: POST
StatusCallback: `${baseUrl}/api/twilio/voice/status-callback`
StatusCallbackMethod: POST
```

## Who Can Call the Numbers

### Call Routing Logic
**Method:** `POST /api/twilio/voice/incoming` (Lines 956-1262)
**Access:** Public (called by Twilio, no authentication required)

**Call Flow:**
1. **Incoming Call Received:**
   - Twilio sends POST request with: `From`, `To`, `CallSid`, `Digits` (if menu used), `CallStatus`
   - Backend normalizes phone number format (removes spaces, handles +1 prefix)

2. **Clinic Lookup:**
   - Searches User collection for customer with matching `twilioPhoneNumber`
   - Tries multiple formats: exact match, with/without +, with/without country code
   - If no clinic found → Returns error TwiML

3. **Forward Number Selection:**
   - **If Menu Enabled (`TWILIO_ENABLE_MENU=true`):**
     - If `Digits === '1'` → Uses `twilioForwardNumberNew` (new patients)
     - If `Digits === '2'` → Uses `twilioForwardNumberExisting` (existing patients)
     - Falls back to other numbers if specific one not set
   - **If Menu Disabled:**
     - Uses `twilioForwardNumber` (default)
     - Falls back to `twilioForwardNumberNew` or `twilioForwardNumberExisting`

4. **Menu System (Optional):**
   - If `TWILIO_ENABLE_MENU=true` and no `Digits` provided:
     - Plays custom menu message or default: "Press 1 for new patients, press 2 for existing patients"
     - Waits for user input (Gather with timeout)
     - Routes based on selection

5. **Call Forwarding:**
   - Uses Twilio `<Dial>` verb to forward call
   - Sets `callerId` to the Twilio number (so clinic sees Twilio number, not caller's number)
   - Timeout: 30 seconds
   - Records call if `TWILIO_ENABLE_RECORDING=true`
   - Starts transcription if `TWILIO_ENABLE_TRANSCRIPTION=true`

**Key Code:**
```javascript
// Find clinic by phone number
let clinic = await User.findOne({
  $or: [
    { twilioPhoneNumber: normalizedTo, role: 'customer' },
    { twilioPhoneNumber: To, role: 'customer' },
    // ... multiple format attempts
  ]
});

// Determine forward number based on menu selection
if (Digits === '1') {
  forwardNumber = clinic.twilioForwardNumberNew || clinic.twilioForwardNumber;
} else if (Digits === '2') {
  forwardNumber = clinic.twilioForwardNumberExisting || clinic.twilioForwardNumber;
}
```

### Call Access Control
- **Anyone can call** the Twilio phone numbers (public numbers)
- **No authentication required** for incoming calls
- **Call routing** is determined by which clinic owns the number
- **Forwarding** goes to clinic's configured phone numbers
- **Call logs** are stored per clinic (customerId)

## Call Recording & Transcription

### Recording Setup
**Configuration:** `TWILIO_ENABLE_RECORDING=true` (environment variable)
**Method:** TwiML `<Dial>` verb with `record` attribute (Lines 1222-1229)

**Functionality:**
- Records calls from answer (not from ring)
- Recording status callback: `/api/twilio/voice/recording-status`
- Recording stored in Twilio, accessible via RecordingSid
- RecordingSid saved to CallLog document

**Recording Status Handler:**
**Method:** `POST /api/twilio/voice/recording-status` (Lines 2117-2182)
**Functionality:**
1. Receives recording status from Twilio
2. Saves `recordingSid` and `recordingUrl` to CallLog
3. If transcription enabled, creates CI transcript from recording
4. Stores `transcriptSid` for later summary fetching

### Transcription Setup
**Configuration:** `TWILIO_ENABLE_TRANSCRIPTION=true` (environment variable)
**Service SID:** `TWILIO_VI_SERVICE_SID` (Twilio Conversational Intelligence)

**Two Methods:**
1. **Real-time Transcription:** Uses `<Start><Transcription>` in TwiML (Lines 1165-1180)
   - Transcribes during call
   - Available immediately after call

2. **Post-call CI Transcript:** Creates transcript from recording (Lines 2144-2173)
   - Uses Twilio Conversational Intelligence API
   - Creates transcript from recording SID
   - Used for AI summary generation

**Transcript Creation:**
**Method:** `createTranscriptFromRecording(recordingSid)` (Lines 53-121)
**Functionality:**
- Calls Twilio CI API: `POST /v2/Transcripts`
- Provides recording SID as source
- Returns transcript SID for summary fetching
- Supports API Key and Auth Token authentication

## AI Summary Generation

### Summary Fetching
**Method:** `fetchConversationSummary(transcriptSid)` (Lines 124-216)
**Functionality:**
1. Fetches operator results from Twilio CI API
2. Looks for "Conversation Summary" operator
3. Falls back to text-generation operator if not found
4. Extracts summary text from `text_generation_results.result`
5. Returns summary text and raw results

**API Endpoint:** `GET /v2/Transcripts/{transcriptSid}/OperatorResults?Redacted=false`

**Summary Storage:**
- Saved to `CallLog.summaryText`
- `summaryReady` set to `true`
- Used for appointment booking detection

### Summary Endpoints

**1. Get Summary (Customer):**
**Method:** `GET /api/twilio/call-logs/:callSid/summary` (Lines 1916-2012)
**Access:** Authenticated customer (only their own calls)
**Functionality:**
- Returns summary from database if available
- Re-analyzes summary for appointment booking (in case detection logic improved)
- Fetches new summary from Twilio if `transcriptSid` exists but summary not in DB
- Returns appointment booking status

**2. CI Status Webhook:**
**Method:** `POST /api/twilio/ci-status` (Lines 2194-2234)
**Access:** Public (called by Twilio)
**Functionality:**
- Receives transcript status updates from Twilio
- Waits 2 seconds for processing
- Fetches conversation summary
- Detects appointment booking
- Updates CallLog with summary and booking status

## Environment Variables

### Required
- `TWILIO_ACCOUNT_SID`: Twilio Account SID
- `TWILIO_VI_SERVICE_SID`: Conversational Intelligence Service SID (for summaries)

### Authentication (One Required)
- `TWILIO_API_KEY_SID` + `TWILIO_API_KEY_SECRET` (recommended)
- OR `TWILIO_AUTH_TOKEN` (fallback)

### Optional Configuration
- `TWILIO_ENABLE_MENU`: Enable menu system (default: false)
- `TWILIO_ENABLE_RECORDING`: Enable call recording (default: false)
- `TWILIO_ENABLE_TRANSCRIPTION`: Enable transcription (default: false)
- `TWILIO_MENU_MESSAGE`: Custom menu message
- `TWILIO_VOICE`: Voice for text-to-speech (default: 'alice')
- `BACKEND_URL` or `RAILWAY_PUBLIC_DOMAIN`: For webhook URLs

## Helper Functions

### `getTwilioCredentials()` (Lines 19-50)
**Purpose:** Get Twilio authentication credentials
**Returns:** `{ accountSid, username, password, usingApiKey }`
**Priority:** API Keys > Auth Token
**Fallback:** Throws error if neither configured

### `twilioRequest(method, endpoint, formData, retryWithAuthToken)` (Lines 445-540)
**Purpose:** Make Twilio API requests with automatic fallback
**Features:**
- Tries API Key authentication first
- Falls back to Auth Token if API Key fails (401/403)
- Handles errors gracefully
- Logs authentication method used

### `createTranscriptFromRecording(recordingSid)` (Lines 53-121)
**Purpose:** Create CI transcript from call recording
**Returns:** Transcript data with SID
**Uses:** Twilio Conversational Intelligence API
**Fallback:** Auth Token if API Key fails

### `fetchConversationSummary(transcriptSid)` (Lines 124-216)
**Purpose:** Fetch AI-generated conversation summary
**Returns:** `{ summary: string, raw: array }`
**Uses:** Twilio CI OperatorResults API
**Fallback:** Auth Token if API Key fails

## Call Log Model

**File:** `backend/models/CallLog.js`

**Key Fields:**
- `customerId`: Clinic that owns the call
- `twilioPhoneNumber`: Twilio number called
- `callSid`: Unique Twilio call identifier
- `from`/`to`: Caller and recipient numbers
- `dialCallStatus`: 'answered', 'no-answer', 'busy', 'failed', 'canceled'
- `duration`: Call duration in seconds
- `menuChoice`: '1' (new patient) or '2' (existing patient)
- `recordingSid`: Twilio recording identifier
- `transcriptSid`: Twilio CI transcript identifier
- `summaryText`: AI-generated conversation summary
- `summaryReady`: Boolean indicating summary is available
- `appointmentBooked`: Boolean (null/true/false) - AI detection result

**Indexes:**
- `customerId` + `startedAt` (for customer queries)
- `twilioPhoneNumber` + `startedAt` (for number queries)
- `transcriptSid` (for CI webhook lookups)
- `summaryReady` (for summary queries)
- `appointmentBooked` (for booking queries)

## Current Status

### ✅ Working Features
1. **Phone Number Management:** Admin can list and connect numbers
2. **Call Routing:** Calls properly routed to clinic forward numbers
3. **Menu System:** Optional menu for new vs existing patients
4. **Call Recording:** Records calls when enabled
5. **Transcription:** Real-time and post-call transcription
6. **AI Summaries:** Fetches and stores conversation summaries
7. **Call Logs:** Complete call logging with status, duration, quality metrics
8. **Webhook Handling:** All Twilio webhooks properly handled
9. **Authentication:** Supports API Keys and Auth Token with fallback

### ⚠️ Needs Verification
**AI Appointment Booking Detection:** Logic is implemented but needs production testing to verify accuracy. See Part 2 for detailed analysis.
