const express = require('express');
const axios = require('axios');
const router = express.Router();
const User = require('../models/User');
const CallLog = require('../models/CallLog');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

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
    const { clinicId, phoneNumber, forwardNumber, forwardNumberNew, forwardNumberExisting, menuMessage } = req.body;
    
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
      // Get voice for error message
      const errorVoice = process.env.TWILIO_VOICE || 'Polly.Joanna-Neural';
      const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${errorVoice}">Sorry, this number is not configured. Please contact your administrator.</Say>
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
      const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">Sorry, this number is not configured. Please contact your administrator.</Say>
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
      // Get voice for error message (before main voice declaration)
      const errorVoice = process.env.TWILIO_VOICE || 'Polly.Joanna-Neural';
      const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${errorVoice}">Sorry, the forward number is not configured correctly. Please contact your administrator.</Say>
  <Hangup/>
</Response>`;
      res.type('text/xml');
      return res.send(errorTwiML);
    }
    
    // Get voice setting (default: Polly.Joanna-Neural for better quality)
    // Options: Polly.Joanna-Neural, Polly.Olivia-Neural (female), Polly.Matthew-Neural, Polly.Joey-Neural (male)
    const voice = process.env.TWILIO_VOICE || 'Polly.Joanna-Neural';
    
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
    
    let twiML;
    
    // Create or update call log entry (always, if CallSid exists)
    if (CallSid) {
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
      ? `<Say voice="${voice}">This call may be recorded and transcribed for quality assurance and scheduling.</Say>`
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
  <Dial callerId="${To}" timeout="30" action="${voicemailCallback}" record="record-from-answer" recordingStatusCallback="${recordingStatusCallback}" recordingStatusCallbackMethod="POST" statusCallback="${dialStatusCallback}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST">
    <Number>${forwardNumber}</Number>
  </Dial>
</Response>`;
      } else {
        twiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${disclosureMessage}
  ${transcriptionStart}
  <Dial callerId="${To}" timeout="30" action="${voicemailCallback}" statusCallback="${dialStatusCallback}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST">
    <Number>${forwardNumber}</Number>
  </Dial>
</Response>`;
      }
    }
    // v2: Menu system - show menu (first time, no digits yet)
    else if (enableMenu) {
      console.log(`📋 Showing menu to caller`);
      console.log(`   Custom message: ${menuMessage}`);
      
      // Show menu FIRST (no disclosure yet)
      twiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather action="${callbackUrl}" method="POST" numDigits="1" timeout="10">
    <Say voice="${voice}">${menuMessage}</Say>
  </Gather>
  <Say voice="${voice}">We didn't receive your selection. Please call back and try again.</Say>
  <Hangup/>
</Response>`;
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
  <Dial callerId="${To}" timeout="30" action="${voicemailCallback}" record="record-from-answer" recordingStatusCallback="${recordingStatusCallback}" recordingStatusCallbackMethod="POST" statusCallback="${dialStatusCallback}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST">
    <Number>${forwardNumber}</Number>
  </Dial>
</Response>`;
      } else {
        twiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${disclosureMessage}
  ${transcriptionStart}
  <Dial callerId="${To}" timeout="30" action="${voicemailCallback}" statusCallback="${dialStatusCallback}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST">
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
    // Catch any unexpected errors and return proper TwiML
    console.error('❌ Error handling incoming call:', error);
    console.error('   Error stack:', error.stack);
    console.error('   Error message:', error.message);
    const errorVoice = process.env.TWILIO_VOICE || 'alice';
    const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${errorVoice}">Sorry, an error occurred while processing your call. Please try again later.</Say>
  <Hangup/>
</Response>`;
    res.type('text/xml');
    res.status(500).send(errorTwiML);
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
    
    // Find which clinic this call belongs to
    const clinic = await User.findOne({
      twilioPhoneNumber: To,
      role: 'customer'
    });
    
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
      if (!existingLog || !existingLog.dialCallStatus) {
        // No dialCallStatus yet - try to determine from status callback data
        
        // Option 1: Use DialCallStatus if provided in status callback
        if (DialCallStatus) {
          const dialDuration = DialCallDuration ? parseInt(DialCallDuration) : 0;
          if (DialCallStatus === 'answered') {
            updateData.dialCallStatus = 'answered';
            updateData.answerTime = new Date();
            updateData.duration = dialDuration || callInfo.duration;
            console.log(`✅ FALLBACK: Call ANSWERED (from DialCallStatus in status callback)`);
          } else if (DialCallStatus === 'completed') {
            if (dialDuration > 0) {
              updateData.dialCallStatus = 'answered';
              updateData.duration = dialDuration;
              updateData.answerTime = new Date();
              console.log(`✅ FALLBACK: Call COMPLETED and ANSWERED (duration: ${dialDuration}s)`);
            } else {
              updateData.dialCallStatus = 'no-answer';
              updateData.duration = 0;
              console.log(`❌ FALLBACK: Call COMPLETED but NOT answered (duration: 0)`);
            }
          } else if (DialCallStatus === 'no-answer' || DialCallStatus === 'busy' || 
                     DialCallStatus === 'failed' || DialCallStatus === 'canceled') {
            updateData.dialCallStatus = DialCallStatus;
            updateData.duration = 0;
            console.log(`❌ FALLBACK: Call NOT answered (${DialCallStatus})`);
          }
        }
        // Option 2: Use CallStatus and CallDuration as fallback
        else if (CallStatus === 'completed' && callInfo.duration > 0) {
          // Call completed with duration > 0 = answered
          updateData.dialCallStatus = 'answered';
          updateData.duration = callInfo.duration;
          updateData.answerTime = new Date();
          console.log(`✅ FALLBACK: Call COMPLETED with duration > 0 (answered, duration: ${callInfo.duration}s)`);
        } else if (CallStatus === 'completed' && callInfo.duration === 0) {
          // Call completed with duration = 0 = not answered
          updateData.dialCallStatus = 'no-answer';
          updateData.duration = 0;
          console.log(`❌ FALLBACK: Call COMPLETED with duration = 0 (not answered)`);
        } else if (CallStatus === 'failed' || CallStatus === 'busy' || CallStatus === 'no-answer' || CallStatus === 'canceled') {
          updateData.dialCallStatus = CallStatus;
          updateData.duration = 0;
          console.log(`❌ FALLBACK: Call NOT answered (${CallStatus})`);
        }
        
        // Set duration from status callback if not already set
        if (updateData.duration === undefined) {
          updateData.duration = callInfo.duration;
        }
      } else {
        // dialCallStatus already exists - don't override it (dial-status webhook is authoritative)
        console.log(`✅ dialCallStatus already exists (${existingLog.dialCallStatus}), preserving it`);
        // Only update duration if it's not set or is 0
        if (!existingLog.duration || existingLog.duration === 0) {
          if (callInfo.duration > 0) {
            updateData.duration = callInfo.duration;
            console.log(`   Updating duration from status callback: ${callInfo.duration}s`);
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
  try {
    const { CallSid, DialCallStatus } = req.query;
    
    console.log(`📞 Voicemail triggered for CallSid: ${CallSid}, DialCallStatus: ${DialCallStatus}`);
    
    // Get voice setting
    const voice = process.env.TWILIO_VOICE || 'Polly.Joanna-Neural';
    
    // Get base URL for voicemail callbacks
    let voicemailBaseUrl = process.env.BACKEND_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3000';
    voicemailBaseUrl = voicemailBaseUrl.replace(/\/$/, '');
    if (!voicemailBaseUrl.startsWith('http://localhost') && !voicemailBaseUrl.startsWith('https://')) {
      voicemailBaseUrl = `https://${voicemailBaseUrl}`;
    }
    
    // TwiML to record voicemail
    const twiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">Please leave a message after the tone. Press the pound key when you're finished.</Say>
  <Record 
    maxLength="300" 
    finishOnKey="#" 
    action="${voicemailBaseUrl}/api/twilio/voice/voicemail-complete?CallSid=${CallSid}" 
    recordingStatusCallback="${voicemailBaseUrl}/api/twilio/voice/voicemail-status" 
    recordingStatusCallbackMethod="POST"
    transcribe="false"
  />
  <Say voice="${voice}">Thank you for your message. Goodbye.</Say>
  <Hangup/>
</Response>`;
    
    res.type('text/xml');
    res.send(twiML);
  } catch (error) {
    console.error('❌ Error handling voicemail request:', error);
    res.type('text/xml');
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);
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
      
      // Only store voicemail if call was not answered (it's a missed call)
      // If call was answered, this recording is a regular call recording, not voicemail
      if (existingLog && existingLog.dialCallStatus !== 'answered') {
        // Store voicemail in call log
        // Note: recordingSid is used for voicemail playback (since voicemail only happens on missed calls,
        // there won't be a regular call recording, so we can safely reuse recordingSid)
        const updateData = {
          voicemailUrl: RecordingUrl || null,
          voicemailDuration: RecordingDuration ? parseInt(RecordingDuration) : null,
          recordingSid: RecordingSid // Store for voicemail playback (safe since call wasn't answered)
        };
        
        await CallLog.findOneAndUpdate(
          { callSid: CallSid },
          updateData,
          { new: true }
        ).catch(err => console.error('Error updating call log with voicemail:', err));
        
        console.log(`✅ Voicemail saved for CallSid: ${CallSid}, Duration: ${RecordingDuration}s`);
      } else if (existingLog && existingLog.dialCallStatus === 'answered') {
        // Call was answered, this is a regular recording, not voicemail
        // Don't store voicemail for answered calls
        console.log(`ℹ️ Call was answered - ignoring voicemail recording (this should not happen)`);
      } else {
        // No call log found yet - store voicemail anyway (it will be a missed call)
        await CallLog.findOneAndUpdate(
          { callSid: CallSid },
          {
            voicemailUrl: RecordingUrl || null,
            voicemailDuration: RecordingDuration ? parseInt(RecordingDuration) : null,
            recordingSid: RecordingSid // Store for voicemail playback
          },
          { upsert: true, setDefaultsOnInsert: true }
        ).catch(err => console.error('Error updating call log with voicemail:', err));
        
        console.log(`✅ Voicemail saved for CallSid: ${CallSid} (no existing log found)`);
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
    
    if (DialCallStatus === 'answered') {
      // Call was answered - this is definitive
      updateData.dialCallStatus = 'answered';
      updateData.answerTime = new Date();
      console.log(`✅ Call ANSWERED (authoritative from dial-status webhook)`);
    } else if (DialCallStatus === 'completed') {
      // Call completed - determine if it was answered based on duration
      const duration = DialCallDuration ? parseInt(DialCallDuration) : 0;
      
      if (duration > 0) {
        // Duration > 0 means call was answered and had conversation
        updateData.dialCallStatus = 'answered';
        updateData.duration = duration;
        if (!existingLog || !existingLog.answerTime) {
          updateData.answerTime = new Date();
        }
        updateData.endedAt = new Date();
        console.log(`✅ Call COMPLETED and ANSWERED (authoritative, duration: ${duration}s)`);
      } else {
        // Duration is 0 = not answered (or answered but immediately hung up)
        // Check if we previously had 'answered' status
        if (existingLog && existingLog.dialCallStatus === 'answered') {
          // Was previously answered, keep it as answered but set duration to 0
          updateData.dialCallStatus = 'answered';
          updateData.duration = 0;
          updateData.endedAt = new Date();
          console.log(`⚠️ Call COMPLETED (was answered but duration is 0 - keeping as answered)`);
        } else {
          // Not answered
          updateData.dialCallStatus = 'no-answer';
          updateData.duration = 0;
          updateData.endedAt = new Date();
          console.log(`❌ Call COMPLETED but NOT answered (authoritative, duration: 0)`);
        }
      }
    } else if (DialCallStatus === 'no-answer' || DialCallStatus === 'busy' || 
               DialCallStatus === 'failed' || DialCallStatus === 'canceled') {
      // Call was not answered - these statuses are definitive
      updateData.dialCallStatus = DialCallStatus;
      updateData.duration = 0;
      updateData.endedAt = new Date();
      console.log(`❌ Call NOT answered: ${DialCallStatus} (authoritative)`);
    } else {
      // Intermediate status (initiated, ringing) - update status but don't mark as answered/missed yet
      updateData.dialCallStatus = DialCallStatus;
      console.log(`⏳ Intermediate status: ${DialCallStatus}`);
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
  const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', frontendUrl !== '*' ? frontendUrl : '*');
  res.setHeader('Access-Control-Allow-Credentials', frontendUrl !== '*' ? 'true' : 'false');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(204).send();
});

// OPTIONS handler for CORS preflight (voicemail endpoint) - MUST be before GET route
router.options('/voicemail/:callSid', (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', frontendUrl !== '*' ? frontendUrl : '*');
  res.setHeader('Access-Control-Allow-Credentials', frontendUrl !== '*' ? 'true' : 'false');
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
    // When using credentials, origin cannot be '*' - must be specific origin
    const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', frontendUrl !== '*' ? frontendUrl : '*');
    res.setHeader('Access-Control-Allow-Credentials', frontendUrl !== '*' ? 'true' : 'false');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    
    // Fetch recording media from Twilio API
    // Twilio recording media URL format: https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Recordings/{RecordingSid}.mp3
    try {
      const recordingMediaUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}.mp3`;
      
      // Fetch the actual audio file from Twilio with authentication
      const audioResponse = await axios.get(recordingMediaUrl, {
        auth: {
          username: username,
          password: password
        },
        responseType: 'stream'
      });
      
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
      const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || '*';
      res.setHeader('Access-Control-Allow-Origin', frontendUrl !== '*' ? frontendUrl : '*');
      res.setHeader('Access-Control-Allow-Credentials', frontendUrl !== '*' ? 'true' : 'false');
      res.status(500).json({ error: 'Failed to fetch recording', details: error.message });
    }
  } catch (error) {
    console.error('Error in recording proxy:', error);
    // Set CORS headers even for errors
    const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', frontendUrl !== '*' ? frontendUrl : '*');
    res.setHeader('Access-Control-Allow-Credentials', frontendUrl !== '*' ? 'true' : 'false');
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
    // When using credentials, origin cannot be '*' - must be specific origin
    const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', frontendUrl !== '*' ? frontendUrl : '*');
    res.setHeader('Access-Control-Allow-Credentials', frontendUrl !== '*' ? 'true' : 'false');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    
    // Fetch voicemail recording from Twilio API (using recordingSid which stores the voicemail SID)
    try {
      const recordingMediaUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${callLog.recordingSid}.mp3`;
      
      // Fetch the actual audio file from Twilio with authentication
      const audioResponse = await axios.get(recordingMediaUrl, {
        auth: {
          username: username,
          password: password
        },
        responseType: 'stream'
      });
      
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
      const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || '*';
      res.setHeader('Access-Control-Allow-Origin', frontendUrl !== '*' ? frontendUrl : '*');
      res.setHeader('Access-Control-Allow-Credentials', frontendUrl !== '*' ? 'true' : 'false');
      res.status(500).json({ error: 'Failed to fetch voicemail', details: error.message });
    }
  } catch (error) {
    console.error('Error in voicemail proxy:', error);
    // Set CORS headers even for errors
    const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', frontendUrl !== '*' ? frontendUrl : '*');
    res.setHeader('Access-Control-Allow-Credentials', frontendUrl !== '*' ? 'true' : 'false');
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
      
      // Only update if the result is different (to avoid unnecessary DB writes)
      if (callLog.appointmentBooked !== appointmentBooked) {
        await CallLog.findOneAndUpdate(
          { callSid: callSid },
          { appointmentBooked: appointmentBooked }
        );
        console.log(`✅ Re-analyzed summary - appointment status changed: ${callLog.appointmentBooked} → ${appointmentBooked}`);
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
          
          await CallLog.findOneAndUpdate(
            { callSid: callSid },
            { 
              summaryText: summary, 
              summaryReady: true,
              appointmentBooked: appointmentBooked
            }
          );
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

// GET /api/twilio/call-logs - Get call logs for authenticated customer
router.get('/call-logs', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.id;
    
    // Verify user is a customer
    const user = await User.findById(customerId);
    if (!user || user.role !== 'customer') {
      return res.status(403).json({ error: 'Access denied. Customers only.' });
    }
    
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
    
    if (RecordingStatus === 'completed' && RecordingSid && CallSid) {
      // Store the RecordingSid - we'll use it to fetch the recording via our proxy endpoint
      // Twilio recording URLs require authentication, so we'll proxy them through our backend
      await CallLog.findOneAndUpdate(
        { callSid: CallSid },
        {
          recordingSid: RecordingSid,
          recordingUrl: RecordingUrl || null // Store the URL if provided, but we'll use SID for access
        },
        { new: true }
      ).catch(err => console.error('Error updating call log with recording:', err));
      
      console.log(`✅ Recording saved for CallSid: ${CallSid}`);
      console.log(`   RecordingSid: ${RecordingSid}`);
      
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
          
          await CallLog.updateOne(
            { transcriptSid: transcriptSid },
            {
              $set: { 
                summaryText: summary, 
                summaryReady: true,
                appointmentBooked: appointmentBooked,
                updatedAt: new Date() 
              }
            }
          );
          console.log(`✅ Conversation summary saved for transcript: ${transcriptSid}`);
          console.log(`   Appointment booked: ${appointmentBooked ? 'Yes' : 'No'}`);
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


// GET /api/twilio/configuration - Get Twilio configuration for authenticated customer
router.get('/configuration', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.id;
    
    // Verify user is a customer
    const user = await User.findById(customerId);
    if (!user || user.role !== 'customer') {
      return res.status(403).json({ error: 'Access denied. Customers only.' });
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

// GET /api/twilio/call-logs/stats - Get call statistics for authenticated customer
router.get('/call-logs/stats', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.id;
    
    // Verify user is a customer
    const user = await User.findById(customerId);
    if (!user || user.role !== 'customer') {
      return res.status(403).json({ error: 'Access denied. Customers only.' });
    }
    
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
    
    // Appointments Booked = Calls where appointmentBooked === true
    const appointmentsBooked = await CallLog.countDocuments({
      ...query,
      appointmentBooked: true
    });
    console.log(`📊 Appointments booked: ${appointmentsBooked}`);
    
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
    console.log(`📊 Final stats: Total=${totalCalls}, Answered=${answeredCalls}, Missed=${missedCalls}, Appointments=${appointmentsBooked}, Duration=${totalDuration}s, Avg=${avgDuration}s`);
    
    res.json({
      totalCalls,
      completedCalls: answeredCalls, // Return answeredCalls as completedCalls for backward compatibility
      missedCalls: missedCalls, // Missed = Calls forwarded but not answered
      newPatientCalls,
      existingPatientCalls,
      appointmentsBooked, // Number of calls that led to appointment bookings
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

