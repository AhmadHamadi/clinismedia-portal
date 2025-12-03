# Twilio Fixes and Improvements

## 🔴 Issues Identified

### Issue 1: Conversation Summary Not Loading
**Symptoms:**
- Summary shows "Loading conversation summary..." indefinitely
- No error message displayed to user
- Summary never appears

**Root Causes:**
1. **Silent Error Handling:** `fetchSummary()` catches errors but doesn't inform the user
2. **Missing Error State:** No error message displayed when summary fetch fails
3. **Conditional Fetch Logic:** Only fetches if `transcriptSid` exists OR `recordingEnabled` is true, but should always try if transcriptSid exists

### Issue 2: Audio Not Loading
**Symptoms:**
- "Listen" button clicked but audio doesn't play
- Modal opens but stays in loading state
- No error message shown

**Root Causes:**
1. **Blob Creation Errors:** If blob creation fails, error might not be caught properly
2. **CORS Issues:** May not be properly handled
3. **Response Validation:** Doesn't check if response is actually audio before creating blob

---

## ✅ Fixes

### Fix 1: Improve Summary Error Handling

**File:** `frontend/src/components/Customer/CallLogsPage.tsx`

**Changes:**
1. Add error state for summary
2. Display error messages to user
3. Improve conditional logic for fetching

```typescript
// Add error state
const [summaryError, setSummaryError] = useState<string | null>(null);

// Update fetchSummary function
const fetchSummary = async (callSid: string) => {
  try {
    setLoadingSummary(true);
    setSummaryText(null);
    setSummaryError(null); // Clear previous errors
    const token = localStorage.getItem('customerToken');
    
    if (!token) {
      setSummaryError('Please log in to view summaries');
      setLoadingSummary(false);
      return;
    }
    
    const response = await axios.get(
      `${import.meta.env.VITE_API_BASE_URL}/twilio/call-logs/${callSid}/summary`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    
    if (response.data.summaryText) {
      setSummaryText(response.data.summaryText);
    } else if (response.data.status === 'not_available') {
      setSummaryError(response.data.message || 'Conversation summary is not available yet.');
    } else {
      setSummaryError('No summary available for this call.');
    }
    
    // Update the call log in the list if appointment status was determined
    if (response.data.appointmentBooked !== undefined) {
      setCallLogs(prevLogs => 
        prevLogs.map(log => 
          log.callSid === callSid 
            ? { ...log, appointmentBooked: response.data.appointmentBooked }
            : log
        )
      );
      // Refresh stats to update appointment count
      fetchStats();
    }
  } catch (err: any) {
    console.error('Error fetching summary:', err);
    const errorMessage = err.response?.data?.error || err.response?.data?.message || 'Failed to load conversation summary. Please try again.';
    setSummaryError(errorMessage);
  } finally {
    setLoadingSummary(false);
  }
};

// Update Summary button click handler
onClick={() => {
  setSelectedCall(log);
  setShowCallDetails(true);
  setSummaryText(null);
  setSummaryError(null);
  // Always try to fetch if transcriptSid exists, or if recording is enabled (might have transcript)
  if (log.transcriptSid) {
    fetchSummary(log.callSid);
  } else if (config?.recordingEnabled) {
    // Try anyway - backend will return appropriate message
    fetchSummary(log.callSid);
  }
}}

// Update Summary display in modal
{loadingSummary ? (
  <div className="flex items-center justify-center py-8">
    <FaSpinner className="animate-spin text-blue-500 text-2xl" />
    <span className="ml-2 text-gray-600">Loading conversation summary...</span>
  </div>
) : summaryError ? (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <p className="text-red-800 text-sm">{summaryError}</p>
    <button
      onClick={() => fetchSummary(selectedCall.callSid)}
      className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
    >
      Try again
    </button>
  </div>
) : summaryText ? (
  <div className="bg-gray-50 rounded-lg p-4">
    <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">{summaryText}</p>
  </div>
) : (
  <p className="text-gray-500 text-center py-8">No summary available</p>
)}
```

### Fix 2: Improve Audio Loading Error Handling

**File:** `frontend/src/components/Customer/CallLogsPage.tsx`

**Changes:**
1. Add error state for recording
2. Validate response before creating blob
3. Better error messages

```typescript
// Add error state
const [recordingError, setRecordingError] = useState<string | null>(null);

// Update Listen button handler
onClick={async () => {
  try {
    setLoadingRecording(true);
    setRecordingError(null); // Clear previous errors
    setSelectedCall(log);
    setShowRecordingModal(true);
    
    const token = localStorage.getItem('customerToken');
    if (!token) {
      setRecordingError('Please log in to access recordings');
      setLoadingRecording(false);
      return;
    }
    
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const recordingApiUrl = `${apiBaseUrl}/twilio/recording/${log.recordingSid}`;
    
    const response = await fetch(recordingApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to load recording (${response.status})`);
    }
    
    // Check if response is actually audio
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('audio')) {
      throw new Error('Invalid response format. Expected audio file.');
    }
    
    const blob = await response.blob();
    
    // Validate blob
    if (!blob || blob.size === 0) {
      throw new Error('Recording file is empty or corrupted.');
    }
    
    const blobUrl = URL.createObjectURL(blob);
    setRecordingUrl(blobUrl);
  } catch (error: any) {
    console.error('Error loading recording:', error);
    const errorMessage = error.message || 'Failed to load recording. Please try again.';
    setRecordingError(errorMessage);
    // Don't close modal - show error instead
  } finally {
    setLoadingRecording(false);
  }
}}

// Update Audio Player display
{loadingRecording ? (
  <div className="flex items-center justify-center py-8">
    <FaSpinner className="animate-spin text-blue-500 text-2xl" />
    <span className="ml-2 text-gray-600">Loading recording...</span>
  </div>
) : recordingError ? (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <p className="text-red-800 text-sm">{recordingError}</p>
    <button
      onClick={async () => {
        // Retry logic here
        setRecordingError(null);
        // ... retry fetch
      }}
      className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
    >
      Try again
    </button>
  </div>
) : recordingUrl ? (
  <audio 
    controls 
    autoPlay
    className="w-full"
    onEnded={() => {
      URL.revokeObjectURL(recordingUrl);
    }}
    onError={(e) => {
      console.error('Audio playback error:', e);
      setRecordingError('Failed to play audio. The file may be corrupted.');
    }}
  >
    <source src={recordingUrl} type="audio/mpeg" />
    Your browser does not support the audio element.
  </audio>
) : (
  <p className="text-gray-500 text-center py-8">No recording available</p>
)}
```

### Fix 3: Improve Backend Error Responses

**File:** `backend/routes/twilio.js`

**Changes:**
1. Add more detailed error messages
2. Include status information in responses

```javascript
// In GET /call-logs/:callSid/summary endpoint
// Add more detailed error responses
if (!callLog) {
  return res.status(404).json({ 
    error: 'Call not found or access denied.',
    status: 'not_found'
  });
}

// When summary is not available, provide more context
if (!callLog.transcriptSid) {
  return res.json({
    summaryText: null,
    summaryReady: false,
    transcriptSid: null,
    status: 'no_transcript',
    message: 'Transcript not available. Recording may still be processing or transcription is disabled.'
  });
}

// In recording endpoint, add better error messages
catch (error) {
  console.error('Error fetching recording from Twilio:', error);
  if (error.response) {
    console.error('Twilio API error:', error.response.status, error.response.data);
    
    // Provide specific error messages
    let errorMessage = 'Failed to fetch recording';
    if (error.response.status === 404) {
      errorMessage = 'Recording not found in Twilio. It may have been deleted.';
    } else if (error.response.status === 401 || error.response.status === 403) {
      errorMessage = 'Authentication failed. Please check Twilio credentials.';
    } else if (error.response.status >= 500) {
      errorMessage = 'Twilio service error. Please try again later.';
    }
    
    res.status(error.response.status).json({ 
      error: errorMessage,
      details: error.response.data?.message || error.message,
      status: 'twilio_error'
    });
  } else {
    res.status(500).json({ 
      error: 'Failed to fetch recording',
      details: error.message,
      status: 'network_error'
    });
  }
}
```

---

## 🔍 Debugging Improvements

### Add Console Logging

**Frontend:**
```typescript
// In fetchSummary
console.log('[CallLogs] Fetching summary for call:', callSid);
console.log('[CallLogs] Response:', response.data);

// In audio loading
console.log('[CallLogs] Loading recording:', log.recordingSid);
console.log('[CallLogs] Response status:', response.status);
console.log('[CallLogs] Content-Type:', response.headers.get('content-type'));
console.log('[CallLogs] Blob size:', blob.size);
```

**Backend:**
```javascript
// In summary endpoint
console.log(`[Summary] Fetching summary for call: ${callSid}`);
console.log(`[Summary] CallLog found:`, {
  transcriptSid: callLog.transcriptSid,
  summaryReady: callLog.summaryReady,
  hasSummaryText: !!callLog.summaryText
});

// In recording endpoint
console.log(`[Recording] Fetching recording: ${recordingSid}`);
console.log(`[Recording] CallLog found:`, {
  recordingSid: callLog.recordingSid,
  customerId: callLog.customerId
});
```

---

## 📋 Testing Checklist

After applying fixes, test:

### Summary:
- [ ] Summary loads when transcriptSid exists
- [ ] Error message shows when summary not available
- [ ] Error message shows when API call fails
- [ ] "Try again" button works
- [ ] Loading state shows correctly
- [ ] No infinite loading state

### Audio:
- [ ] Audio loads when recordingSid exists
- [ ] Error message shows when recording not found
- [ ] Error message shows when API call fails
- [ ] Error message shows when blob creation fails
- [ ] Audio plays correctly
- [ ] Loading state shows correctly
- [ ] No infinite loading state

---

## 🚀 Implementation Priority

1. **High Priority:** Fix error handling in frontend (Fix 1 & 2)
2. **Medium Priority:** Improve backend error messages (Fix 3)
3. **Low Priority:** Add debugging logs

---

## 📝 Notes

- These fixes improve user experience by showing clear error messages
- They don't change the core functionality, just add better error handling
- All fixes are backward compatible
- Error states are properly managed to prevent UI inconsistencies

