const express = require('express');
const axios = require('axios');
const router = express.Router();
const User = require('../models/User');
const CallLog = require('../models/CallLog');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');
const resolveEffectiveCustomerId = require('../middleware/resolveEffectiveCustomerId');

// ============================================
// Voice Validation - 100% Verified Twilio Voices
// ============================================

// ============================================
// Twilio TTS Voice Configuration
// ============================================
// SINGLE HARD-CODED VOICE FOR ALL CLINICS
// Provider: Google Text-to-Speech
// Voice from dropdown: en-US-Chirp3-HD-Aoede
// Final format: Google.en-US-Chirp3-HD-Aoede
// ============================================

// ✅ Single, hard-coded voice constant - NEVER use env vars for this
const TTS_VOICE = 'Google.en-US-Chirp3-HD-Aoede';

// Silent TwiML when clinic ends call or on error—no Say, no message. Caller hears nothing.
const SILENT_HANGUP_TWIML = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Hangup/>\n</Response>';

// Valid Twilio voice names (only this one voice is allowed)
const VALID_TWILIO_VOICES = [
  TTS_VOICE
];

// Caller ID: Twilio sends non-number values when caller blocks ID (e.g. anonymous, restricted, private).
// Use this for display so the portal shows "Unknown number" instead of raw value.
const UNKNOWN_CALLER_ID_VALUES = ['anonymous', 'restricted', 'private', 'unknown', 'blocked', 'unavailable'];
function isUnknownCallerId(from) {
  if (!from || typeof from !== 'string') return true;
  const normalized = from.trim().toLowerCase();
  if (UNKNOWN_CALLER_ID_VALUES.includes(normalized)) return true;
  // Not a phone number (no significant digits) = treat as unknown
  const digits = from.replace(/\D/g, '');
  return digits.length < 10;
}
function getFromDisplay(from) {
  return isUnknownCallerId(from) ? 'Unknown number' : from;
}

// Escape text for safe use inside TwiML (Say content and attributes)
// Prevents "application error has occurred" when clinic name or menu message contains &, <, >, etc.
function escapeTwiML(text) {
  if (text == null || typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Voice validation function - ensures only valid voices are used
const validateAndGetVoice = (requestedVoice) => {
  if (!requestedVoice) {
    console.log(`[VOICE] No voice requested, using default: ${TTS_VOICE}`);
    return TTS_VOICE;
  }
  
  // Check if voice is valid
  if (VALID_TWILIO_VOICES.includes(requestedVoice)) {
    console.log(`[VOICE] Valid voice requested: ${requestedVoice}`);
    return requestedVoice;
  }
  
  // Invalid voice - log warning and use default
  console.warn(`[VOICE WARNING] Invalid voice "${requestedVoice}" requested. Using default: ${TTS_VOICE}`);
  return TTS_VOICE;
};

// OpenAI for AI-powered appointment detection (optional - falls back to keyword matching)
let OpenAI = null;
try {
  OpenAI = require('openai');
} catch (e) {
  console.log('⚠️ OpenAI package not installed. Using keyword-based detection only.');
}

// Get Twilio credentials from environment (admin's Twilio account)
// Supports both Auth Token and API Key Secret
const getTwilioCredentials = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!accountSid) {
    throw new Error('TWILIO_ACCOUNT_SID is required in environment variables.');
  }
  
  // If using API Keys (recommended)
  if (apiKeySid && apiKeySecret) {
    return {
      accountSid,
      username: apiKeySid, // Use API Key SID as username
      password: apiKeySecret, // Use API Key Secret as password
      usingApiKey: true
    };
  }
  
  // Fall back to Auth Token
  if (authToken) {
    return {
      accountSid,
      username: accountSid, // Use Account SID as username
      password: authToken, // Use Auth Token as password
      usingApiKey: false
    };
  }
  
  throw new Error('Twilio credentials not configured. Please set either TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET (recommended) or TWILIO_AUTH_TOKEN in environment variables.');
};

// Create CI transcript from recording (with Auth Token fallback)
const createTranscriptFromRecording = async (recordingSid) => {
  try {
    let credentials = getTwilioCredentials();
    const viServiceSid = process.env.TWILIO_VI_SERVICE_SID;
    
    if (!viServiceSid) {
      throw new Error('TWILIO_VI_SERVICE_SID is required for Conversational Intelligence');
    }
    
    const url = 'https://intelligence.twilio.com/v2/Transcripts';
    const body = new URLSearchParams({
      ServiceSid: viServiceSid,
      Channel: JSON.stringify({ 
        media_properties: { 
          source_sid: recordingSid 
        } 
      }),
    });
    
    console.log(`📝 Creating CI transcript from recording: ${recordingSid}`);
    
    try {
      const response = await axios.post(url, body, {
        auth: { 
          username: credentials.username, 
          password: credentials.password 
        },
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded' 
        },
      });
      
      console.log(`✅ CI transcript created: ${response.data.sid}`);
      return response.data;
    } catch (error) {
      // Fallback to Auth Token if API Keys fail
      const isAuthError = error.response?.status === 401 || error.response?.status === 403;
      const hasAuthToken = !!process.env.TWILIO_AUTH_TOKEN;
      const wasUsingApiKey = credentials.usingApiKey;
      
      if (isAuthError && wasUsingApiKey && hasAuthToken) {
        console.warn('⚠️ API Key failed for CI transcript, falling back to Auth Token...');
        credentials = {
          accountSid: credentials.accountSid,
          username: credentials.accountSid,
          password: process.env.TWILIO_AUTH_TOKEN,
          usingApiKey: false
        };
        
        const retryResponse = await axios.post(url, body, {
          auth: { 
            username: credentials.username, 
            password: credentials.password 
          },
          headers: { 
            'Content-Type': 'application/x-www-form-urlencoded' 
          },
        });
        
        console.log(`✅ CI transcript created (using Auth Token fallback): ${retryResponse.data.sid}`);
        return retryResponse.data;
      }
      throw error;
    }
  } catch (error) {
    console.error('Error creating CI transcript:', error.response?.data || error.message);
    throw error;
  }
};

// Fetch Conversation Summary from CI OperatorResults (with Auth Token fallback)
const fetchConversationSummary = async (transcriptSid) => {
  try {
    let credentials = getTwilioCredentials();
    const operatorUrl = `https://intelligence.twilio.com/v2/Transcripts/${transcriptSid}/OperatorResults?Redacted=false`;
    
    try {
      const response = await axios.get(operatorUrl, {
        auth: { username: credentials.username, password: credentials.password }
      });
      
      const results = response.data?.operator_results || [];
      
      // Find Conversation Summary operator
      let summary = null;
      for (const r of results) {
        if (r.name && r.name.toLowerCase().includes('conversation summary')) {
          summary = r;
          break;
        }
      }
      
      // Fallback: Look for text-generation operator
      if (!summary) {
        for (const r of results) {
          if (r.operator_type === 'text-generation' && r.text_generation_results?.result) {
            summary = r;
            break;
          }
        }
      }
      
      // Extract text from summary
      let text = null;
      if (summary?.text_generation_results?.result) {
        text = String(summary.text_generation_results.result).trim();
      }
      
      return { summary: text, raw: results };
    } catch (error) {
      // Fallback to Auth Token if API Keys fail
      const isAuthError = error.response?.status === 401 || error.response?.status === 403;
      const hasAuthToken = !!process.env.TWILIO_AUTH_TOKEN;
      const wasUsingApiKey = credentials.usingApiKey;
      
      if (isAuthError && wasUsingApiKey && hasAuthToken) {
        console.warn('⚠️ API Key failed for conversation summary, falling back to Auth Token...');
        credentials = {
          accountSid: credentials.accountSid,
          username: credentials.accountSid,
          password: process.env.TWILIO_AUTH_TOKEN,
          usingApiKey: false
        };
        
        const retryResponse = await axios.get(operatorUrl, {
          auth: { username: credentials.username, password: credentials.password }
        });
        
        const results = retryResponse.data?.operator_results || [];
        
        // Find Conversation Summary operator
        let summary = null;
        for (const r of results) {
          if (r.name && r.name.toLowerCase().includes('conversation summary')) {
            summary = r;
            break;
          }
        }
        
        // Fallback: Look for text-generation operator
        if (!summary) {
          for (const r of results) {
            if (r.operator_type === 'text-generation' && r.text_generation_results?.result) {
              summary = r;
              break;
            }
          }
        }
        
        // Extract text from summary
        let text = null;
        if (summary?.text_generation_results?.result) {
          text = String(summary.text_generation_results.result).trim();
        }
        
        return { summary: text, raw: results };
      }
      throw error;
    }
  } catch (error) {
    console.error('Error fetching conversation summary:', error.message);
    throw error;
  }
};

// Simple rate limiting for OpenAI API calls
// Track requests per minute to avoid hitting rate limits
let openAIRequestTimes = [];
const OPENAI_RATE_LIMIT_RPM = 2; // Conservative: 2 requests per minute (below the 3 RPM free tier limit)
const OPENAI_RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds

const checkRateLimit = () => {
  const now = Date.now();
  // Remove requests older than 1 minute
  openAIRequestTimes = openAIRequestTimes.filter(time => now - time < OPENAI_RATE_LIMIT_WINDOW);
  
  // Check if we're at the rate limit
  if (openAIRequestTimes.length >= OPENAI_RATE_LIMIT_RPM) {
    const oldestRequest = openAIRequestTimes[0];
    const timeUntilReset = OPENAI_RATE_LIMIT_WINDOW - (now - oldestRequest);
    return {
      allowed: false,
      waitTime: Math.ceil(timeUntilReset / 1000) // Return seconds to wait
    };
  }
  
  return { allowed: true, waitTime: 0 };
};

// AI-powered appointment detection using OpenAI (PRIMARY METHOD)
// This is the main detection method - AI can understand context much better than keyword matching
// IMPROVED: Now queues requests if rate limit is reached (waits instead of falling back)
const detectAppointmentBookedWithAI = async (summaryText) => {
  if (!summaryText || typeof summaryText !== 'string') {
    return false;
  }
  
  // Check if OpenAI is available and API key is set
  if (!OpenAI || !process.env.OPENAI_API_KEY) {
    console.log('📝 OpenAI not available - will use keyword fallback');
    return null; // Signal to use fallback
  }
  
  // Check rate limit before making request
  let rateLimitCheck = checkRateLimit();
  
  // If rate limit reached, wait for it to reset (queue the request)
  if (!rateLimitCheck.allowed) {
    const waitTime = rateLimitCheck.waitTime;
    console.log(`⏱️ OpenAI rate limit: ${OPENAI_RATE_LIMIT_RPM} requests/minute reached. Queueing request - waiting ${waitTime}s for rate limit to reset...`);
    
    // Wait for the rate limit to reset (add 1 second buffer for safety)
    await new Promise(resolve => setTimeout(resolve, (waitTime + 1) * 1000));
    
    // Small delay to let other concurrent waiting requests settle
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check again after waiting - CRITICAL: Verify rate limit is actually clear
    rateLimitCheck = checkRateLimit();
    let retryCount = 0;
    while (!rateLimitCheck.allowed && retryCount < 3) {
      // Still rate limited - wait a bit more (could be multiple requests waiting)
      const additionalWait = rateLimitCheck.waitTime + 1;
      console.warn(`⚠️ Still rate limited after waiting. Waiting additional ${additionalWait}s... (retry ${retryCount + 1}/3)`);
      await new Promise(resolve => setTimeout(resolve, additionalWait * 1000));
      rateLimitCheck = checkRateLimit();
      retryCount++;
    }
    
    if (!rateLimitCheck.allowed) {
      // After 3 retries, still rate limited - fall back to keyword matching
      console.error(`❌ Still rate limited after multiple retries. Falling back to keyword matching.`);
      return null;
    }
    
    console.log('✅ Rate limit reset - processing queued request with AI');
  }
  
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Record this request time
    openAIRequestTimes.push(Date.now());
    
    const prompt = `Analyze this phone call summary and determine if an appointment was successfully booked.

RULES:
- Return "YES" if an appointment was confirmed, scheduled, or booked with a specific date/time
- Return "NO" if the appointment was NOT booked (e.g., fully booked, no availability, customer will call back, booking failed)
- Look for confirmation language: "confirmed", "scheduled", "booked", "finalized", "set for"
- Pay attention to context - if someone "called to book but found fully booked", that's NO
- If the agent "confirmed the appointment for [date/time]", that's YES

Call Summary:
${summaryText}

Answer (YES or NO only):`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing phone call summaries. Determine if an appointment was successfully booked. Return ONLY "YES" or "NO" based on whether the appointment was confirmed/scheduled.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Low temperature for consistent results
      max_tokens: 10
    });
    
    // Parse response
    const answer = response.choices[0]?.message?.content?.trim().toUpperCase() || '';
    const isYes = answer.startsWith('YES');
    const isNo = answer.startsWith('NO');
    
    if (!isYes && !isNo) {
      console.warn(`⚠️ AI returned unexpected response: "${answer}". Using keyword fallback.`);
      return null; // Fall back to keyword matching
    }
    
    const result = isYes;
    console.log(`🤖 AI Decision: "${answer}" → ${result ? 'Appointment Booked ✅' : 'No Appointment ❌'}`);
    return result;
    
  } catch (error) {
    // Handle rate limit errors specifically
    if (error.response && error.response.status === 429) {
      const errorMessage = error.response.data?.error?.message || error.message;
      console.error(`❌ OpenAI rate limit error: ${errorMessage}`);
      console.log('📝 Falling back to keyword matching');
      // Remove the request time we just added since it failed
      if (openAIRequestTimes.length > 0) {
        openAIRequestTimes.pop();
      }
      return null; // Fall back to keyword matching
    }
    
    console.error('❌ OpenAI API error:', error.message);
    console.log('📝 Falling back to keyword matching');
    // Remove the request time we just added since it failed
    if (openAIRequestTimes.length > 0) {
      openAIRequestTimes.pop();
    }
    return null; // Fall back to keyword matching
  }
};

// Simple keyword-based appointment detection (FALLBACK ONLY - when OpenAI is not available)
// This is a basic fallback - AI is much better at understanding context
const detectAppointmentBookedWithKeywords = (summaryText) => {
  if (!summaryText || typeof summaryText !== 'string') {
    return false;
  }
  
  const text = summaryText.toLowerCase();
  
  // Check for clear negative indicators first
  const negativeIndicators = [
    'fully booked',
    'no appointments available',
    'no availability',
    'called to book but',
    'tried to book but',
    'couldn\'t book',
    'unable to book',
    'would call back',
    'will call back',
    'call back if',
    'wait until',
    'no slots available'
  ];
  
  for (const negative of negativeIndicators) {
    if (text.includes(negative)) {
      console.log(`📝 Keyword fallback: Negative indicator found: "${negative}" → No appointment`);
      return false;
    }
  }
  
  // Check for clear positive indicators
  const positiveIndicators = [
    'confirmed the appointment',
    'appointment confirmed',
    'agent confirmed',
    'appointment scheduled for',
    'appointment booked for',
    'finalized the details',
    'after finalizing',
    'scheduled for',
    'booked for'
  ];
  
  for (const positive of positiveIndicators) {
    if (text.includes(positive)) {
      console.log(`📝 Keyword fallback: Positive indicator found: "${positive}" → Appointment booked`);
      return true;
    }
  }
  
  // If no clear indicators, default to false (conservative approach)
  console.log(`📝 Keyword fallback: No clear indicators → No appointment (default)`);
  return false;
};

// Main appointment detection function
// PRIMARY: Uses OpenAI AI (much better at understanding context)
// FALLBACK: Simple keyword matching (only when AI is not available)
const detectAppointmentBooked = async (summaryText) => {
  if (!summaryText || typeof summaryText !== 'string') {
    return false;
  }
  
  // PRIMARY METHOD: Try AI first (if available)
  // AI can understand context, nuances, and edge cases much better than keyword matching
  const aiResult = await detectAppointmentBookedWithAI(summaryText);
  if (aiResult !== null) {
    // AI provided an answer - trust it (it's much smarter than keyword matching)
    return aiResult;
  }
  
  // FALLBACK: Only use simple keyword matching if AI is not available
  console.log('📝 AI not available - using simple keyword fallback');
  return detectAppointmentBookedWithKeywords(summaryText);
};

// Helper to make Twilio API requests with fallback to Auth Token if API Keys fail
const twilioRequest = async (method, endpoint, formData = null, retryWithAuthToken = true) => {
  let credentials = getTwilioCredentials();
  const baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}`;
  
  // Detailed logging for debugging authentication issues
  console.log('🔐 Twilio API Request:', {
    method,
    endpoint,
    accountSid: `${credentials.accountSid.substring(0, 4)}...`,
    username: `${credentials.username.substring(0, 4)}...`,
    passwordLength: credentials.password?.length || 0,
    usingApiKey: credentials.usingApiKey,
    url: `${baseUrl}${endpoint}`
  });
  
  try {
    const config = {
      method,
      url: `${baseUrl}${endpoint}`,
      auth: {
        username: credentials.username, // API Key SID (if using API Keys) or Account SID (if using Auth Token)
        password: credentials.password, // API Key Secret (if using API Keys) or Auth Token (if using Auth Token)
      },
    };
    
    if (formData && method === 'POST') {
      config.headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      config.data = formData;
    }
    
    const response = await axios(config);
    console.log(`✅ Twilio API success: ${method} ${endpoint} (using ${credentials.usingApiKey ? 'API Key' : 'Auth Token'})`);
    return response.data;
  } catch (error) {
    // If API Keys failed with 401/403 and we have Auth Token available, try fallback
    const isAuthError = error.response?.status === 401 || error.response?.status === 403;
    const hasAuthToken = !!process.env.TWILIO_AUTH_TOKEN;
    const wasUsingApiKey = credentials.usingApiKey;
    
    if (isAuthError && retryWithAuthToken && wasUsingApiKey && hasAuthToken) {
      console.warn('⚠️ API Key authentication failed, falling back to Auth Token...');
      console.log('🔄 Retrying with Auth Token:', {
        method,
        endpoint,
        accountSid: `${credentials.accountSid.substring(0, 4)}...`
      });
      
      // Retry with Auth Token
      credentials = {
        accountSid: credentials.accountSid,
        username: credentials.accountSid, // Use Account SID as username for Auth Token
        password: process.env.TWILIO_AUTH_TOKEN, // Use Auth Token as password
        usingApiKey: false
      };
      
      try {
        const retryConfig = {
          method,
          url: `${baseUrl}${endpoint}`,
          auth: {
            username: credentials.username,
            password: credentials.password,
          },
        };
        
        if (formData && method === 'POST') {
          retryConfig.headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
          };
          retryConfig.data = formData;
        }
        
        const retryResponse = await axios(retryConfig);
        console.log(`✅ Twilio API success: ${method} ${endpoint} (using Auth Token fallback)`);
        return retryResponse.data;
      } catch (retryError) {
        console.error('❌ Twilio API error (Auth Token fallback also failed):', {
          method,
          endpoint,
          status: retryError.response?.status,
          statusText: retryError.response?.statusText,
          data: retryError.response?.data,
          message: retryError.message
        });
        throw retryError;
      }
    }
    
    // Log the original error
    console.error('❌ Twilio API error:', {
      method,
      endpoint,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      accountSid: `${credentials.accountSid.substring(0, 4)}...`,
      usingApiKey: credentials.usingApiKey,
      triedFallback: isAuthError && wasUsingApiKey && hasAuthToken,
      // Don't log actual credentials, but log their presence
      hasUsername: !!credentials.username,
      hasPassword: !!credentials.password,
      usernameLength: credentials.username?.length,
      passwordLength: credentials.password?.length
    });
    throw error;
  }
};

// ============================================
// Admin Endpoints - Phone Number Management
// ============================================

// GET /api/twilio/numbers - List all available Twilio phone numbers (admin only)
router.get('/numbers', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    // Check if Twilio credentials are configured
    let credentials;
    try {
      credentials = getTwilioCredentials();
      
      // Validate credential format
      const accountSidPattern = /^AC[a-f0-9]{32}$/i;
      if (!accountSidPattern.test(process.env.TWILIO_ACCOUNT_SID)) {
        console.warn('⚠️ TWILIO_ACCOUNT_SID format may be invalid (should start with AC and be 34 chars)');
      }
      
      if (credentials.usingApiKey) {
        const apiKeyPattern = /^SK[a-f0-9]{32}$/i;
        if (!apiKeyPattern.test(process.env.TWILIO_API_KEY_SID)) {
          console.warn('⚠️ TWILIO_API_KEY_SID format may be invalid (should start with SK and be 34 chars)');
        }
      }
      
      console.log('🔍 Twilio credentials check:', {
        hasAccountSid: !!process.env.TWILIO_ACCOUNT_SID,
        accountSidLength: process.env.TWILIO_ACCOUNT_SID?.length,
        accountSidPrefix: process.env.TWILIO_ACCOUNT_SID?.substring(0, 4),
        accountSidFull: process.env.TWILIO_ACCOUNT_SID, // Log full value for debugging
        hasApiKey: !!(process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET),
        apiKeySidLength: process.env.TWILIO_API_KEY_SID?.length,
        apiKeySidPrefix: process.env.TWILIO_API_KEY_SID?.substring(0, 4),
        apiKeySidFull: process.env.TWILIO_API_KEY_SID, // Log full value for debugging
        apiKeySecretLength: process.env.TWILIO_API_KEY_SECRET?.length,
        apiKeySecretPrefix: process.env.TWILIO_API_KEY_SECRET?.substring(0, 4), // First 4 chars only
        hasAuthToken: !!process.env.TWILIO_AUTH_TOKEN,
        usingApiKey: credentials.usingApiKey,
        environment: process.env.NODE_ENV || 'development',
        backendUrl: process.env.BACKEND_URL || 'NOT SET',
        railwayDomain: process.env.RAILWAY_PUBLIC_DOMAIN || 'NOT SET'
      });
    } catch (credError) {
      console.error('❌ Twilio credentials not configured:', credError.message);
      const missingVars = [];
      if (!process.env.TWILIO_ACCOUNT_SID) missingVars.push('TWILIO_ACCOUNT_SID');
      if (!process.env.TWILIO_API_KEY_SID && !process.env.TWILIO_AUTH_TOKEN) {
        if (!process.env.TWILIO_API_KEY_SID) missingVars.push('TWILIO_API_KEY_SID');
        if (!process.env.TWILIO_API_KEY_SECRET && !process.env.TWILIO_AUTH_TOKEN) {
          missingVars.push('TWILIO_API_KEY_SECRET or TWILIO_AUTH_TOKEN');
        }
      }
      
      console.error('❌ Missing environment variables:', missingVars);
      console.error('❌ Available env vars:', {
        TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ? `${process.env.TWILIO_ACCOUNT_SID.substring(0, 4)}...` : 'NOT SET',
        TWILIO_API_KEY_SID: process.env.TWILIO_API_KEY_SID ? `${process.env.TWILIO_API_KEY_SID.substring(0, 4)}...` : 'NOT SET',
        TWILIO_API_KEY_SECRET: process.env.TWILIO_API_KEY_SECRET ? 'SET' : 'NOT SET',
        TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ? 'SET' : 'NOT SET'
      });
      return res.status(500).json({ 
        error: 'Twilio credentials not configured',
        details: credError.message,
        missing: missingVars,
        help: 'Please set either TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET (recommended) or TWILIO_AUTH_TOKEN in environment variables.'
      });
    }
    
    const numbers = await twilioRequest('GET', '/IncomingPhoneNumbers.json');
    
    const formattedNumbers = numbers.incoming_phone_numbers.map(num => ({
      phoneNumber: num.phone_number,
      friendlyName: num.friendly_name,
      sid: num.sid,
      capabilities: {
        voice: num.capabilities.voice,
        sms: num.capabilities.sms,
        mms: num.capabilities.mms,
      },
      // Check if this number is already assigned to a clinic
      assigned: false, // We'll update this below
    }));
    
    // Check which numbers are already assigned to clinics
    const assignedNumbers = await User.find({ 
      twilioPhoneNumber: { $ne: null },
      role: 'customer' 
    }).select('twilioPhoneNumber name');
    
    const assignedNumberSet = new Set(assignedNumbers.map(u => u.twilioPhoneNumber));
    
    formattedNumbers.forEach(num => {
      num.assigned = assignedNumberSet.has(num.phoneNumber);
      if (num.assigned) {
        const clinic = assignedNumbers.find(u => u.twilioPhoneNumber === num.phoneNumber);
        num.assignedTo = clinic ? clinic.name : 'Unknown';
      }
    });
    
    console.log(`✅ Successfully fetched ${formattedNumbers.length} Twilio phone numbers`);
    res.json({ numbers: formattedNumbers });
  } catch (error) {
    console.error('❌ Error fetching Twilio numbers:', error);
    console.error('❌ Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    // Provide more helpful error messages
    let errorMessage = 'Failed to fetch Twilio phone numbers';
    let errorDetails = error.message;
    
    if (error.response?.status === 401 || error.response?.status === 403) {
      errorMessage = 'Twilio authentication failed';
      errorDetails = 'Invalid Twilio credentials. Please check your TWILIO_ACCOUNT_SID and authentication method (API Key or Auth Token).';
    } else if (error.response?.status === 404) {
      errorMessage = 'Twilio account not found';
      errorDetails = 'The Twilio Account SID does not exist or is incorrect.';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: errorDetails,
      help: 'Please verify your Twilio credentials are set correctly in environment variables.'
    });
  }
});

// POST /api/twilio/connect - Connect a Twilio phone number to a clinic (admin only)
router.post('/connect', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { clinicId, phoneNumber, forwardNumber, forwardNumberNew, forwardNumberExisting, menuMessage, voice } = req.body;
    
    if (!clinicId || !phoneNumber) {
      return res.status(400).json({ 
        error: 'Missing required fields: clinicId and phoneNumber are required' 
      });
    }
    
    // At least one forward number must be provided
    if (!forwardNumber && !forwardNumberNew && !forwardNumberExisting) {
      return res.status(400).json({ 
        error: 'At least one forward number is required (forwardNumber, forwardNumberNew, or forwardNumberExisting)' 
      });
    }
    
    // Validate phone number format (E.164)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({ 
        error: 'Invalid phone number format. Please use E.164 format (e.g., +14165551234)' 
      });
    }
    
    // Validate forward numbers if provided
    const forwardNumbers = [forwardNumber, forwardNumberNew, forwardNumberExisting].filter(Boolean);
    for (const num of forwardNumbers) {
      if (!phoneRegex.test(num)) {
        return res.status(400).json({ 
          error: `Invalid forward number format: ${num}. Please use E.164 format (e.g., +14165551234)` 
        });
      }
    }
    
    // Check if this phone number is already assigned to another clinic
    const existingConnection = await User.findOne({
      twilioPhoneNumber: phoneNumber,
      _id: { $ne: clinicId },
      role: 'customer'
    });
    
    if (existingConnection) {
      return res.status(400).json({
        error: `This phone number is already connected to clinic: ${existingConnection.name}`
      });
    }
    
    // Verify the phone number exists in Twilio account
    try {
      const numbers = await twilioRequest('GET', '/IncomingPhoneNumbers.json');
      const numberExists = numbers.incoming_phone_numbers.some(
        num => num.phone_number === phoneNumber
      );
      
      if (!numberExists) {
        return res.status(400).json({
          error: 'Phone number not found in Twilio account'
        });
      }
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to verify phone number with Twilio',
        details: error.message
      });
    }
    
    // Update the clinic with Twilio phone number and forward numbers
    const updateData = {
      twilioPhoneNumber: phoneNumber,
    };
    
    // Set forward numbers (use provided values or null if not provided)
    if (forwardNumber) {
      updateData.twilioForwardNumber = forwardNumber;
    }
    if (forwardNumberNew) {
      updateData.twilioForwardNumberNew = forwardNumberNew;
    }
    if (forwardNumberExisting) {
      updateData.twilioForwardNumberExisting = forwardNumberExisting;
    }
    
    // Set custom menu message if provided
    if (menuMessage !== undefined) {
      updateData.twilioMenuMessage = menuMessage || null; // Allow empty string to clear custom message
    }
    
    // Handle voice update with validation
    if (voice !== undefined) {
      if (voice) {
        const validatedVoice = validateAndGetVoice(voice);
        updateData.twilioVoice = validatedVoice;
        console.log(`[VOICE UPDATE] Clinic: ${clinicId} | New voice: ${validatedVoice}`);
      } else {
        // Empty string or null clears custom voice (will use default)
        updateData.twilioVoice = null;
        console.log(`[VOICE UPDATE] Clinic: ${clinicId} | Voice cleared, will use default: ${TTS_VOICE}`);
      }
    }
    
    // Simplified logic: If only one forward number is provided, use it for both options
    const enableMenu = process.env.TWILIO_ENABLE_MENU === 'true';
    if (enableMenu) {
      // If default forward number is set but new/existing are not, use default for both
      if (forwardNumber && !forwardNumberNew && !forwardNumberExisting) {
        updateData.twilioForwardNumberNew = forwardNumber;
        updateData.twilioForwardNumberExisting = forwardNumber;
      }
      // If new patient number is set but existing is not, use new for existing too
      else if (forwardNumberNew && !forwardNumberExisting) {
        updateData.twilioForwardNumberExisting = forwardNumberNew;
        if (!forwardNumber) {
          updateData.twilioForwardNumber = forwardNumberNew;
        }
      }
      // If existing patient number is set but new is not, use existing for new too
      else if (forwardNumberExisting && !forwardNumberNew) {
        updateData.twilioForwardNumberNew = forwardNumberExisting;
        if (!forwardNumber) {
          updateData.twilioForwardNumber = forwardNumberExisting;
        }
      }
      // If no default but both new and existing are set, use new as default
      else if (!forwardNumber && forwardNumberNew && forwardNumberExisting) {
        updateData.twilioForwardNumber = forwardNumberNew;
      }
    }
    
    const user = await User.findByIdAndUpdate(
      clinicId,
      updateData,
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'Clinic not found' });
    }
    
    // Update Twilio webhook configuration for this number
    // We need to get the phone number SID first
    try {
      const numbers = await twilioRequest('GET', '/IncomingPhoneNumbers.json');
      const phoneNumberObj = numbers.incoming_phone_numbers.find(
        num => num.phone_number === phoneNumber
      );
      
      if (phoneNumberObj) {
        const baseUrl = process.env.BACKEND_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3000';
        let webhookUrl = baseUrl.replace(/\/$/, '');
        if (!webhookUrl.startsWith('http://localhost') && !webhookUrl.startsWith('https://')) {
          webhookUrl = `https://${webhookUrl}`;
        }
        
        // Update voice webhook
        await twilioRequest('POST', `/IncomingPhoneNumbers/${phoneNumberObj.sid}.json`, 
          `VoiceUrl=${encodeURIComponent(`${webhookUrl}/api/twilio/voice/incoming`)}&VoiceMethod=POST&StatusCallback=${encodeURIComponent(`${webhookUrl}/api/twilio/voice/status-callback`)}&StatusCallbackMethod=POST`
        );
        
        console.log(`✅ Updated webhook for ${phoneNumber} to ${webhookUrl}/api/twilio/voice/incoming`);
      }
    } catch (error) {
      console.error('Warning: Failed to update Twilio webhook configuration:', error);
      // Don't fail the request, but log the warning
    }
    
    console.log(`✅ Connected Twilio number ${phoneNumber} to clinic: ${user.name}`);
    res.json({ 
      message: 'Twilio phone number connected successfully',
      user: {
        _id: user._id,
        name: user.name,
        twilioPhoneNumber: user.twilioPhoneNumber,
        twilioForwardNumber: user.twilioForwardNumber,
        twilioForwardNumberNew: user.twilioForwardNumberNew,
        twilioForwardNumberExisting: user.twilioForwardNumberExisting,
        twilioMenuMessage: user.twilioMenuMessage,
        twilioVoice: user.twilioVoice,
      }
    });
  } catch (error) {
    console.error('Error connecting Twilio number:', error);
    res.status(500).json({ 
      error: 'Failed to connect Twilio phone number',
      details: error.message 
    });
  }
});

// PATCH /api/twilio/update-message/:clinicId - Update menu message for a connected clinic (admin only)
router.patch('/update-message/:clinicId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { menuMessage } = req.body;
    
    // Verify clinic exists and is connected
    const user = await User.findById(clinicId);
    if (!user) {
      return res.status(404).json({ error: 'Clinic not found' });
    }
    
    if (!user.twilioPhoneNumber) {
      return res.status(400).json({ error: 'Clinic is not connected to a Twilio number' });
    }
    
    // Update menu message (allow null to reset to default)
    const updateData = {};
    if (menuMessage !== undefined) {
      updateData.twilioMenuMessage = menuMessage || null;
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      clinicId,
      updateData,
      { new: true }
    );
    
    console.log(`✅ Updated menu message for clinic: ${updatedUser.name}`);
    res.json({ 
      message: 'Menu message updated successfully',
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        twilioPhoneNumber: updatedUser.twilioPhoneNumber,
        twilioMenuMessage: updatedUser.twilioMenuMessage,
        twilioVoice: updatedUser.twilioVoice,
      }
    });
  } catch (error) {
    console.error('Error updating menu message:', error);
    res.status(500).json({ 
      error: 'Failed to update menu message',
      details: error.message 
    });
  }
});

// PATCH /api/twilio/disconnect/:clinicId - Disconnect Twilio from a clinic (admin only)
router.patch('/disconnect/:clinicId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { clinicId } = req.params;
    
    const user = await User.findByIdAndUpdate(
      clinicId,
      {
        twilioPhoneNumber: null,
        twilioForwardNumber: null,
        twilioForwardNumberNew: null,
        twilioForwardNumberExisting: null,
        twilioMenuMessage: null,
      },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'Clinic not found' });
    }
    
    console.log(`✅ Disconnected Twilio from clinic: ${user.name}`);
    res.json({ 
      message: 'Twilio disconnected successfully',
      user: {
        _id: user._id,
        name: user.name,
        twilioPhoneNumber: user.twilioPhoneNumber,
        twilioForwardNumber: user.twilioForwardNumber,
        twilioForwardNumberNew: user.twilioForwardNumberNew,
        twilioForwardNumberExisting: user.twilioForwardNumberExisting,
        twilioMenuMessage: user.twilioMenuMessage,
        twilioVoice: user.twilioVoice,
      }
    });
  } catch (error) {
    console.error('Error disconnecting Twilio:', error);
    res.status(500).json({ 
      error: 'Failed to disconnect Twilio',
      details: error.message 
    });
  }
});

// ============================================
// Webhook Endpoints - Public (called by Twilio)
// ============================================

// POST /api/twilio/voice/incoming - Handle incoming calls
router.post('/voice/incoming', async (req, res) => {
  try {
    const { From, To, CallSid, Digits, CallStatus } = req.body;
    
    console.log(`📞 Incoming call received:`);
    console.log(`   From: ${From}`);
    console.log(`   To: ${To}`);
    console.log(`   CallSid: ${CallSid}`);
    console.log(`   Digits: ${Digits || 'none'}`);
    console.log(`   CallStatus: ${CallStatus || 'none'}`);
    
    // Normalize phone number format (remove spaces, ensure consistent format)
    const normalizedTo = To ? To.replace(/\s/g, '').trim() : To;
    console.log(`   Normalized To: ${normalizedTo}`);
    
    // Find which clinic owns this phone number
    // Try multiple formats to handle different phone number formats
    let clinic = await User.findOne({
      $or: [
        { twilioPhoneNumber: normalizedTo, role: 'customer' },
        { twilioPhoneNumber: To, role: 'customer' },
        { twilioPhoneNumber: normalizedTo.replace(/^\+/, ''), role: 'customer' },
        { twilioPhoneNumber: To.replace(/^\+/, ''), role: 'customer' }
      ]
    });
    
    if (!clinic) {
      // Try without country code
      const toWithoutCountry = normalizedTo.replace(/^\+1/, '');
      clinic = await User.findOne({
        twilioPhoneNumber: { $regex: toWithoutCountry, $options: 'i' },
        role: 'customer'
      });
    }
    
    // Check if clinic exists and has at least one forward number configured
    const hasForwardNumber = clinic && (
      clinic.twilioForwardNumber || 
      clinic.twilioForwardNumberNew || 
      clinic.twilioForwardNumberExisting
    );
    
    if (!clinic || !hasForwardNumber) {
      console.error(`❌ No clinic found for phone number: ${To} or no forward number configured`);
      console.error(`   Clinic found: ${!!clinic}`);
      if (clinic) {
        console.error(`   Forward numbers: ${JSON.stringify({
          twilioForwardNumber: clinic.twilioForwardNumber,
          twilioForwardNumberNew: clinic.twilioForwardNumberNew,
          twilioForwardNumberExisting: clinic.twilioForwardNumberExisting
        })}`);
      }
      // Get voice for error message - use clinic's voice if available, otherwise default
      const requestedErrorVoice = clinic?.twilioVoice || TTS_VOICE;
      const errorVoice = validateAndGetVoice(requestedErrorVoice);
      const generateSayVerb = (text, voiceSetting = errorVoice) => {
        // Twilio requires language attribute for all voices (per official docs)
        // FORCE the voice to be our constant - never trust the parameter
        const finalVoice = TTS_VOICE;
        console.log(`[VOICE DEBUG] Error handler generateSayVerb: "${voiceSetting}" → using: "${finalVoice}"`);
        return `<Say voice="${finalVoice}" language="en-US">${text}</Say>`;
      };
      const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${generateSayVerb('Sorry, this number is not configured. Please contact your administrator.')}
  <Hangup/>
</Response>`;
      res.type('text/xml');
      return res.send(errorTwiML);
    }
    
    const enableMenu = process.env.TWILIO_ENABLE_MENU === 'true';
    
    // Determine forward number based on menu choice
    // Try to get forward number in priority order: specific > general
    let forwardNumber = clinic.twilioForwardNumber || 
                       clinic.twilioForwardNumberNew || 
                       clinic.twilioForwardNumberExisting;
    
    if (enableMenu && Digits) {
      // Menu system: use separate numbers for new vs existing patients
      if (Digits === '1') {
        // New patient - use new patient number, or existing patient number, or default
        forwardNumber = clinic.twilioForwardNumberNew || 
                       clinic.twilioForwardNumberExisting || 
                       clinic.twilioForwardNumber;
      } else if (Digits === '2') {
        // Existing patient - use existing patient number, or new patient number, or default
        forwardNumber = clinic.twilioForwardNumberExisting || 
                       clinic.twilioForwardNumberNew || 
                       clinic.twilioForwardNumber;
      }
    }
    
    // Final fallback - if still no forward number, error (should not happen due to check above)
    if (!forwardNumber) {
      console.error(`❌ No forward number configured for clinic: ${clinic.name}`);
      console.error(`   Available forward numbers: ${JSON.stringify({
        twilioForwardNumber: clinic.twilioForwardNumber,
        twilioForwardNumberNew: clinic.twilioForwardNumberNew,
        twilioForwardNumberExisting: clinic.twilioForwardNumberExisting
      })}`);
      // Get voice for error message - use default
      const errorVoice = validateAndGetVoice(TTS_VOICE);
      const generateSayVerb = (text, voiceSetting = errorVoice) => {
        // Twilio requires language attribute for all voices (per official docs)
        // FORCE the voice to be our constant - never trust the parameter
        const finalVoice = TTS_VOICE;
        console.log(`[VOICE DEBUG] Error handler generateSayVerb: "${voiceSetting}" → using: "${finalVoice}"`);
        return `<Say voice="${finalVoice}" language="en-US">${text}</Say>`;
      };
      const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${generateSayVerb('Sorry, this number is not configured. Please contact your administrator.')}
  <Hangup/>
</Response>`;
      res.type('text/xml');
      return res.send(errorTwiML);
    }
    
    console.log(`✅ Forward number determined: ${forwardNumber}`);
    console.log(`   Forward number format check: ${/^\+[1-9]\d{1,14}$/.test(forwardNumber) ? '✅ Valid E.164 format' : '❌ Invalid format - must be +1XXXXXXXXXX'}`);
    
    // Validate forward number format
    if (!/^\+[1-9]\d{1,14}$/.test(forwardNumber)) {
      console.error(`❌ Invalid forward number format: ${forwardNumber}`);
      console.error(`   Forward number must be in E.164 format: +1XXXXXXXXXX`);
      // Get voice for error message (before main voice declaration) - use clinic's voice if available
      const requestedErrorVoice = clinic?.twilioVoice || TTS_VOICE;
      const errorVoice = validateAndGetVoice(requestedErrorVoice);
      const generateSayVerb = (text, voiceSetting = errorVoice) => {
        // Twilio requires language attribute for all voices (per official docs)
        // FORCE the voice to be our constant - never trust the parameter
        const finalVoice = TTS_VOICE;
        console.log(`[VOICE DEBUG] Error handler generateSayVerb: "${voiceSetting}" → using: "${finalVoice}"`);
        return `<Say voice="${finalVoice}" language="en-US">${text}</Say>`;
      };
      const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${generateSayVerb('Sorry, the forward number is not configured correctly. Please contact your administrator.')}
  <Hangup/>
</Response>`;
      res.type('text/xml');
      return res.send(errorTwiML);
    }
    
    // Get voice setting - use clinic's custom voice, fallback to hard-coded default
    // NO ENV VARIABLE - use database value or hard-coded constant only
    const requestedVoice = clinic.twilioVoice || TTS_VOICE;
    const voice = validateAndGetVoice(requestedVoice);
    
    // Log the voice being used (for debugging - confirms code path is using correct voice)
    console.log(`[VOICE] Using Twilio TTS voice: ${voice} | Clinic: ${clinic.name || clinic._id}`);
    console.log(`[VOICE DEBUG] Clinic.twilioVoice: ${clinic.twilioVoice || 'null'} | Requested: ${requestedVoice} | Validated: ${voice}`);
    
    // Helper function to generate Say verb with proper voice attributes
    // escapeTwiML prevents invalid XML when clinic name or menu message contains &, <, >, etc.
    const generateSayVerb = (text, voiceSetting = voice) => {
      const finalVoice = TTS_VOICE;
      const safeText = escapeTwiML(String(text));
      return `<Say voice="${finalVoice}" language="en-US">${safeText}</Say>`;
    };
    
    // Get custom menu message or use default with clinic name
    // If custom message is set, use it as-is (clinic name can be included manually if desired)
    // Otherwise, generate default message: "Thank you for calling [clinic name]..."
    let menuMessage;
    if (clinic.twilioMenuMessage) {
      // Custom message set by admin - use as-is
      menuMessage = clinic.twilioMenuMessage;
    } else if (process.env.TWILIO_MENU_MESSAGE) {
      // Environment variable set - use as-is
      menuMessage = process.env.TWILIO_MENU_MESSAGE;
    } else {
      // Default message with clinic name: "Thank you for calling [clinic name]..."
      const clinicName = clinic.name || 'our office';
      menuMessage = `Thank you for calling ${clinicName}. Press 1 for new patients, press 2 for existing patients.`;
    }
    
    // Get the base URL for callback (for menu system)
    let baseUrl = process.env.BACKEND_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3000';
    baseUrl = baseUrl.replace(/\/$/, '');
    if (!baseUrl.startsWith('http://localhost') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    const callbackUrl = `${baseUrl}/api/twilio/voice/incoming`;
    
    console.log(`✅ Call routing to clinic: ${clinic.name}`);
    console.log(`   Menu enabled: ${enableMenu}`);
    if (enableMenu && Digits) {
      console.log(`   Menu choice: ${Digits} (${Digits === '1' ? 'New Patient' : 'Existing Patient'})`);
    }
    console.log(`   Forwarding to: ${forwardNumber}`);
    // Caller ID: we do NOT set callerId on <Dial>. Twilio default = inbound caller's ID, so clinic sees
    // patient's number when available, or Private/Unknown when patient blocks ID. Never override = can't mess up.
    console.log(`   Caller ID: From="${From}" (stored in CallLog); Dial=no callerId (Twilio default: clinic sees patient number or Private/Unknown)`);
    
    let twiML;
    
    // Create or update call log entry (always, if CallSid exists)
    if (CallSid) {
      // Store From exactly as Twilio sent it (e.g. +1..., or "anonymous" when caller blocks ID) for logs/reporting
      const logData = {
        customerId: clinic._id,
        twilioPhoneNumber: To,
        callSid: CallSid,
        from: From,
        to: To,
        direction: 'inbound',
        status: CallStatus || 'ringing',
        startedAt: new Date()
      };
      
      // If menu choice is provided, include it
      if (Digits) {
        logData.menuChoice = Digits;
      }
      
      await CallLog.findOneAndUpdate(
        { callSid: CallSid },
        logData,
        { upsert: true, setDefaultsOnInsert: true }
      ).catch(err => console.error('Error creating/updating call log:', err));
    }
    
    // Check if call recording is enabled
    const enableRecording = process.env.TWILIO_ENABLE_RECORDING === 'true';
    const enableTranscription = process.env.TWILIO_ENABLE_TRANSCRIPTION === 'true';
    const recordingStatusCallback = enableRecording ? `${baseUrl}/api/twilio/voice/recording-status` : null;
    
    // Dial status callback - to track if clinic answered the forwarded call
    const dialStatusCallback = `${baseUrl}/api/twilio/voice/dial-status`;
    
    // Get Voice Intelligence Service SID for real-time transcription (if enabled)
    const viServiceSid = process.env.TWILIO_VI_SERVICE_SID || null;
    
    // Brief recording/transcription disclosure (for compliance - only if recording or transcription is enabled)
    // This is played AFTER menu selection, before connecting the call
    const needsDisclosure = enableRecording || enableTranscription;
    const disclosureMessage = needsDisclosure 
      ? generateSayVerb('This call may be recorded and transcribed for quality assurance and scheduling.')
      : '';
    
    // v2: Menu system - handle digit selection (user pressed 1 or 2)
    if (enableMenu && Digits) {
      console.log(`✅ User pressed: ${Digits} (${Digits === '1' ? 'New Patient' : 'Existing Patient'})`);
      console.log(`   Forwarding to: ${forwardNumber}`);
      
      // Build TwiML with disclosure AFTER menu selection, then connect call
      // Disclosure must come BEFORE transcription start and dial
      let transcriptionStart = '';
      if (enableTranscription && viServiceSid) {
        // Real-time transcription using Voice Intelligence Service
        transcriptionStart = `<Start><Transcription intelligenceService="${viServiceSid}" track="both"/></Start>`;
      }
      
      // Voicemail recording callback (when dial times out or no answer)
      const voicemailCallback = `${baseUrl}/api/twilio/voice/voicemail?CallSid=${CallSid}`;
      
      if (enableRecording) {
        twiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${disclosureMessage}
  ${transcriptionStart}
  <Dial timeout="30" action="${voicemailCallback}" record="record-from-answer" recordingStatusCallback="${recordingStatusCallback}" recordingStatusCallbackMethod="POST" statusCallback="${dialStatusCallback}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST">
    <Number>${forwardNumber}</Number>
  </Dial>
</Response>`;
      } else {
        twiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${disclosureMessage}
  ${transcriptionStart}
  <Dial timeout="30" action="${voicemailCallback}" statusCallback="${dialStatusCallback}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST">
    <Number>${forwardNumber}</Number>
  </Dial>
</Response>`;
      }
    }
    // v2: Menu system - show menu (first time, no digits yet)
    else if (enableMenu) {
      console.log(`📋 Showing menu to caller`);
      console.log(`   Custom message: ${menuMessage}`);
      
      // Generate TwiML with explicit voice logging
      const menuTwiML = generateSayVerb(menuMessage);
      const timeoutTwiML = generateSayVerb('We didn\'t receive your selection. Please call back and try again.');
      console.log(`[VOICE DEBUG] Generated menu TwiML: ${menuTwiML.substring(0, 100)}...`);
      
      // Show menu FIRST (no disclosure yet)
      twiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather action="${callbackUrl}" method="POST" numDigits="1" timeout="10">
    ${menuTwiML}
  </Gather>
  ${timeoutTwiML}
  <Hangup/>
</Response>`;
      
      console.log(`[VOICE DEBUG] Final TwiML (first 500 chars): ${twiML.substring(0, 500)}`);
    }
    // v1: Simple forward (default) - no menu
    else {
      // Build TwiML with optional transcription
      // Disclosure must come BEFORE transcription start
      let transcriptionStart = '';
      if (enableTranscription && viServiceSid) {
        // Real-time transcription using Voice Intelligence Service
        transcriptionStart = `<Start><Transcription intelligenceService="${viServiceSid}" track="both"/></Start>`;
      }
      
      // Voicemail recording callback (when dial times out or no answer)
      const voicemailCallback = `${baseUrl}/api/twilio/voice/voicemail?CallSid=${CallSid}`;
      
      if (enableRecording) {
        twiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${disclosureMessage}
  ${transcriptionStart}
  <Dial timeout="30" action="${voicemailCallback}" record="record-from-answer" recordingStatusCallback="${recordingStatusCallback}" recordingStatusCallbackMethod="POST" statusCallback="${dialStatusCallback}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST">
    <Number>${forwardNumber}</Number>
  </Dial>
</Response>`;
      } else {
        twiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${disclosureMessage}
  ${transcriptionStart}
  <Dial timeout="30" action="${voicemailCallback}" statusCallback="${dialStatusCallback}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST">
    <Number>${forwardNumber}</Number>
  </Dial>
</Response>`;
      }
    }
    
    res.type('text/xml');
    res.send(twiML);
    
    console.log(`✅ Call processed - ${enableMenu && Digits ? `Menu option ${Digits} selected` : enableMenu ? 'Menu shown' : 'Forwarded directly'}`);
    console.log(`📤 TwiML Response sent:`);
    console.log(twiML);
  } catch (error) {
    console.error('❌ Error handling incoming call:', error);
    console.error('   Error stack:', error.stack);
    console.error('   Error message:', error.message);
    // Return silent Hangup only—no Say, no message. Twilio would otherwise play "application error has occurred".
    res.type('text/xml');
    res.status(200);
    res.send(SILENT_HANGUP_TWIML);
  }
});

// POST /api/twilio/voice/status-callback - Handle call status updates
router.post('/voice/status-callback', async (req, res) => {
  try {
    const {
      CallSid,
      CallStatus,
      From,
      To,
      CallDuration,
      Direction,
      Timestamp,
      // Dial Call Status (if available in status callback)
      DialCallStatus,
      DialCallDuration,
      // Caller Information
      FromCity,
      FromState,
      FromZip,
      FromCountry,
      CallerName,
      // Call Quality (if available)
      Jitter,
      PacketLoss,
      Latency,
      // Call Pricing
      Price,
      PriceUnit
    } = req.body;
    
    // Find which clinic this call belongs to (same multi-format as /voice/incoming)
    const normalizedTo = To ? To.replace(/\s/g, '').trim() : To;
    let clinic = await User.findOne({
      $or: [
        { twilioPhoneNumber: normalizedTo, role: 'customer' },
        { twilioPhoneNumber: To, role: 'customer' },
        ...(normalizedTo ? [{ twilioPhoneNumber: normalizedTo.replace(/^\+/, ''), role: 'customer' }] : []),
        ...(To ? [{ twilioPhoneNumber: String(To).replace(/^\+/, ''), role: 'customer' }] : [])
      ]
    });
    if (!clinic && normalizedTo) {
      const toWithoutCountry = normalizedTo.replace(/^\+1/, '');
      clinic = await User.findOne({
        twilioPhoneNumber: { $regex: toWithoutCountry, $options: 'i' },
        role: 'customer'
      });
    }
    if (!clinic) {
      console.warn(`⚠️ No clinic found for phone number: ${To}`);
      res.status(200).send('OK');
      return;
    }
    
    const callInfo = {
      callSid: CallSid,
      status: CallStatus,
      from: From,
      to: To,
      duration: CallDuration ? parseInt(CallDuration) : 0,
      direction: Direction || 'inbound',
      timestamp: Timestamp ? new Date(Timestamp) : new Date(),
      clinic: clinic.name,
      clinicId: clinic._id
    };
    
    console.log(`📊 Call status update:`);
    console.log(`   CallSid: ${callInfo.callSid}`);
    console.log(`   Status: ${callInfo.status}`);
    console.log(`   From: ${callInfo.from}`);
    console.log(`   To: ${callInfo.to}`);
    console.log(`   Clinic: ${callInfo.clinic}`);
    console.log(`   Duration: ${callInfo.duration} seconds`);
    console.log(`   Direction: ${callInfo.direction}`);
    console.log(`   Timestamp: ${callInfo.timestamp}`);
    console.log(`   DialCallStatus: ${DialCallStatus || 'not provided'}`);
    console.log(`   DialCallDuration: ${DialCallDuration || 'not provided'}`);
    
    // Save or update call log in database
    try {
      // Get existing call log to preserve menu choice
      const existingLog = await CallLog.findOne({ callSid: CallSid });
      
      const updateData = {
        customerId: clinic._id,
        twilioPhoneNumber: To,
        callSid: CallSid,
        from: From,
        to: To,
        direction: callInfo.direction,
        status: CallStatus
      };
      
      // FALLBACK LOGIC: If dialCallStatus is not set yet, try to determine it from status callback
      // This handles cases where the dial-status webhook doesn't fire or is delayed
      // CRITICAL: This also handles cases where patient cancels BEFORE Dial starts (e.g., during menu)
      if (!existingLog || !existingLog.dialCallStatus) {
        // No dialCallStatus yet - try to determine from status callback data
        
        // Option 1: Use DialCallStatus if provided in status callback
        // This means Dial was attempted (call reached forward number)
        if (DialCallStatus) {
          const dialDuration = DialCallDuration ? parseInt(DialCallDuration) : 0;
          if (DialCallStatus === 'answered') {
            updateData.dialCallStatus = 'answered';
            updateData.answerTime = new Date();
            // CRITICAL: For answered calls, duration should NEVER be 0
            if (dialDuration > 0) {
              updateData.duration = dialDuration;
            } else if (callInfo.duration > 0) {
              updateData.duration = callInfo.duration;
            } else {
              updateData.duration = 1; // Minimum 1 second for answered call
              console.log(`   ⚠️ Duration is 0 for answered call, setting minimum 1s`);
            }
            console.log(`✅ FALLBACK: Call ANSWERED (from DialCallStatus in status callback, duration: ${updateData.duration}s)`);
          } else if (DialCallStatus === 'completed') {
            // CRITICAL: 'completed' with duration > 0 does NOT mean answered if we never got 'answered' status
            // If patient ends call during ringing, duration > 0 is just ringing time, not conversation time
            // Only mark as answered if we previously had 'answered' status
            const wasPreviouslyAnswered = existingLog && existingLog.dialCallStatus === 'answered';
            
            if (wasPreviouslyAnswered) {
              // Was previously answered, then completed = legitimate answered call
              // CRITICAL: For answered calls, duration should NEVER be 0
              updateData.dialCallStatus = 'answered';
              if (dialDuration > 0) {
                updateData.duration = dialDuration;
              } else if (existingLog && existingLog.duration > 0) {
                updateData.duration = existingLog.duration;
              } else {
                updateData.duration = 1; // Minimum 1 second for answered call
                console.log(`   ⚠️ Duration is 0 for answered call, setting minimum 1s`);
              }
              if (!existingLog.answerTime) {
                updateData.answerTime = new Date();
              }
              console.log(`✅ FALLBACK: Call COMPLETED and ANSWERED (was previously answered, duration: ${updateData.duration}s)`);
            } else if (dialDuration > 0) {
              // Duration > 0 but never answered = ended during ringing (MISSED)
              updateData.dialCallStatus = 'no-answer';
              updateData.duration = 0; // Don't count ringing time
              console.log(`❌ FALLBACK: Call COMPLETED with duration ${dialDuration}s but NEVER answered (ended during ringing) - MISSED`);
            } else {
              // Dial completed but duration = 0 = forward number didn't answer (missed)
              updateData.dialCallStatus = 'no-answer';
              updateData.duration = 0;
              console.log(`❌ FALLBACK: Call COMPLETED but NOT answered (duration: 0) - Forward number didn't answer`);
            }
          } else if (DialCallStatus === 'no-answer' || DialCallStatus === 'busy' || 
                     DialCallStatus === 'failed' || DialCallStatus === 'canceled') {
            // Forward number didn't answer, was busy, failed, or was canceled = MISSED
            updateData.dialCallStatus = DialCallStatus;
            updateData.duration = 0;
            console.log(`❌ FALLBACK: Call NOT answered (${DialCallStatus}) - MISSED`);
          }
        }
        // Option 2: Use CallStatus and CallDuration as fallback
        // This handles cases where patient cancels BEFORE Dial starts (no DialCallStatus)
        // CRITICAL: If there's no DialCallStatus, it means Dial never happened or was canceled before it started
        // This means the forward number NEVER answered = MISSED (never mark as answered)
        else if (CallStatus === 'completed' || CallStatus === 'failed' || CallStatus === 'busy' || CallStatus === 'no-answer' || CallStatus === 'canceled') {
          // No DialCallStatus means Dial never started or was canceled before forward number answered
          // Even if duration > 0, this is just menu/disclosure time, NOT conversation time
          // The forward number NEVER answered = MISSED
          updateData.dialCallStatus = CallStatus === 'completed' ? 'no-answer' : CallStatus;
          updateData.duration = 0; // Don't count menu/disclosure time as call duration
          console.log(`❌ FALLBACK: Call ${CallStatus} but NO DialCallStatus (ended before Dial or Dial never started) - MISSED`);
        }
        
        // CRITICAL: For answered calls, duration should NEVER be 0
        // Set duration from status callback if not already set
        if (updateData.duration === undefined) {
          if (callInfo.duration > 0) {
            updateData.duration = callInfo.duration;
          } else if (updateData.dialCallStatus === 'answered') {
            // Call is answered but duration is 0 - set minimum 1 second
            updateData.duration = 1;
            console.log(`   ⚠️ Duration is 0 for answered call, setting minimum 1s`);
          } else {
            updateData.duration = callInfo.duration;
          }
        }
      } else {
        // dialCallStatus already exists - don't override it (dial-status webhook is authoritative)
        console.log(`✅ dialCallStatus already exists (${existingLog.dialCallStatus}), preserving it`);
        // CRITICAL: For answered calls, duration should NEVER be 0
        // Only update duration if it's not set or is 0
        if (!existingLog.duration || existingLog.duration === 0) {
          if (callInfo.duration > 0) {
            updateData.duration = callInfo.duration;
            console.log(`   Updating duration from status callback: ${callInfo.duration}s`);
          } else if (existingLog.dialCallStatus === 'answered') {
            // Call is answered but duration is 0 - set minimum 1 second
            updateData.duration = 1;
            console.log(`   ⚠️ Duration is 0 for answered call, setting minimum 1s`);
          }
        }
      }
      
      // Preserve menu choice if it exists
      if (existingLog && existingLog.menuChoice) {
        updateData.menuChoice = existingLog.menuChoice;
      }
      
      // Add caller information (geographic location)
      if (FromCity) updateData.callerCity = FromCity;
      if (FromState) updateData.callerState = FromState;
      if (FromZip) updateData.callerZip = FromZip;
      if (FromCountry) updateData.callerCountry = FromCountry;
      if (CallerName) updateData.callerName = CallerName;
      
      // Add call quality metrics (if available)
      if (Jitter !== undefined || PacketLoss !== undefined || Latency !== undefined) {
        updateData.qualityMetrics = {};
        if (Jitter !== undefined) updateData.qualityMetrics.jitter = parseFloat(Jitter);
        if (PacketLoss !== undefined) updateData.qualityMetrics.packetLoss = parseFloat(PacketLoss);
        if (Latency !== undefined) updateData.qualityMetrics.latency = parseFloat(Latency);
      }
      
      // Add call pricing
      if (Price !== undefined) {
        updateData.price = parseFloat(Price);
        updateData.priceUnit = PriceUnit || 'USD';
      }
      
      // Only update startedAt if it's the first status callback (ringing/initiated)
      if (CallStatus === 'ringing' || CallStatus === 'initiated') {
        updateData.startedAt = callInfo.timestamp;
        // Calculate ringing duration if we have answer time
        if (CallStatus === 'in-progress' && existingLog && existingLog.startedAt) {
          const ringingTime = Math.floor((new Date() - new Date(existingLog.startedAt)) / 1000);
          updateData.ringingDuration = ringingTime;
          if (!updateData.answerTime) {
            updateData.answerTime = new Date();
          }
        }
      }
      
      // Set endedAt if call is finished
      if (CallStatus === 'completed' || CallStatus === 'failed' || CallStatus === 'busy' || CallStatus === 'no-answer' || CallStatus === 'canceled') {
        updateData.endedAt = new Date();
      }
      
      // Log what we're about to update
      if (updateData.dialCallStatus) {
        console.log(`📝 Setting dialCallStatus: ${updateData.dialCallStatus}, duration: ${updateData.duration || 0}s`);
      }
      
      await CallLog.findOneAndUpdate(
        { callSid: CallSid },
        updateData,
        { upsert: true, setDefaultsOnInsert: true, new: true }
      );
      
      console.log(`✅ Call log saved/updated for CallSid: ${CallSid}`);
    } catch (dbError) {
      console.error('❌ Error saving call log to database:', dbError);
      // Don't fail the webhook, just log the error
    }
    
    // Twilio expects a 200 response
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error handling call status callback:', error);
    // Still return 200 to prevent Twilio from retrying
    res.status(200).send('OK');
  }
});

// GET /api/twilio/voice/dial-status - Allow Twilio to validate the webhook URL
router.get('/voice/dial-status', (req, res) => {
  res.status(200).send('OK');
});

// GET /api/twilio/voice/voicemail - Handle voicemail recording (when dial times out or no answer)
router.get('/voice/voicemail', async (req, res) => {
  // CRITICAL: When clinic/receptionist ends the call, Twilio calls this URL. We must return
  // only <Hangup/> with 200 so the customer hears NOTHING. Do this first, before any async work.
  const rawStatus = (req.query.DialCallStatus || '').trim();
  const status = rawStatus.toLowerCase();
  const callWasConnected = ['completed', 'answered', 'connected'].includes(status);
  if (callWasConnected) {
    console.log(`✅ Dial ended (DialCallStatus: ${rawStatus}) - returning silent Hangup, no message to caller`);
    res.type('text/xml');
    res.status(200);
    return res.send(SILENT_HANGUP_TWIML);
  }

  try {
    const { CallSid, DialCallStatus, DialCallDuration } = req.query;
    console.log(`📞 Voicemail triggered for CallSid: ${CallSid}, DialCallStatus: ${DialCallStatus}, DialCallDuration: ${DialCallDuration}`);

    // Call was NOT answered - proceed with voicemail prompt
    // IMPORTANT: Mark this as a missed call (no-answer) immediately
    // BUT: Only if the call doesn't have a recording or summary (recording/summary = answered call)
    // This ensures that even if dial-status webhook reports 'completed' with duration > 0,
    // we know it went to voicemail, so it's a missed call (unless recording/summary exists)
    if (CallSid) {
      try {
        const existingLog = await CallLog.findOne({ callSid: CallSid });
        const hasRecording = existingLog && existingLog.recordingSid;
        const hasSummary = existingLog && existingLog.summaryText && existingLog.summaryReady;
        
        // Only mark as missed if there's no recording and no summary (recording/summary = answered call)
        if (!hasRecording && !hasSummary) {
          await CallLog.findOneAndUpdate(
            { callSid: CallSid },
            {
              dialCallStatus: 'no-answer' // Voicemail = missed call (not answered)
              // Note: voicemailUrl will be set later by voicemail-status webhook
              // The presence of voicemailUrl indicates voicemail was triggered
            },
            { upsert: true, setDefaultsOnInsert: true }
          );
          console.log(`✅ Marked call as missed (no-answer) - voicemail triggered for CallSid: ${CallSid}`);
        } else {
          const reason = hasRecording ? 'recording' : 'summary';
          console.log(`✅ Call has ${reason} - NOT marking as missed (call was answered)`);
        }
      } catch (err) {
        console.error('Error updating call log with voicemail trigger:', err);
      }
    }
    
    console.log(`📞 Call was NOT answered (DialCallStatus: ${DialCallStatus}) - prompting for voicemail`);
    
    // Get clinic's voice setting - look up clinic from CallSid
    let requestedVoice = TTS_VOICE; // Default to hard-coded voice
    if (CallSid) {
      try {
        const callLog = await CallLog.findOne({ callSid: CallSid });
        if (callLog && callLog.customerId) {
          const clinic = await User.findById(callLog.customerId);
          if (clinic && clinic.twilioVoice) {
            requestedVoice = clinic.twilioVoice;
          }
        }
      } catch (err) {
        console.warn('Could not fetch clinic voice setting, using default:', err.message);
      }
    }
    
    const voice = validateAndGetVoice(requestedVoice);
    console.log(`[VOICE] Using Twilio TTS voice: ${voice} | Voicemail handler`);
    
    // Helper function to generate Say verb with proper voice attributes
    const generateSayVerb = (text, voiceSetting = voice) => {
      // Twilio requires language attribute for all voices (per official docs)
      // FORCE the voice to be our constant - never trust the parameter if it's wrong
      const finalVoice = TTS_VOICE;
      console.log(`[VOICE DEBUG] generateSayVerb called with: "${voiceSetting}" → using: "${finalVoice}"`);
      return `<Say voice="${finalVoice}" language="en-US">${text}</Say>`;
    };
    
    // Get base URL for voicemail callbacks
    let voicemailBaseUrl = process.env.BACKEND_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3000';
    voicemailBaseUrl = voicemailBaseUrl.replace(/\/$/, '');
    if (!voicemailBaseUrl.startsWith('http://localhost') && !voicemailBaseUrl.startsWith('https://')) {
      voicemailBaseUrl = `https://${voicemailBaseUrl}`;
    }
    
    // TwiML to record voicemail
    const twiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${generateSayVerb('Please leave a message after the tone. Press the pound key when you\'re finished.')}
  <Record 
    maxLength="300" 
    finishOnKey="#" 
    action="${voicemailBaseUrl}/api/twilio/voice/voicemail-complete?CallSid=${CallSid}" 
    recordingStatusCallback="${voicemailBaseUrl}/api/twilio/voice/voicemail-status" 
    recordingStatusCallbackMethod="POST"
    transcribe="false"
  />
  ${generateSayVerb('Thank you for your message. Goodbye.')}
  <Hangup/>
</Response>`;
    
    res.type('text/xml');
    res.send(twiML);
  } catch (error) {
    console.error('❌ Error handling voicemail request:', error);
    // Never return 5xx or any Say—return 200 + silent Hangup so caller hears nothing
    res.type('text/xml');
    res.status(200);
    res.send(SILENT_HANGUP_TWIML);
  }
});

// POST /api/twilio/voice/voicemail-status - Handle voicemail recording status
router.post('/voice/voicemail-status', async (req, res) => {
  try {
    const { CallSid, RecordingSid, RecordingUrl, RecordingStatus, RecordingDuration } = req.body;
    
    console.log(`📹 Voicemail recording status: CallSid=${CallSid}, Status=${RecordingStatus}, Duration=${RecordingDuration}`);
    
    if (RecordingStatus === 'completed' && RecordingSid && CallSid) {
      // Get existing call log to check status
      const existingLog = await CallLog.findOne({ callSid: CallSid });
      
      // CRITICAL: Check if call has a recording - if so, it was DEFINITELY answered
      // We use record="record-from-answer" in TwiML, which means recordings ONLY happen when the call is answered
      // A recording = answered call, regardless of what other webhooks might say
      const hasRecording = existingLog && existingLog.recordingSid;
      
      // CRITICAL: Check if call has a summary - if so, it was DEFINITELY answered
      // Summaries are only created from recordings of answered calls with conversations
      // If summaryText exists, the call was answered, so don't mark as missed
      const hasSummary = existingLog && existingLog.summaryText && existingLog.summaryReady;
      
      // CRITICAL: If voicemail was recorded, the call was NOT answered by a person
      // BUT: If a recording or summary exists, it means the call was answered
      // Voicemail = missed call ONLY if there's no recording and no summary
      const updateData = {
        voicemailUrl: RecordingUrl || null,
        voicemailDuration: RecordingDuration ? parseInt(RecordingDuration) : null,
        recordingSid: RecordingSid, // Store for voicemail playback
      };
      
      // Only mark as missed if there's no recording and no summary (recording/summary = answered call)
      if (!hasRecording && !hasSummary) {
        updateData.dialCallStatus = 'no-answer'; // Voicemail = missed call (not answered)
        updateData.duration = 0; // Voicemail duration doesn't count as call duration
      } else {
        // Call has recording or summary = it was answered, so preserve answered status
        const reason = hasRecording ? 'recording' : 'summary';
        console.log(`✅ Call has ${reason} - preserving answered status despite voicemail recording`);
        // Don't override dialCallStatus if it's already 'answered'
        if (existingLog && existingLog.dialCallStatus === 'answered') {
          // Keep it as answered
        } else {
          // If somehow not marked as answered yet, mark it now
          updateData.dialCallStatus = 'answered';
        }
      }
      
      // Only update if call wasn't already marked as answered (unless we're preserving it)
      if (!existingLog || existingLog.dialCallStatus !== 'answered' || hasRecording || hasSummary) {
        await CallLog.findOneAndUpdate(
          { callSid: CallSid },
          updateData,
          { upsert: true, setDefaultsOnInsert: true, new: true }
        ).catch(err => console.error('Error updating call log with voicemail:', err));
        
        if (hasRecording || hasSummary) {
          const reason = hasRecording ? 'recording' : 'summary';
          console.log(`✅ Voicemail saved for CallSid: ${CallSid}, Duration: ${RecordingDuration}s`);
          console.log(`   ✅ Call has ${reason} - marked as ANSWERED (not missed)`);
        } else {
          console.log(`✅ Voicemail saved for CallSid: ${CallSid}, Duration: ${RecordingDuration}s`);
          console.log(`   ✅ Marked as missed call (no-answer) - voicemail recorded`);
        }
      } else {
        // Call was actually answered - this shouldn't happen, but log it
        console.log(`⚠️ Call was answered - ignoring voicemail recording (this should not happen)`);
        console.log(`   Current dialCallStatus: ${existingLog.dialCallStatus}`);
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error handling voicemail status:', error);
    res.status(200).send('OK');
  }
});

// POST /api/twilio/voice/dial-status - Handle Dial call status updates (tracks if clinic answered)
// This is the ONLY place where dialCallStatus is set
router.post('/voice/dial-status', async (req, res) => {
  try {
    // Log ALL request body data for debugging
    console.log(`📞 Dial status webhook received - FULL REQUEST BODY:`);
    console.log(JSON.stringify(req.body, null, 2));
    
    const {
      CallSid,
      DialCallStatus,
      DialCallDuration,
      DialCallSid,
      From,
      To,
      CallStatus,
      ParentCallSid
    } = req.body;
    
    console.log(`📞 Dial status webhook parsed:`);
    console.log(`   CallSid: ${CallSid}`);
    console.log(`   ParentCallSid: ${ParentCallSid || 'not provided'}`);
    console.log(`   DialCallStatus: ${DialCallStatus}`);
    console.log(`   DialCallDuration: ${DialCallDuration}`);
    console.log(`   DialCallSid: ${DialCallSid || 'not provided'}`);
    console.log(`   From: ${From || 'not provided'}`);
    console.log(`   To: ${To || 'not provided'}`);
    console.log(`   CallStatus: ${CallStatus || 'not provided'}`);
    
    // Use ParentCallSid if available (this is the original call SID when Dial sends status)
    const callSidToUse = ParentCallSid || CallSid;
    
    if (!callSidToUse || !DialCallStatus) {
      console.log(`⚠️ Missing CallSid/ParentCallSid or DialCallStatus`);
      return res.status(200).send('OK');
    }
    
    // Get existing call log
    const existingLog = await CallLog.findOne({ callSid: callSidToUse });
    
    if (!existingLog) {
      console.log(`⚠️ Call log not found for CallSid: ${callSidToUse}`);
      return res.status(200).send('OK');
    }
    
    console.log(`✅ Found existing call log - current dialCallStatus: ${existingLog.dialCallStatus || 'null'}, duration: ${existingLog.duration || 0}s`);
    
    const updateData = {};
    
    // AUTHORITATIVE LOGIC: This webhook is the PRIMARY source for dialCallStatus
    // It overrides any fallback logic from status-callback
    
    // CRITICAL: Check if call has a recording - if so, it was DEFINITELY answered
    // We use record="record-from-answer" in TwiML, which means recordings ONLY happen when the call is answered
    // A recording = answered call, regardless of what other webhooks might say
    const hasRecording = existingLog && existingLog.recordingSid;
    
    // CRITICAL: Check if call has a summary - if so, it was DEFINITELY answered
    // Summaries are only created from recordings of answered calls with conversations
    // If summaryText exists, the call was answered, regardless of voicemail status
    const hasSummary = existingLog && existingLog.summaryText && existingLog.summaryReady;
    
    // CRITICAL: Check if voicemail was triggered - but ONLY if there's no recording and no summary
    // If a call has a recording or summary, it means it was answered
    // Voicemail only happens when Dial times out (no answer), so if voicemail exists AND no recording/summary, it's missed
    // Check for voicemailUrl OR if dialCallStatus was already set to 'no-answer' by voicemail handler
    const hasVoicemail = existingLog && !hasRecording && !hasSummary && (
      existingLog.voicemailUrl || 
      (existingLog.dialCallStatus === 'no-answer' && existingLog.voicemailDuration !== undefined)
    );
    
    if (hasRecording || hasSummary) {
      // Call has a recording or summary = it was DEFINITELY answered
      // Recording exists = answered (record-from-answer only records answered calls)
      // Summary exists = answered (summaries only exist for answered calls with conversations)
      // Override any voicemail or missed status - recording/summary = answered call
      updateData.dialCallStatus = 'answered';
      // CRITICAL: For answered calls, duration should NEVER be 0
      // Preserve duration if it exists and is > 0, otherwise use DialCallDuration
      if (!updateData.duration) {
        if (existingLog && existingLog.duration > 0) {
          updateData.duration = existingLog.duration;
        } else if (DialCallDuration) {
          const dialDuration = parseInt(DialCallDuration) || 0;
          // If DialCallDuration is 0, set minimum 1 second for answered call
          updateData.duration = dialDuration > 0 ? dialDuration : 1;
          if (dialDuration === 0) {
            console.log(`   ⚠️ DialCallDuration is 0 for answered call, setting minimum 1s`);
          }
        } else {
          // No duration available - set minimum 1 second for answered call
          updateData.duration = 1;
          console.log(`   ⚠️ No duration available for answered call, setting minimum 1s`);
        }
      }
      if (!updateData.answerTime && existingLog && existingLog.answerTime) {
        updateData.answerTime = existingLog.answerTime;
      } else if (!updateData.answerTime) {
        updateData.answerTime = new Date();
      }
      const reason = hasRecording ? 'recording exists' : 'summary exists';
      console.log(`✅ ${reason.charAt(0).toUpperCase() + reason.slice(1)} - marking as ANSWERED (call was answered, duration: ${updateData.duration || existingLog?.duration || 0}s)`);
    } else if (hasVoicemail) {
      // Voicemail was triggered = call was NOT answered by a person
      // Override any 'completed' or 'answered' status - voicemail = missed call
      updateData.dialCallStatus = 'no-answer';
      updateData.duration = 0; // Voicemail duration doesn't count as call duration
      updateData.endedAt = new Date();
      console.log(`📞 Voicemail detected - marking as MISSED (no-answer) regardless of DialCallStatus: ${DialCallStatus}`);
    } else if (DialCallStatus === 'answered') {
      // Call was answered - this is definitive (and no voicemail)
      updateData.dialCallStatus = 'answered';
      updateData.answerTime = new Date();
      // CRITICAL: For answered calls, duration should NEVER be 0
      if (DialCallDuration) {
        const dialDuration = parseInt(DialCallDuration) || 0;
        // If DialCallDuration is 0, preserve existing duration or set minimum 1 second
        if (dialDuration > 0) {
          updateData.duration = dialDuration;
        } else if (existingLog && existingLog.duration > 0) {
          updateData.duration = existingLog.duration;
        } else {
          updateData.duration = 1; // Minimum 1 second for answered call
          console.log(`   ⚠️ DialCallDuration is 0 for answered call, setting minimum 1s`);
        }
      } else if (existingLog && existingLog.duration > 0) {
        updateData.duration = existingLog.duration;
      } else {
        updateData.duration = 1; // Minimum 1 second for answered call
        console.log(`   ⚠️ No duration available for answered call, setting minimum 1s`);
      }
      console.log(`✅ Call ANSWERED (authoritative from dial-status webhook, duration: ${updateData.duration}s)`);
    } else if (DialCallStatus === 'completed') {
      // Call completed - determine if it was answered based on duration AND previous status
      const duration = DialCallDuration ? parseInt(DialCallDuration) : 0;
      
      // CRITICAL: Check if we previously received 'answered' status
      // If DialCallStatus was 'answered' before, then 'completed' means it was answered and then ended
      // If we never got 'answered', then 'completed' with any duration means it was ended during ringing (MISSED)
      const wasPreviouslyAnswered = existingLog && existingLog.dialCallStatus === 'answered';
      
      if (wasPreviouslyAnswered) {
        // Call was previously answered, then completed (ended after being answered)
        // This is a legitimate answered call
        // CRITICAL: For answered calls, duration should NEVER be 0
        updateData.dialCallStatus = 'answered';
        if (duration > 0) {
          updateData.duration = duration;
        } else if (existingLog && existingLog.duration > 0) {
          updateData.duration = existingLog.duration;
        } else {
          updateData.duration = 1; // Minimum 1 second for answered call
          console.log(`   ⚠️ Duration is 0 for answered call, setting minimum 1s`);
        }
        if (!existingLog.answerTime) {
          updateData.answerTime = new Date();
        }
        updateData.endedAt = new Date();
        console.log(`✅ Call COMPLETED (was previously answered, duration: ${updateData.duration}s) - ANSWERED`);
      } else if (duration > 0) {
        // Duration > 0 BUT we never got 'answered' status
        // This means the call was ended during ringing (patient hung up while forward number was ringing)
        // The duration is just the ringing time, NOT conversation time = MISSED
        updateData.dialCallStatus = 'no-answer';
        updateData.duration = 0; // Don't count ringing time as call duration
        updateData.endedAt = new Date();
        console.log(`❌ Call COMPLETED with duration ${duration}s but NEVER answered (ended during ringing) - MISSED`);
      } else {
        // Duration is 0 = not answered
        updateData.dialCallStatus = 'no-answer';
        updateData.duration = 0;
        updateData.endedAt = new Date();
        console.log(`❌ Call COMPLETED but NOT answered (authoritative, duration: 0) - MISSED`);
      }
    } else if (DialCallStatus === 'no-answer' || DialCallStatus === 'busy' || 
               DialCallStatus === 'failed' || DialCallStatus === 'canceled') {
      // Call was not answered - these statuses are definitive
      // 'no-answer' = Forward number didn't answer (missed)
      // 'busy' = Forward number was busy (missed)
      // 'failed' = Forward number call failed (missed)
      // 'canceled' = Patient canceled after Dial started but before forward number answered (missed)
      updateData.dialCallStatus = DialCallStatus;
      updateData.duration = 0;
      updateData.endedAt = new Date();
      console.log(`❌ Call NOT answered: ${DialCallStatus} (authoritative) - MISSED`);
    } else {
      // Intermediate status (initiated, ringing) - update status but don't mark as answered/missed yet
      updateData.dialCallStatus = DialCallStatus;
      console.log(`⏳ Intermediate status: ${DialCallStatus}`);
    }
    
    // Preserve menu choice if it exists (important for new patient appointment tracking)
    if (existingLog && existingLog.menuChoice) {
      updateData.menuChoice = existingLog.menuChoice;
    }
    
    // Update the call log (this overrides any fallback logic from status-callback)
    const updatedLog = await CallLog.findOneAndUpdate(
      { callSid: callSidToUse },
      updateData,
      { new: true }
    );
    
    console.log(`✅ Updated call log - dialCallStatus: ${updateData.dialCallStatus || 'unchanged'}, duration: ${updateData.duration !== undefined ? updateData.duration : existingLog.duration || 0}s`);
    console.log(`📊 Final call log state: dialCallStatus=${updatedLog.dialCallStatus}, duration=${updatedLog.duration}s`);
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error handling dial status callback:', error);
    console.error('Error stack:', error.stack);
    res.status(200).send('OK');
  }
});

// ============================================
// Customer Endpoints - Call Logs
// ============================================

// OPTIONS handler for CORS preflight (recording endpoint) - MUST be before GET route
router.options('/recording/:recordingSid', (req, res) => {
  // Hardcode production URL for audio endpoints to fix CORS issues
  let frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    if (req.headers.origin && req.headers.origin.includes('clinimediaportal.ca')) {
      frontendUrl = req.headers.origin;
    } else if (req.headers.origin && req.headers.origin.includes('localhost')) {
      frontendUrl = req.headers.origin;
    } else {
      frontendUrl = 'https://www.clinimediaportal.ca';
    }
  }
  res.setHeader('Access-Control-Allow-Origin', frontendUrl);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(204).send();
});

// OPTIONS handler for CORS preflight (voicemail endpoint) - MUST be before GET route
router.options('/voicemail/:callSid', (req, res) => {
  // Hardcode production URL for audio endpoints to fix CORS issues
  let frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    if (req.headers.origin && req.headers.origin.includes('clinimediaportal.ca')) {
      frontendUrl = req.headers.origin;
    } else if (req.headers.origin && req.headers.origin.includes('localhost')) {
      frontendUrl = req.headers.origin;
    } else {
      frontendUrl = 'https://www.clinimediaportal.ca';
    }
  }
  res.setHeader('Access-Control-Allow-Origin', frontendUrl);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(204).send();
});

// GET /api/twilio/recording/:recordingSid - Proxy Twilio recording with authentication (customer only)
router.get('/recording/:recordingSid', authenticateToken, async (req, res) => {
  try {
    const { recordingSid } = req.params;
    const customerId = req.user.id;
    
    // Verify user is a customer
    const user = await User.findById(customerId);
    if (!user || user.role !== 'customer') {
      return res.status(403).json({ error: 'Access denied. Customers only.' });
    }
    
    // Verify this recording belongs to this customer
    const callLog = await CallLog.findOne({
      recordingSid: recordingSid,
      customerId: customerId
    });
    
    if (!callLog) {
      return res.status(404).json({ error: 'Recording not found or access denied.' });
    }
    
    // Get Twilio credentials
    const { accountSid, username, password } = getTwilioCredentials();
    
    // Set CORS headers explicitly for production (BEFORE fetching/streaming)
    // Hardcode production URL for audio endpoints to fix CORS issues
    let frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      if (req.headers.origin && req.headers.origin.includes('clinimediaportal.ca')) {
        frontendUrl = req.headers.origin;
      } else if (req.headers.origin && req.headers.origin.includes('localhost')) {
        frontendUrl = req.headers.origin;
      } else {
        frontendUrl = 'https://www.clinimediaportal.ca';
      }
    }
    res.setHeader('Access-Control-Allow-Origin', frontendUrl);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    
    // Fetch recording media from Twilio API
    // Twilio recording media URL format: https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Recordings/{RecordingSid}.mp3
    try {
      const recordingMediaUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}.mp3`;
      
      // Fetch the actual audio file from Twilio with authentication
      // Try with current credentials first, fallback to Auth Token if API keys fail
      let audioResponse;
      try {
        audioResponse = await axios.get(recordingMediaUrl, {
          auth: {
            username: username,
            password: password
          },
          responseType: 'stream'
        });
      } catch (authError) {
        // If API keys fail (401/403), try with Auth Token as fallback
        const isAuthError = authError.response?.status === 401 || authError.response?.status === 403;
        const hasAuthToken = !!process.env.TWILIO_AUTH_TOKEN;
        const wasUsingApiKey = username !== accountSid;
        
        if (isAuthError && wasUsingApiKey && hasAuthToken) {
          console.warn('⚠️ API Key failed for recording fetch, falling back to Auth Token...');
          audioResponse = await axios.get(recordingMediaUrl, {
            auth: {
              username: accountSid,
              password: process.env.TWILIO_AUTH_TOKEN
            },
            responseType: 'stream'
          });
        } else {
          throw authError;
        }
      }
      
      // Set appropriate headers for audio streaming (BEFORE piping)
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `inline; filename="recording-${recordingSid}.mp3"`);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      // Handle errors during streaming
      audioResponse.data.on('error', (error) => {
        console.error('Error streaming audio:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream audio', details: error.message });
        }
      });
      
      // Handle response errors
      res.on('error', (error) => {
        console.error('Error writing response:', error);
        // Clean up the stream if response errors
        if (audioResponse.data && typeof audioResponse.data.destroy === 'function') {
          audioResponse.data.destroy();
        }
      });
      
      // Stream the audio to the client
      audioResponse.data.pipe(res);
    } catch (error) {
      console.error('Error fetching recording from Twilio:', error);
      if (error.response) {
        console.error('Twilio API error:', error.response.status, error.response.data);
      }
      // Set CORS headers even for errors
      let frontendUrl = process.env.FRONTEND_URL;
      if (!frontendUrl) {
        if (req.headers.origin && req.headers.origin.includes('clinimediaportal.ca')) {
          frontendUrl = req.headers.origin;
        } else if (req.headers.origin && req.headers.origin.includes('localhost')) {
          frontendUrl = req.headers.origin;
        } else {
          frontendUrl = 'https://www.clinimediaportal.ca';
        }
      }
      res.setHeader('Access-Control-Allow-Origin', frontendUrl);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.status(500).json({ error: 'Failed to fetch recording', details: error.message });
    }
  } catch (error) {
    console.error('Error in recording proxy:', error);
    // Set CORS headers even for errors
    let frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      if (req.headers.origin && req.headers.origin.includes('clinimediaportal.ca')) {
        frontendUrl = req.headers.origin;
      } else if (req.headers.origin && req.headers.origin.includes('localhost')) {
        frontendUrl = req.headers.origin;
      } else {
        frontendUrl = 'https://www.clinimediaportal.ca';
      }
    }
    res.setHeader('Access-Control-Allow-Origin', frontendUrl);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.status(500).json({ error: 'Failed to proxy recording', details: error.message });
  }
});

// GET /api/twilio/voicemail/:callSid - Proxy Twilio voicemail recording with authentication (customer only)
router.get('/voicemail/:callSid', authenticateToken, async (req, res) => {
  try {
    const { callSid } = req.params;
    const customerId = req.user.id;
    
    // Verify user is a customer
    const user = await User.findById(customerId);
    if (!user || user.role !== 'customer') {
      return res.status(403).json({ error: 'Access denied. Customers only.' });
    }
    
    // Verify this call belongs to this customer and has a voicemail
    const callLog = await CallLog.findOne({
      callSid: callSid,
      customerId: customerId,
      voicemailUrl: { $exists: true, $ne: null }
    });
    
    if (!callLog || !callLog.recordingSid) {
      return res.status(404).json({ error: 'Voicemail not found or access denied.' });
    }
    
    // Get Twilio credentials
    const { accountSid, username, password } = getTwilioCredentials();
    
    // Set CORS headers explicitly for production (BEFORE fetching/streaming)
    // Hardcode production URL for audio endpoints to fix CORS issues
    let frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      if (req.headers.origin && req.headers.origin.includes('clinimediaportal.ca')) {
        frontendUrl = req.headers.origin;
      } else if (req.headers.origin && req.headers.origin.includes('localhost')) {
        frontendUrl = req.headers.origin;
      } else {
        frontendUrl = 'https://www.clinimediaportal.ca';
      }
    }
    res.setHeader('Access-Control-Allow-Origin', frontendUrl);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    
    // Fetch voicemail recording from Twilio API (using recordingSid which stores the voicemail SID)
    try {
      const recordingMediaUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${callLog.recordingSid}.mp3`;
      
      // Fetch the actual audio file from Twilio with authentication
      // Try with current credentials first, fallback to Auth Token if API keys fail
      let audioResponse;
      try {
        audioResponse = await axios.get(recordingMediaUrl, {
          auth: {
            username: username,
            password: password
          },
          responseType: 'stream'
        });
      } catch (authError) {
        // If API keys fail (401/403), try with Auth Token as fallback
        const isAuthError = authError.response?.status === 401 || authError.response?.status === 403;
        const hasAuthToken = !!process.env.TWILIO_AUTH_TOKEN;
        const wasUsingApiKey = username !== accountSid;
        
        if (isAuthError && wasUsingApiKey && hasAuthToken) {
          console.warn('⚠️ API Key failed for voicemail fetch, falling back to Auth Token...');
          audioResponse = await axios.get(recordingMediaUrl, {
            auth: {
              username: accountSid,
              password: process.env.TWILIO_AUTH_TOKEN
            },
            responseType: 'stream'
          });
        } else {
          throw authError;
        }
      }
      
      // Set appropriate headers for audio streaming (BEFORE piping)
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `inline; filename="voicemail-${callSid}.mp3"`);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      // Handle errors during streaming
      audioResponse.data.on('error', (error) => {
        console.error('Error streaming voicemail:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream voicemail', details: error.message });
        }
      });
      
      // Handle response errors
      res.on('error', (error) => {
        console.error('Error writing response:', error);
        // Clean up the stream if response errors
        if (audioResponse.data && typeof audioResponse.data.destroy === 'function') {
          audioResponse.data.destroy();
        }
      });
      
      // Stream the audio to the client
      audioResponse.data.pipe(res);
    } catch (error) {
      console.error('Error fetching voicemail from Twilio:', error);
      if (error.response) {
        console.error('Twilio API error:', error.response.status, error.response.data);
      }
      // Set CORS headers even for errors
      let frontendUrl = process.env.FRONTEND_URL;
      if (!frontendUrl) {
        if (req.headers.origin && req.headers.origin.includes('clinimediaportal.ca')) {
          frontendUrl = req.headers.origin;
        } else if (req.headers.origin && req.headers.origin.includes('localhost')) {
          frontendUrl = req.headers.origin;
        } else {
          frontendUrl = 'https://www.clinimediaportal.ca';
        }
      }
      res.setHeader('Access-Control-Allow-Origin', frontendUrl);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.status(500).json({ error: 'Failed to fetch voicemail', details: error.message });
    }
  } catch (error) {
    console.error('Error in voicemail proxy:', error);
    // Set CORS headers even for errors
    let frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      if (req.headers.origin && req.headers.origin.includes('clinimediaportal.ca')) {
        frontendUrl = req.headers.origin;
      } else if (req.headers.origin && req.headers.origin.includes('localhost')) {
        frontendUrl = req.headers.origin;
      } else {
        frontendUrl = 'https://www.clinimediaportal.ca';
      }
    }
    res.setHeader('Access-Control-Allow-Origin', frontendUrl);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.status(500).json({ error: 'Failed to proxy voicemail', details: error.message });
  }
});

// GET /api/twilio/call-logs/:callSid/summary - Fetch conversation summary (customer only)
router.get('/call-logs/:callSid/summary', authenticateToken, async (req, res) => {
  try {
    const { callSid } = req.params;
    const customerId = req.user.id;
    
    // Verify user is a customer
    const user = await User.findById(customerId);
    if (!user || user.role !== 'customer') {
      return res.status(403).json({ error: 'Access denied. Customers only.' });
    }
    
    // Verify this call belongs to this customer
    const callLog = await CallLog.findOne({
      callSid: callSid,
      customerId: customerId
    });
    
    if (!callLog) {
      return res.status(404).json({ error: 'Call not found or access denied.' });
    }
    
    // Return summary from DB if available
    if (callLog.summaryText && callLog.summaryReady) {
      // Always re-analyze to ensure accuracy (in case detection logic improved)
      // This ensures that if we improve the detection algorithm, existing summaries get re-analyzed
      const appointmentBooked = await detectAppointmentBooked(callLog.summaryText);
      
      // CRITICAL: If summary exists but dialCallStatus is not 'answered', fix it
      // This handles cases where summary was created but status wasn't updated
      const needsStatusUpdate = callLog.dialCallStatus !== 'answered';
      const needsAppointmentUpdate = callLog.appointmentBooked !== appointmentBooked;
      
      if (needsStatusUpdate || needsAppointmentUpdate) {
        const updateData = {};
        if (needsAppointmentUpdate) {
          updateData.appointmentBooked = appointmentBooked;
        }
        if (needsStatusUpdate) {
          updateData.dialCallStatus = 'answered'; // Summary = answered call
          // CRITICAL: For answered calls, duration should NEVER be 0
          if (callLog.duration === 0) {
            updateData.duration = 1; // Set minimum 1 second
          }
        }
        await CallLog.findOneAndUpdate(
          { callSid: callSid },
          updateData
        );
        if (needsStatusUpdate) {
          console.log(`✅ Fixed: Summary exists but dialCallStatus was not 'answered' - now marked as ANSWERED`);
        }
        if (needsAppointmentUpdate) {
          console.log(`✅ Re-analyzed summary - appointment status changed: ${callLog.appointmentBooked} → ${appointmentBooked}`);
        }
      }
      
      return res.json({
        summaryText: callLog.summaryText,
        summaryReady: true,
        transcriptSid: callLog.transcriptSid,
        appointmentBooked: appointmentBooked
      });
    }
    
    // Try to fetch summary if transcriptSid exists
    if (callLog.transcriptSid) {
      try {
        const { summary } = await fetchConversationSummary(callLog.transcriptSid);
        
        if (summary) {
          // Detect if an appointment was booked from the summary
          const appointmentBooked = await detectAppointmentBooked(summary);
          
          // CRITICAL: If a summary exists, the call was DEFINITELY answered
          // Summaries are only created from recordings of answered calls with conversations
          // Mark the call as answered when summary is created (via polling)
          await CallLog.findOneAndUpdate(
            { callSid: callSid },
            { 
              summaryText: summary, 
              summaryReady: true,
              appointmentBooked: appointmentBooked,
              dialCallStatus: 'answered', // Summary = answered call
              // CRITICAL: For answered calls, duration should NEVER be 0
              // If duration is 0, set minimum 1 second
              ...(callLog.duration === 0 ? { duration: 1 } : {})
            }
          );
          console.log(`✅ Summary created via polling - call marked as ANSWERED (summary exists = call was answered)`);
          return res.json({
            summaryText: summary,
            summaryReady: true,
            transcriptSid: callLog.transcriptSid,
            appointmentBooked: appointmentBooked
          });
        }
      } catch (fetchError) {
        // If fetch fails but we have summary in DB, return that
        if (callLog.summaryText) {
          return res.json({
            summaryText: callLog.summaryText,
            summaryReady: true,
            transcriptSid: callLog.transcriptSid,
            appointmentBooked: callLog.appointmentBooked
          });
        }
      }
    }
    
    // No summary available
    return res.json({
      summaryText: null,
      summaryReady: false,
      transcriptSid: callLog.transcriptSid || null,
      status: 'not_available',
      message: 'Conversation summary is not available yet.'
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({
      error: 'Failed to fetch conversation summary',
      details: error.message
    });
  }
});

// GET /api/twilio/call-logs - Get call logs (customer or receptionist; receptionist sees parent clinic's data)
router.get('/call-logs', authenticateToken, authorizeRole(['customer', 'receptionist']), resolveEffectiveCustomerId, async (req, res) => {
  try {
    const customerId = req.effectiveCustomerId;
    
    // Get query parameters for filtering
    const { limit = 100, offset = 0, startDate, endDate } = req.query;
    
    // Build query
    const query = { customerId };
    
    // Add date range filter if provided
    if (startDate || endDate) {
      query.startedAt = {};
      if (startDate) {
        // Parse start date string (yyyy-MM-dd) and set to start of day in UTC
        // Date strings in yyyy-MM-dd format are interpreted as UTC by JavaScript
        const start = new Date(startDate + 'T00:00:00.000Z');
        query.startedAt.$gte = start;
      }
      if (endDate) {
        // Parse end date string (yyyy-MM-dd) and set to end of day in UTC
        const end = new Date(endDate + 'T23:59:59.999Z');
        query.startedAt.$lte = end;
      }
    }
    
    // Fetch call logs
    const callLogs = await CallLog.find(query)
      .sort({ startedAt: -1 }) // Most recent first
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .select('-__v'); // Exclude version field
    
    // Get total count for pagination
    const totalCount = await CallLog.countDocuments(query);
    
    // Format response with all available data
    const formattedLogs = callLogs.map(log => ({
      id: log._id,
      callSid: log.callSid,
      from: log.from,
      fromDisplay: getFromDisplay(log.from), // "Unknown number" when caller blocks ID; otherwise actual number
      to: log.to,
      status: log.status,
      duration: log.duration, // in seconds
      menuChoice: log.menuChoice, // '1' = new patient, '2' = existing patient, null = no menu or not selected
      menuChoiceLabel: log.menuChoice === '1' ? 'New Patient' : log.menuChoice === '2' ? 'Existing Patient' : null,
      startedAt: log.startedAt,
      endedAt: log.endedAt,
      direction: log.direction,
      // Recording
      recordingUrl: log.recordingUrl || null,
      recordingSid: log.recordingSid || null,
      // Caller Information
      callerName: log.callerName || null,
      callerCity: log.callerCity || null,
      callerState: log.callerState || null,
      callerZip: log.callerZip || null,
      callerCountry: log.callerCountry || null,
      // Call Quality Metrics
      qualityMetrics: log.qualityMetrics || null,
      // Call Pricing
      price: log.price || null,
      priceUnit: log.priceUnit || 'USD',
      // Call Events
      ringingDuration: log.ringingDuration || null,
      answerTime: log.answerTime || null,
      // Transcription (legacy)
      transcriptUrl: log.transcriptUrl || null,
      transcriptSid: log.transcriptSid || null,
      transcriptText: log.transcriptText || null,
      // Conversational Intelligence Summary
      summaryText: log.summaryText || null,
      summaryReady: log.summaryReady || false,
      appointmentBooked: log.appointmentBooked !== undefined ? log.appointmentBooked : null,
      // Voicemail
      voicemailUrl: log.voicemailUrl || null,
      voicemailDuration: log.voicemailDuration || null,
      // Dial Call Status (whether clinic answered)
      dialCallStatus: log.dialCallStatus || null
    }));
    
    res.json({
      callLogs: formattedLogs,
      totalCount,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching call logs:', error);
    res.status(500).json({ 
      error: 'Failed to fetch call logs',
      details: error.message 
    });
  }
});

// POST /api/twilio/voice/recording-status - Handle recording status updates
router.post('/voice/recording-status', async (req, res) => {
  try {
    const { CallSid, RecordingSid, RecordingUrl, RecordingStatus, RecordingDuration } = req.body;
    
    console.log(`📹 Recording status update:`);
    console.log(`   CallSid: ${CallSid}`);
    console.log(`   RecordingSid: ${RecordingSid}`);
    console.log(`   RecordingStatus: ${RecordingStatus}`);
    console.log(`   RecordingUrl: ${RecordingUrl}`);
    console.log(`   RecordingDuration: ${RecordingDuration}`);
    
    // CRITICAL: Always save RecordingSid if provided, regardless of RecordingStatus
    // This ensures recordings are always available, even if status is 'processing' or webhook fires multiple times
    // We use record="record-from-answer" which only records answered calls, so RecordingSid = answered call
    if (RecordingSid && CallSid) {
      // Get existing call log to check for summary and current status
      const existingLog = await CallLog.findOne({ callSid: CallSid });
      const hasSummary = existingLog && existingLog.summaryText && existingLog.summaryReady;
      
      // CRITICAL: If a recording exists, the call was DEFINITELY answered
      // We use record="record-from-answer" in TwiML, which means recordings ONLY happen when the call is answered
      // A recording = answered call, regardless of what dial-status or other webhooks might say
      
      // Store the RecordingSid - we'll use it to fetch the recording via our proxy endpoint
      // Twilio recording URLs require authentication, so we'll proxy them through our backend
      const updateData = {
        recordingSid: RecordingSid, // ALWAYS save RecordingSid when provided
        recordingUrl: RecordingUrl || null // Store the URL if provided, but we'll use SID for access
      };
      
      // CRITICAL: Recording exists = call was answered (record-from-answer only records answered calls)
      // Mark as answered and set duration from RecordingDuration (only when status is 'completed')
      const recordingDuration = RecordingDuration ? parseInt(RecordingDuration) : 0;
      
      // Always mark as answered if recording exists (unless already marked as answered)
      if (!existingLog || existingLog.dialCallStatus !== 'answered') {
        updateData.dialCallStatus = 'answered';
        console.log(`✅ Recording exists - marking call as ANSWERED (record-from-answer = call was answered)`);
      }
      
      // Set duration from RecordingDuration (this is the actual conversation duration)
      // CRITICAL: For answered calls, duration should NEVER be 0
      // Only update duration when RecordingStatus is 'completed' (recording is finished)
      if (RecordingStatus === 'completed') {
        if (recordingDuration > 0) {
          updateData.duration = recordingDuration;
          console.log(`   Setting duration from recording: ${recordingDuration}s`);
        } else if (existingLog && existingLog.duration > 0) {
          // RecordingDuration is 0 but call was answered - preserve existing duration
          updateData.duration = existingLog.duration;
          console.log(`   RecordingDuration is 0, preserving existing duration: ${existingLog.duration}s`);
        } else {
          // No duration available - set minimum 1 second for answered call
          updateData.duration = 1;
          console.log(`   ⚠️ No duration available, setting minimum 1s for answered call`);
        }
      } else if (existingLog && existingLog.duration > 0) {
        // Preserve existing duration if recording is still processing
        updateData.duration = existingLog.duration;
        console.log(`   Preserving existing duration: ${existingLog.duration}s (RecordingStatus: ${RecordingStatus})`);
      } else if (existingLog && existingLog.duration === 0) {
        // Duration is 0 but call was answered - set minimum 1 second
        updateData.duration = 1;
        console.log(`   ⚠️ Duration was 0 for answered call, setting minimum 1s`);
      }
      
      // Set answerTime if not already set
      if (!existingLog || !existingLog.answerTime) {
        updateData.answerTime = new Date();
      }
      
      await CallLog.findOneAndUpdate(
        { callSid: CallSid },
        updateData,
        { new: true }
      ).catch(err => console.error('Error updating call log with recording:', err));
      
      console.log(`✅ Recording saved for CallSid: ${CallSid}`);
      console.log(`   RecordingSid: ${RecordingSid}`);
      console.log(`   RecordingStatus: ${RecordingStatus}`);
      console.log(`   Duration: ${updateData.duration || existingLog?.duration || 0}s`);
      console.log(`   dialCallStatus: ${updateData.dialCallStatus || existingLog?.dialCallStatus || 'unchanged'}`);
      
      // Only create CI transcript when recording is completed (not during processing)
      if (RecordingStatus === 'completed') {
        // Create CI transcript from recording (for Conversation Summary)
        const enableTranscription = process.env.TWILIO_ENABLE_TRANSCRIPTION === 'true';
        const viServiceSid = process.env.TWILIO_VI_SERVICE_SID;
        
        if (enableTranscription && viServiceSid) {
          try {
            console.log(`📝 Creating CI transcript from recording for Conversation Summary...`);
            const transcriptData = await createTranscriptFromRecording(RecordingSid);
            const transcriptSid = transcriptData.sid;
            
            // Store transcript SID for CI webhook lookup
            await CallLog.findOneAndUpdate(
              { callSid: CallSid },
              {
                transcriptSid: transcriptSid,
                summaryReady: false // Summary will be set when CI webhook fires or polling
              },
              { new: true }
            ).catch(err => console.error('Error updating call log with transcript SID:', err));
            
            console.log(`✅ CI transcript created: ${transcriptSid}`);
            
          } catch (transcriptError) {
            console.error('Error creating CI transcript:', transcriptError);
            if (transcriptError.response) {
              console.error('   API Error:', transcriptError.response.status, transcriptError.response.data);
            }
            // Don't fail the webhook - just log the error
          }
        }
      }
    } else {
      // No RecordingSid provided - log for debugging
      console.log(`⚠️ Recording status update received but no RecordingSid provided (CallSid: ${CallSid}, Status: ${RecordingStatus})`);
    }
    
    // Twilio expects a 200 response
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling recording status:', error);
    res.status(200).send('OK'); // Always return OK to Twilio
  }
});

// Note: Transcription is now handled via real-time TwiML, not post-call API
// Real-time transcription uses <Start><Transcription> in TwiML
// Transcripts are automatically created and can be fetched via the Calls API

// GET /api/twilio/ci-status - Allow Twilio to validate the webhook URL
// Some webhook systems validate URLs with GET requests
router.get('/ci-status', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'CI webhook endpoint is active' });
});

// POST /api/twilio/ci-status - Handle Conversational Intelligence status updates
router.post('/ci-status', async (req, res) => {
  try {
    const transcriptSid = req.body.TranscriptSid || req.body.transcript_sid;
    
    if (transcriptSid) {
      try {
        // Wait a moment for processing to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const { summary } = await fetchConversationSummary(transcriptSid);
        
        if (summary) {
          // Detect if an appointment was booked from the summary
          const appointmentBooked = await detectAppointmentBooked(summary);
          
          // CRITICAL: If a summary exists, the call was DEFINITELY answered
          // Summaries are only created from recordings of answered calls with conversations
          // Mark the call as answered when summary is created
          const existingLog = await CallLog.findOne({ transcriptSid: transcriptSid });
          
          const updateData = {
            summaryText: summary, 
            summaryReady: true,
            appointmentBooked: appointmentBooked,
            updatedAt: new Date(),
            dialCallStatus: 'answered' // Summary = answered call
          };
          
          // CRITICAL: For answered calls (summary exists), duration should NEVER be 0
          // Preserve duration and answerTime if they exist
          if (existingLog) {
            // Preserve duration if it exists and is > 0
            if (existingLog.duration > 0) {
              updateData.duration = existingLog.duration;
            } else {
              // Duration is 0 but call was answered (summary exists) - set minimum 1 second
              updateData.duration = 1;
              console.log(`   ⚠️ Duration was 0 for answered call with summary, setting minimum 1s`);
            }
            // Preserve answerTime if it exists
            if (existingLog.answerTime) {
              updateData.answerTime = existingLog.answerTime;
            } else {
              updateData.answerTime = new Date();
            }
          } else {
            // No existing log - set minimum duration for answered call
            updateData.duration = 1;
            updateData.answerTime = new Date();
            console.log(`   ⚠️ No existing log, setting minimum 1s duration for answered call with summary`);
          }
          
          await CallLog.updateOne(
            { transcriptSid: transcriptSid },
            { $set: updateData }
          );
          console.log(`✅ Conversation summary saved for transcript: ${transcriptSid}`);
          console.log(`   Appointment booked: ${appointmentBooked ? 'Yes' : 'No'}`);
          console.log(`   ✅ Call marked as ANSWERED (summary exists = call was answered)`);
        }
      } catch (summaryError) {
        console.error('Error fetching/saving conversation summary:', summaryError.message);
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling CI status:', error);
    res.status(200).send('OK');
  }
});


// GET /api/twilio/configuration - Get Twilio configuration (customer or receptionist; receptionist sees parent clinic's config)
router.get('/configuration', authenticateToken, authorizeRole(['customer', 'receptionist']), resolveEffectiveCustomerId, async (req, res) => {
  try {
    const customerId = req.effectiveCustomerId;
    const user = await User.findById(customerId);
    if (!user) {
      return res.status(404).json({ error: 'Clinic not found.' });
    }
    
    // Generate default message with clinic name for display
    let displayMessage;
    if (user.twilioMenuMessage) {
      displayMessage = user.twilioMenuMessage;
    } else if (process.env.TWILIO_MENU_MESSAGE) {
      displayMessage = process.env.TWILIO_MENU_MESSAGE;
    } else {
      const clinicName = user.name || 'our office';
      displayMessage = `Thank you for calling ${clinicName}. Press 1 for new patients, press 2 for existing patients.`;
    }
    
    // Return Twilio configuration
      res.json({
        twilioPhoneNumber: user.twilioPhoneNumber || null,
        twilioForwardNumber: user.twilioForwardNumber || user.twilioForwardNumberNew || user.twilioForwardNumberExisting || null,
        twilioForwardNumberNew: user.twilioForwardNumberNew || null,
        twilioForwardNumberExisting: user.twilioForwardNumberExisting || null,
        twilioMenuMessage: displayMessage,
        isConnected: !!(user.twilioPhoneNumber && (user.twilioForwardNumber || user.twilioForwardNumberNew || user.twilioForwardNumberExisting)),
        menuEnabled: process.env.TWILIO_ENABLE_MENU === 'true',
        recordingEnabled: process.env.TWILIO_ENABLE_RECORDING === 'true',
        transcriptionEnabled: process.env.TWILIO_ENABLE_TRANSCRIPTION === 'true'
      });
  } catch (error) {
    console.error('Error fetching Twilio configuration:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Twilio configuration',
      details: error.message 
    });
  }
});

// Rolling 90-minute window for "Appointments Booked" deduplication (stats only)
const NINETY_MIN_MS = 90 * 60 * 1000;

/**
 * Count distinct booking clusters per caller: for each `from`, booked calls within
 * 90 minutes of each other = 1 cluster. If the next booked call is > 90 min later, new cluster.
 * @param {Array<{from: string, startedAt: Date}>} docs - from and startedAt only
 * @returns {number}
 */
function countBookedClusters90Min(docs) {
  if (!docs || docs.length === 0) return 0;
  const byFrom = {};
  for (const d of docs) {
    const k = d.from;
    if (!byFrom[k]) byFrom[k] = [];
    const t = d.startedAt instanceof Date ? d.startedAt.getTime() : new Date(d.startedAt).getTime();
    if (Number.isFinite(t)) byFrom[k].push(t);
  }
  let total = 0;
  for (const times of Object.values(byFrom)) {
    if (times.length === 0) continue;
    times.sort((a, b) => a - b);
    let clusters = 1;
    for (let i = 1; i < times.length; i++) {
      if (times[i] - times[i - 1] > NINETY_MIN_MS) clusters++;
    }
    total += clusters;
  }
  return total;
}

// GET /api/twilio/call-logs/stats - Get call statistics (customer or receptionist; receptionist sees parent clinic's stats)
router.get('/call-logs/stats', authenticateToken, authorizeRole(['customer', 'receptionist']), resolveEffectiveCustomerId, async (req, res) => {
  try {
    const customerId = req.effectiveCustomerId;
    
    // Get date range (respect date filters from frontend)
    const { startDate, endDate } = req.query;
    const query = { customerId };
    
    // Add date range filter if provided
    if (startDate || endDate) {
      query.startedAt = {};
      if (startDate) {
        // Parse start date string (yyyy-MM-dd) and set to start of day in UTC
        const start = new Date(startDate + 'T00:00:00.000Z');
        query.startedAt.$gte = start;
      }
      if (endDate) {
        // Parse end date string (yyyy-MM-dd) and set to end of day in UTC
        const end = new Date(endDate + 'T23:59:59.999Z');
        query.startedAt.$lte = end;
      }
    }
    // If no date filter, show all stats (no default limit)
    
    // Total Calls = All calls to Twilio number (all CallLog entries)
    const totalCalls = await CallLog.countDocuments(query);
    
    // Answered Calls = Calls where dialCallStatus === 'answered'
    // This is set ONLY by the dial-status webhook when DialCallStatus === 'answered'
    const answeredCallsQuery = {
      ...query,
      dialCallStatus: 'answered'
    };
    
    const answeredCalls = await CallLog.countDocuments(answeredCallsQuery);
    console.log(`📊 Answered calls: ${answeredCalls}`);
    
    // Missed Calls = Calls where dialCallStatus exists but is NOT 'answered'
    // This includes: 'no-answer', 'busy', 'failed', 'canceled'
    const missedCalls = await CallLog.countDocuments({
      ...query,
      dialCallStatus: { $exists: true, $ne: null, $ne: 'answered' }
    });
    
    console.log(`📊 Missed calls: ${missedCalls}`);
    
    const newPatientCalls = await CallLog.countDocuments({ ...query, menuChoice: '1' });
    const existingPatientCalls = await CallLog.countDocuments({ ...query, menuChoice: '2' });
    
    // Appointments Booked = rolling 90-minute deduplication per caller (from)
    // Same from with 2+ appointmentBooked === true within 90 min = 1. Next booked call > 90 min later = new.
    const bookedLogs = await CallLog.find({ ...query, appointmentBooked: true })
      .select('from startedAt')
      .sort({ from: 1, startedAt: 1 })
      .lean();
    const appointmentsBooked = countBookedClusters90Min(bookedLogs);
    console.log(`📊 Appointments booked (90-min dedupe): ${appointmentsBooked}`);
    
    // New Patient Appointments Booked = same 90-min deduplication, only menuChoice === '1'
    const newPatientBookedLogs = await CallLog.find({ ...query, menuChoice: '1', appointmentBooked: true })
      .select('from startedAt')
      .sort({ from: 1, startedAt: 1 })
      .lean();
    const newPatientAppointmentsBooked = countBookedClusters90Min(newPatientBookedLogs);
    console.log(`📊 New patient appointments booked (90-min dedupe): ${newPatientAppointmentsBooked}`);
    
    // Calculate total duration (in seconds) for answered calls only
    // Use the same query as answeredCalls to ensure consistency (includes backward compatibility for old calls)
    const durationResult = await CallLog.aggregate([
      { 
        $match: answeredCallsQuery
      },
      { $group: { _id: null, totalDuration: { $sum: '$duration' } } }
    ]);
    const totalDuration = durationResult[0]?.totalDuration || 0;
    
    // Calculate average duration for answered calls
    const avgDuration = answeredCalls > 0 ? Math.round(totalDuration / answeredCalls) : 0;
    
    // Log final stats for debugging
    console.log(`📊 Final stats: Total=${totalCalls}, Answered=${answeredCalls}, Missed=${missedCalls}, Appointments=${appointmentsBooked}, NewPatientAppointments=${newPatientAppointmentsBooked}, Duration=${totalDuration}s, Avg=${avgDuration}s`);
    
    res.json({
      totalCalls,
      completedCalls: answeredCalls, // Return answeredCalls as completedCalls for backward compatibility
      missedCalls: missedCalls, // Missed = Calls forwarded but not answered
      newPatientCalls,
      existingPatientCalls,
      appointmentsBooked, // 90-min rolling dedupe per from; 2+ booked within 90 min = 1
      newPatientAppointmentsBooked, // Same 90-min dedupe, only menuChoice '1'
      totalDuration, // in seconds
      avgDuration, // in seconds
      totalDurationFormatted: formatDuration(totalDuration),
      avgDurationFormatted: formatDuration(avgDuration)
    });
  } catch (error) {
    console.error('Error fetching call stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch call statistics',
      details: error.message 
    });
  }
});

// DELETE /api/twilio/call-logs/:customerId - Delete all call logs for a specific clinic (admin only)
router.delete('/call-logs/:customerId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { customerId } = req.params;
    
    // Verify customer exists
    const customer = await User.findById(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Delete all call logs for this customer
    const deleteResult = await CallLog.deleteMany({ customerId });
    
    console.log(`🗑️ Deleted ${deleteResult.deletedCount} call logs for customer: ${customer.name || customer.email} (${customerId})`);
    
    res.json({
      success: true,
      message: `Successfully deleted ${deleteResult.deletedCount} call log${deleteResult.deletedCount !== 1 ? 's' : ''} for ${customer.name || customer.email}`,
      deletedCount: deleteResult.deletedCount
    });
  } catch (error) {
    console.error('Error deleting call logs:', error);
    res.status(500).json({ 
      error: 'Failed to delete call logs',
      details: error.message 
    });
  }
});

// DELETE /api/twilio/call-logs - Delete all call logs for authenticated customer (customer only)
router.delete('/call-logs', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.id;
    
    // Verify user is a customer
    const user = await User.findById(customerId);
    if (!user || user.role !== 'customer') {
      return res.status(403).json({ error: 'Access denied. Customers only.' });
    }
    
    // Delete all call logs for this customer
    const deleteResult = await CallLog.deleteMany({ customerId });
    
    console.log(`🗑️ Customer deleted ${deleteResult.deletedCount} call logs for: ${user.name || user.email} (${customerId})`);
    
    res.json({
      success: true,
      message: `Successfully deleted ${deleteResult.deletedCount} call log${deleteResult.deletedCount !== 1 ? 's' : ''}`,
      deletedCount: deleteResult.deletedCount
    });
  } catch (error) {
    console.error('Error deleting call logs:', error);
    res.status(500).json({ 
      error: 'Failed to delete call logs',
      details: error.message 
    });
  }
});

// Helper function to format duration
function formatDuration(seconds) {
  if (!seconds) return '0s';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// GET /api/twilio/test-credentials - Test Twilio credentials (admin only, for debugging)
router.get('/test-credentials', authenticateToken, authorizeRole(['admin']), (req, res) => {
  try {
    const credentials = getTwilioCredentials();
    
    // Try to make a simple API call to verify credentials work
    return twilioRequest('GET', '/IncomingPhoneNumbers.json?PageSize=1')
      .then(() => {
        res.json({
          success: true,
          message: 'Twilio credentials are valid and working',
          credentials: {
            hasAccountSid: !!credentials.accountSid,
            accountSidPrefix: credentials.accountSid?.substring(0, 4),
            usingApiKey: credentials.usingApiKey,
            hasUsername: !!credentials.username,
            hasPassword: !!credentials.password
          }
        });
      })
      .catch((error) => {
        res.status(500).json({
          success: false,
          message: 'Twilio credentials test failed',
          error: error.message,
          response: error.response?.data,
          status: error.response?.status,
          credentials: {
            hasAccountSid: !!credentials.accountSid,
            accountSidPrefix: credentials.accountSid?.substring(0, 4),
            usingApiKey: credentials.usingApiKey
          }
        });
      });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get Twilio credentials',
      error: error.message,
      env: {
        TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ? `${process.env.TWILIO_ACCOUNT_SID.substring(0, 4)}...` : 'NOT SET',
        TWILIO_API_KEY_SID: process.env.TWILIO_API_KEY_SID ? `${process.env.TWILIO_API_KEY_SID.substring(0, 4)}...` : 'NOT SET',
        TWILIO_API_KEY_SECRET: process.env.TWILIO_API_KEY_SECRET ? 'SET' : 'NOT SET',
        TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ? 'SET' : 'NOT SET'
      }
    });
  }
});

// GET /api/twilio/ai-status - Check if AI detection is enabled (admin only)
router.get('/ai-status', authenticateToken, authorizeRole(['admin']), (req, res) => {
  const isOpenAIAvailable = OpenAI !== null;
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  const aiEnabled = isOpenAIAvailable && hasApiKey;
  
  res.json({
    aiEnabled: aiEnabled,
    openaiPackageInstalled: isOpenAIAvailable,
    apiKeyConfigured: hasApiKey,
    model: 'gpt-4o-mini',
    fallback: 'keyword-based detection'
  });
});

module.exports = router;

