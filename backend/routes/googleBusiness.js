const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');
const User = require('../models/User');
const GoogleBusinessInsights = require('../models/GoogleBusinessInsights');
const GoogleBusinessDataRefreshService = require('../services/googleBusinessDataRefreshService');
const { google } = require('googleapis');
const axios = require('axios');

// Helper function to fetch business insights data with batching for long ranges
async function fetchBusinessInsightsData(oauth2Client, locationName, startDate, endDate, accessToken) {
  
  // Convert dates to Date objects for range calculation
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  
  // Calculate days difference
  const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  
  // If range is >60 days, split into batches (2×45 day approach recommended by ChatGPT)
  if (daysDiff > 60) {
    console.log(`📊 Range is ${daysDiff} days, splitting into batches for reliability`);
    console.log(`📅 Start: ${startDate}, End: ${endDate}`);
    
    const batchResults = [];
    const batchSize = 45; // Conservative batch size
    
    for (let batchStart = start; batchStart < end; batchStart = new Date(batchStart.getTime() + batchSize * 24 * 60 * 60 * 1000)) {
      const batchEnd = new Date(batchStart.getTime() + batchSize * 24 * 60 * 60 * 1000);
      const actualBatchEnd = batchEnd > end ? end : batchEnd;
      
      const batchStartStr = batchStart.toISOString().split('T')[0];
      const batchEndStr = actualBatchEnd.toISOString().split('T')[0];
      
      console.log(`📦 Fetching batch: ${batchStartStr} to ${batchEndStr}`);
      
      const batchData = await fetchBusinessInsightsDataSingle(oauth2Client, locationName, batchStartStr, batchEndStr, accessToken);
      
      console.log(`✅ Batch complete, got ${batchData?.multiDailyMetricTimeSeries?.length || 0} metric groups`);
      console.log(`   Sample data:`, JSON.stringify(batchData?.multiDailyMetricTimeSeries?.[0]?.dailyMetric || 'none'));
      
      batchResults.push(batchData);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`📊 Merging ${batchResults.length} batch results...`);
    
    // Merge all batch results
    const merged = mergeBatchResults(batchResults);
    
    console.log(`✅ Merged result has ${merged?.multiDailyMetricTimeSeries?.length || 0} metric groups`);
    
    return merged;
  } else {
    // Single request for ranges ≤60 days
    console.log(`📅 Single request for ${daysDiff} days`);
    return fetchBusinessInsightsDataSingle(oauth2Client, locationName, startDate, endDate, accessToken);
  }
}

// Helper function to fetch business insights data (single request)
async function fetchBusinessInsightsDataSingle(oauth2Client, locationName, startDate, endDate, accessToken) {
  // Convert dates to the format expected by the API
  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    throw new Error(`Invalid date format. Expected YYYY-MM-DD, got startDate: ${startDate}, endDate: ${endDate}`);
  }
  
  const startDateObj = {
    year: parseInt(startDate.split('-')[0]),
    month: parseInt(startDate.split('-')[1]),
    day: parseInt(startDate.split('-')[2])
  };
  const endDateObj = {
    year: parseInt(endDate.split('-')[0]),
    month: parseInt(endDate.split('-')[1]),
    day: parseInt(endDate.split('-')[2])
  };
  
  // Validate parsed date values
  if (isNaN(startDateObj.year) || isNaN(startDateObj.month) || isNaN(startDateObj.day) ||
      isNaN(endDateObj.year) || isNaN(endDateObj.month) || isNaN(endDateObj.day)) {
    throw new Error(`Invalid date values. startDate: ${startDate}, endDate: ${endDate}`);
  }
  
  // Validate month and day ranges
  if (startDateObj.month < 1 || startDateObj.month > 12 || endDateObj.month < 1 || endDateObj.month > 12) {
    throw new Error(`Invalid month values. Months must be between 1-12`);
  }
  if (startDateObj.day < 1 || startDateObj.day > 31 || endDateObj.day < 1 || endDateObj.day > 31) {
    throw new Error(`Invalid day values. Days must be between 1-31`);
  }

  const metrics = [
    'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
    'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
    'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
    'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
    'WEBSITE_CLICKS',
    'CALL_CLICKS',
    'BUSINESS_DIRECTION_REQUESTS'
  ];
  
  // Build query parameters using URLSearchParams
  const params = new URLSearchParams();
  metrics.forEach(metric => params.append('dailyMetrics', metric));
  params.append('dailyRange.start_date.year', startDateObj.year);
  params.append('dailyRange.start_date.month', startDateObj.month);
  params.append('dailyRange.start_date.day', startDateObj.day);
  params.append('dailyRange.end_date.year', endDateObj.year);
  params.append('dailyRange.end_date.month', endDateObj.month);
  params.append('dailyRange.end_date.day', endDateObj.day);
  
  const insightsResponse = await axios.get(
    `https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMultiDailyMetricsTimeSeries`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      params,
      paramsSerializer: p => p.toString()
    }
  );
  
  return insightsResponse.data;
}

// Helper function to merge batch results
// ✅ FIX 2: Properly handle nested multiDailyMetricTimeSeries structure with location groups and deduplication
function mergeBatchResults(batches) {
  if (!batches || batches.length === 0) {
    return { multiDailyMetricTimeSeries: [] };
  }
  
  if (batches.length === 1) {
    return batches[0];
  }
  
  // Initialize merged result with the structure from first batch
  const merged = {
    multiDailyMetricTimeSeries: []
  };
  
  // Collect all location groups across batches
  const locationGroups = new Map();
  
  batches.forEach(batch => {
    if (!batch?.multiDailyMetricTimeSeries) return;
    
    batch.multiDailyMetricTimeSeries.forEach((locationGroup, index) => {
      if (!locationGroups.has(index)) {
        locationGroups.set(index, {
          dailyMetricTimeSeries: []
        });
      }
      
      const targetGroup = locationGroups.get(index);
      
      // Merge dailyMetricTimeSeries for this location
      if (locationGroup?.dailyMetricTimeSeries) {
        locationGroup.dailyMetricTimeSeries.forEach(metricSeries => {
          // Find existing metric series or create new one
          let existingMetric = targetGroup.dailyMetricTimeSeries.find(
            m => m.dailyMetric === metricSeries.dailyMetric
          );
          
          if (!existingMetric) {
            existingMetric = {
              dailyMetric: metricSeries.dailyMetric,
              timeSeries: {
                datedValues: []
              }
            };
            targetGroup.dailyMetricTimeSeries.push(existingMetric);
          }
          
          // Merge datedValues
          if (metricSeries?.timeSeries?.datedValues) {
            existingMetric.timeSeries.datedValues.push(
              ...metricSeries.timeSeries.datedValues
            );
          }
        });
      }
    });
  });
  
  // Convert Map back to array
  merged.multiDailyMetricTimeSeries = Array.from(locationGroups.values());
  
  // Sort all datedValues by date and remove duplicates
  merged.multiDailyMetricTimeSeries.forEach(locationGroup => {
    locationGroup.dailyMetricTimeSeries?.forEach(metricSeries => {
      if (metricSeries?.timeSeries?.datedValues) {
        // Sort by date
        metricSeries.timeSeries.datedValues.sort((a, b) => {
          const dateA = new Date(a.date.year, a.date.month - 1, a.date.day);
          const dateB = new Date(b.date.year, b.date.month - 1, b.date.day);
          return dateA - dateB;
        });
        
        // Remove duplicate dates (keep first occurrence)
        const seenDates = new Set();
        metricSeries.timeSeries.datedValues = metricSeries.timeSeries.datedValues.filter(v => {
          const dateKey = `${v.date.year}-${v.date.month}-${v.date.day}`;
          if (seenDates.has(dateKey)) return false;
          seenDates.add(dateKey);
          return true;
        });
      }
    });
  });
  
  console.log(`📊 Merged ${batches.length} batches into single response`);
  console.log(`📊 Location groups: ${merged.multiDailyMetricTimeSeries.length}`);
  return merged;
}

// GBP Call Assertion Helper - prevents bad requests from hitting Google
function assertGbpCall({ locationId, start, end, metrics }) {
  if (!locationId?.startsWith('locations/')) throw new Error('Bad locationId');
  if (!Array.isArray(metrics) || metrics.length === 0) throw new Error('No metrics');
  
  const allowed = new Set([
    'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH','BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
    'BUSINESS_IMPRESSIONS_DESKTOP_MAPS','BUSINESS_IMPRESSIONS_MOBILE_MAPS',
    'WEBSITE_CLICKS','CALL_CLICKS','BUSINESS_DIRECTION_REQUESTS'
  ]);
  
  for (const m of metrics) {
    if (!allowed.has(m)) throw new Error(`Unsupported metric: ${m}`);
  }
  
  const sd = new Date(`${start.year}-${String(start.month).padStart(2,'0')}-${String(start.day).padStart(2,'0')}T00:00:00Z`);
  const ed = new Date(`${end.year}-${String(end.month).padStart(2,'0')}-${String(end.day).padStart(2,'0')}T00:00:00Z`);
  
  if (Number.isNaN(sd.getTime()) || Number.isNaN(ed.getTime()) || sd > ed) {
    throw new Error('Bad date range');
  }
}

// Helper: Get redirect URI based on request origin (supports both localhost and production)
function getGoogleBusinessRedirectUri(req) {
  // Safety check: if req is null/undefined, use fallback
  if (!req) {
    if (process.env.GOOGLE_BUSINESS_REDIRECT_URI) {
      return process.env.GOOGLE_BUSINESS_REDIRECT_URI;
    }
    const port = process.env.PORT || 5000;
    return process.env.NODE_ENV === 'development'
      ? `http://localhost:${port}/api/google-business/callback`
      : 'https://api.clinimediaportal.ca/api/google-business/callback';
  }
  
  // Priority 1: Explicitly set environment variable
  if (process.env.GOOGLE_BUSINESS_REDIRECT_URI) {
    return process.env.GOOGLE_BUSINESS_REDIRECT_URI;
  }
  
  // Priority 2: Detect from request origin (supports both localhost and production)
  const protocol = req.protocol || (req.headers?.['x-forwarded-proto'] || 'http');
  const host = req.headers?.host || req.headers?.['x-forwarded-host'];
  
  if (host) {
    // Check if it's localhost/127.0.0.1
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      const port = host.split(':')[1] || process.env.PORT || 5000;
      return `http://localhost:${port}/api/google-business/callback`;
    }
    // Production domain
    else if (host.includes('clinimediaportal.ca') || host.includes('api.clinimediaportal.ca')) {
      return 'https://api.clinimediaportal.ca/api/google-business/callback';
    }
    // Railway or other hosting
    else if (process.env.RAILWAY_PUBLIC_DOMAIN) {
      return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/google-business/callback`;
    }
    // Use the host from request
    else {
      return `${protocol}://${host}/api/google-business/callback`;
    }
  }
  
  // Priority 3: Fallback based on environment variables
  let backendUrl;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    backendUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  } else if (process.env.BACKEND_URL) {
    backendUrl = process.env.BACKEND_URL;
  } else if (process.env.NODE_ENV === 'development') {
    const backendPort = process.env.PORT || 5000;
    backendUrl = `http://localhost:${backendPort}`;
  } else {
    backendUrl = 'https://api.clinimediaportal.ca';
  }
  
  return `${backendUrl}/api/google-business/callback`;
}

// OAuth 2.0 configuration (for service use - will be overridden per-request)
const backendPort = process.env.PORT || 5000;
// Priority: GOOGLE_BUSINESS_REDIRECT_URI > RAILWAY_PUBLIC_DOMAIN > BACKEND_URL > Production fallback
let backendUrl;
if (process.env.RAILWAY_PUBLIC_DOMAIN) {
  backendUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
} else if (process.env.BACKEND_URL) {
  backendUrl = process.env.BACKEND_URL;
} else if (process.env.NODE_ENV === 'development') {
  // Use localhost only in development
  backendUrl = `http://localhost:${backendPort}`;
} else {
  // Production fallback
  backendUrl = 'https://api.clinimediaportal.ca';
}
// Default redirect URI (for service use - actual requests will use getGoogleBusinessRedirectUri)
const defaultRedirectUri = process.env.GOOGLE_BUSINESS_REDIRECT_URI || `${backendUrl}/api/google-business/callback`;

console.log('🔧 Google Business OAuth Configuration:', {
  backendUrl,
  defaultRedirectUri,
  hasClientId: !!process.env.GOOGLE_BUSINESS_CLIENT_ID,
  hasClientSecret: !!process.env.GOOGLE_BUSINESS_CLIENT_SECRET,
  railwayDomain: process.env.RAILWAY_PUBLIC_DOMAIN
});

// Create OAuth2 client with default redirect URI (will be overridden per-request)
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_BUSINESS_CLIENT_ID,
  process.env.GOOGLE_BUSINESS_CLIENT_SECRET,
  defaultRedirectUri
);

// OAuth scopes for Google Business Profile
const SCOPES = [
  'https://www.googleapis.com/auth/business.manage'
];

// Helper: Get fresh access token from refresh token (direct API call - doesn't require redirect URI match)
// This fixes the issue where tokens authorized with localhost fail to refresh in production
async function refreshGoogleBusinessToken(refreshToken) {
  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_BUSINESS_CLIENT_ID,
      client_secret: process.env.GOOGLE_BUSINESS_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    
    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token || refreshToken, // Use new if provided, otherwise keep old
      expires_in: response.data.expires_in,
    };
  } catch (error) {
    console.error('❌ Direct token refresh failed:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw error;
  }
}

// GET /api/google-business/auth/admin - Initiate OAuth flow for admin (info@clinimedia.ca)
router.get('/auth/admin', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    // Check if required environment variables are set
    if (!process.env.GOOGLE_BUSINESS_CLIENT_ID) {
      console.error('❌ GOOGLE_BUSINESS_CLIENT_ID is not set');
      return res.status(500).json({ error: 'Google Business Client ID is not configured. Please add GOOGLE_BUSINESS_CLIENT_ID to environment variables.' });
    }
    if (!process.env.GOOGLE_BUSINESS_CLIENT_SECRET) {
      console.error('❌ GOOGLE_BUSINESS_CLIENT_SECRET is not set');
      return res.status(500).json({ error: 'Google Business Client Secret is not configured. Please add GOOGLE_BUSINESS_CLIENT_SECRET to environment variables.' });
    }
    
    // ✅ FIXED: Dynamically detect redirect URI from request (supports both localhost and production)
    const redirectUri = getGoogleBusinessRedirectUri(req);
    
    // Create a new OAuth2 client with the detected redirect URI for this request
    const requestOAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_BUSINESS_CLIENT_ID,
      process.env.GOOGLE_BUSINESS_CLIENT_SECRET,
      redirectUri
    );
    
    const authUrl = requestOAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state: 'admin', // Use 'admin' as state for admin OAuth
      prompt: 'consent', // Force consent screen to get refresh token
      redirect_uri: redirectUri
    });
    
    console.log('✅ OAuth URL generated successfully');
    console.log('   Redirect URI:', redirectUri);
    console.log('   Request Host:', req.headers.host);
    console.log('   Request Protocol:', req.protocol || req.headers['x-forwarded-proto']);

    console.log('✅ OAuth URL generated successfully');
    res.json({ authUrl });
  } catch (error) {
    console.error('❌ OAuth URL generation error:', error);
    res.status(500).json({ error: 'Failed to generate OAuth URL', details: error.message });
  }
});

// GET /api/google-business/auth/:clinicId - Initiate OAuth flow for individual customer
router.get('/auth/:clinicId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { clinicId } = req.params;
    
    // ✅ FIXED: Dynamically detect redirect URI from request (supports both localhost and production)
    const redirectUri = getGoogleBusinessRedirectUri(req);
    
    // Create a new OAuth2 client with the detected redirect URI for this request
    const requestOAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_BUSINESS_CLIENT_ID,
      process.env.GOOGLE_BUSINESS_CLIENT_SECRET,
      redirectUri
    );
    
    const authUrl = requestOAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state: clinicId, // Pass clinic ID in state
      prompt: 'consent', // Force consent screen to get refresh token
      redirect_uri: redirectUri
    });

    res.json({ authUrl });
  } catch (error) {
    console.error('OAuth URL generation error:', error);
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
});

// Helper: Get frontend URL based on request origin (supports both localhost and production)
function getFrontendUrl(req) {
  // Safety check: if req is null/undefined, use fallback
  if (!req) {
    if (process.env.FRONTEND_URL) {
      return process.env.FRONTEND_URL;
    }
    return process.env.NODE_ENV === 'development' 
      ? `http://localhost:${process.env.VITE_PORT || 5173}`
      : 'https://www.clinimediaportal.ca';
  }
  
  // Priority 1: Explicitly set environment variable (set FRONTEND_URL on Railway for production)
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }

  // Priority 2: If production callback URI is set, we're on production backend → use production frontend
  // Fixes OAuth on Railway when Host may be internal (e.g. *.railway.app) and not clinimediaportal.ca
  const redirectUri = process.env.GOOGLE_BUSINESS_REDIRECT_URI || '';
  if (redirectUri.includes('api.clinimediaportal.ca') || redirectUri.includes('clinimediaportal.ca')) {
    return 'https://www.clinimediaportal.ca';
  }

  // Priority 3: Detect from request (trust proxy gives correct host when behind Railway/nginx)
  const protocol = req.protocol || (req.headers?.['x-forwarded-proto'] || 'http');
  const host = req.headers?.host || req.headers?.['x-forwarded-host'];

  if (host) {
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      const port = process.env.VITE_PORT || 5173;
      return `http://localhost:${port}`;
    }
    if (host.includes('clinimediaportal.ca')) {
      return 'https://www.clinimediaportal.ca';
    }
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
      return process.env.FRONTEND_URL || 'https://www.clinimediaportal.ca';
    }
  }

  // Priority 4: Fallback
  if (process.env.NODE_ENV === 'development') {
    return `http://localhost:${process.env.VITE_PORT || 5173}`;
  }
  return 'https://www.clinimediaportal.ca';
}

// GET /api/google-business/callback - Handle OAuth callback
router.get('/callback', async (req, res) => {
  // ✅ FIXED: Dynamically detect frontend URL from request (supports both localhost and production)
  const frontendUrl = getFrontendUrl(req);
  
  // ✅ FIXED: Handle OAuth errors from Google (like Google Ads does)
  const { code, state, error: oauthError } = req.query;
  
  if (oauthError) {
    console.error('❌ OAuth callback error from Google:', req.query);
    return res.redirect(`${frontendUrl}/admin/google-business?oauth_error=true&error=${encodeURIComponent(oauthError)}`);
  }
  
  try {
    if (!code || !state) {
      console.error('❌ Missing authorization code or state:', { code: !!code, state: !!state });
      return res.redirect(`${frontendUrl}/admin/google-business?oauth_error=true&error=missing_parameters`);
    }

    // ✅ FIXED: Dynamically detect redirect URI from request (must match the one used in auth URL)
    const redirectUri = getGoogleBusinessRedirectUri(req);
    
    // Create a new OAuth2 client with the detected redirect URI for this request
    const requestOAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_BUSINESS_CLIENT_ID,
      process.env.GOOGLE_BUSINESS_CLIENT_SECRET,
      redirectUri
    );
    
    // Exchange code for tokens
    console.log('🔄 OAuth Callback - Token Exchange:');
    console.log('   Redirect URI:', redirectUri);
    console.log('   Request Host:', req.headers?.host);
    console.log('   Request Protocol:', req.protocol || req.headers?.['x-forwarded-proto']);
    console.log('   Code received:', code ? 'Yes' : 'No');
    console.log('   State:', state);
    
    let tokens;
    try {
      const tokenResponse = await requestOAuth2Client.getToken(code);
      tokens = tokenResponse.tokens;
      requestOAuth2Client.setCredentials(tokens);
      console.log('✅ Tokens received from Google');
    } catch (tokenError) {
      console.error('❌ Token exchange failed:', {
        message: tokenError.message,
        code: tokenError.code,
        response: tokenError.response?.data
      });
      throw new Error(`Token exchange failed: ${tokenError.message}`);
    }
    
    // ✅ FIXED: Validate that we received tokens
    if (!tokens || !tokens.access_token || !tokens.refresh_token) {
      console.error('❌ Invalid tokens received from Google:', { 
        hasTokens: !!tokens, 
        hasAccessToken: !!tokens?.access_token, 
        hasRefreshToken: !!tokens?.refresh_token,
        tokenKeys: tokens ? Object.keys(tokens) : null
      });
      return res.redirect(`${frontendUrl}/admin/google-business?oauth_error=true&error=invalid_tokens`);
    }
    
    console.log('✅ Token validation passed:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      hasExpiryDate: !!tokens.expiry_date
    });

    // ✅ FIXED: Extract expiry information from tokens
    // Google's OAuth2Client returns expiry_date (Date object or timestamp)
    // Calculate expires_in (seconds until expiry)
    let expires_in = null;
    if (tokens.expiry_date) {
      const expiryDate = typeof tokens.expiry_date === 'number' 
        ? new Date(tokens.expiry_date) 
        : tokens.expiry_date;
      const now = Date.now();
      const expiryTime = expiryDate.getTime ? expiryDate.getTime() : expiryDate;
      expires_in = Math.max(0, Math.floor((expiryTime - now) / 1000)); // Convert to seconds
      console.log(`✅ Token expiry extracted: ${expires_in} seconds (${Math.floor(expires_in / 60)} minutes)`);
    } else if (tokens.expires_in) {
      // If expires_in is already provided, use it
      expires_in = tokens.expires_in;
      console.log(`✅ Token expires_in provided: ${expires_in} seconds`);
    } else {
      // Default to 1 hour (3600 seconds) if no expiry info
      expires_in = 3600;
      console.log('⚠️ No expiry information in tokens, defaulting to 1 hour (3600 seconds)');
    }

    // If this is admin OAuth, store tokens in database (admin User record)
    if (state === 'admin') {
      // ✅ FIXED: Save admin tokens to database (admin User record) - NON-BLOCKING
      // If database save fails, we still redirect successfully (original behavior)
      // Database save is just for our new refresh service, but OAuth flow should work regardless
      try {
        const adminUser = await User.findOne({ role: 'admin' });
        if (adminUser) {
          // Calculate expiry date
          const tokenExpiry = expires_in 
            ? new Date(Date.now() + expires_in * 1000)
            : new Date(Date.now() + 3600 * 1000); // Default to 1 hour if not provided
          
          // Save tokens to admin user record
          adminUser.googleBusinessAccessToken = tokens.access_token;
          adminUser.googleBusinessRefreshToken = tokens.refresh_token;
          adminUser.googleBusinessTokenExpiry = tokenExpiry;
          await adminUser.save();
          
          console.log('✅ Admin Google Business Profile tokens saved to database');
          console.log(`   Token expiry: ${tokenExpiry.toISOString()}`);
        } else {
          console.warn('⚠️ Admin user not found - tokens will not be saved to database, but OAuth will still succeed');
        }
      } catch (dbError) {
        // Don't fail OAuth flow if database save fails - original code didn't save to DB
        console.error('⚠️ Failed to save tokens to database (non-critical):', dbError.message);
        console.log('   OAuth will still succeed - tokens are in redirect URL');
      }
      
      // Always redirect successfully with tokens in URL (original behavior)
      // ✅ FIXED: URL encode tokens to handle special characters
      const encodedAccessToken = encodeURIComponent(tokens.access_token);
      const encodedRefreshToken = encodeURIComponent(tokens.refresh_token);
      res.redirect(`${frontendUrl}/admin/google-business?admin_oauth_success=true&access_token=${encodedAccessToken}&refresh_token=${encodedRefreshToken}&expires_in=${expires_in}`);
    } else {
      // Handle customer-specific OAuth (if needed in future)
      const encodedAccessToken = encodeURIComponent(tokens.access_token);
      const encodedRefreshToken = encodeURIComponent(tokens.refresh_token);
      res.redirect(`${frontendUrl}/admin/google-business?oauth_success=true&clinic_id=${state}&access_token=${encodedAccessToken}&refresh_token=${encodedRefreshToken}&expires_in=${expires_in}`);
    }
  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    console.error('   Error details:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      response: error?.response?.data
    });
    // Redirect to frontend with error
    const errorMessage = error?.message || 'Unknown error';
    res.redirect(`${frontendUrl}/admin/google-business?oauth_error=true&error=${encodeURIComponent(errorMessage)}`);
  }
});

// GET /api/google-business/admin-business-profiles - Get all business profiles from admin account
router.get('/admin-business-profiles', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    // ✅ FIXED: Get admin tokens from database first (with fallback to header/env)
    let adminTokens;
    let adminUser = await User.findOne({ role: 'admin' });
    
    // Priority 1: Database (most reliable, persistent)
    if (adminUser?.googleBusinessAccessToken && adminUser?.googleBusinessRefreshToken) {
      adminTokens = {
        access_token: adminUser.googleBusinessAccessToken,
        refresh_token: adminUser.googleBusinessRefreshToken
      };
      console.log('[Google Business] Using admin tokens from database');
    } 
    // Priority 2: Header (from frontend, temporary)
    else if (req.headers['x-admin-tokens']) {
      adminTokens = JSON.parse(req.headers['x-admin-tokens']);
      console.log('[Google Business] Using admin tokens from header');
    } 
    // Priority 3: Environment variables (fallback)
    else {
      adminTokens = {
        access_token: process.env.GOOGLE_BUSINESS_ADMIN_ACCESS_TOKEN,
        refresh_token: process.env.GOOGLE_BUSINESS_ADMIN_REFRESH_TOKEN
      };
      console.log('[Google Business] Using admin tokens from environment variables');
    }

    if (!adminTokens.access_token) {
      return res.status(400).json({ error: 'Admin Google Business Profile not connected. Please connect first.' });
    }

    // ✅ FIXED: Check if token needs refresh and refresh if needed
    if (adminUser) {
      const now = Date.now();
      const expiresAt = adminUser.googleBusinessTokenExpiry ? new Date(adminUser.googleBusinessTokenExpiry).getTime() : 0;
      const refreshThreshold = 5 * 60 * 1000; // Refresh 5 minutes before expiry
      
      if (expiresAt > 0 && now > (expiresAt - refreshThreshold)) {
        console.log('[Google Business] Admin token expires soon, refreshing proactively...');
        
        if (!adminUser.googleBusinessRefreshToken) {
          return res.status(401).json({ 
            error: 'Admin Google Business Profile refresh token missing. Please reconnect.',
            requiresReauth: true
          });
        }
        
        try {
          const refreshedTokens = await refreshGoogleBusinessToken(adminUser.googleBusinessRefreshToken);
          
          // Calculate new expiry
          let newExpiry = null;
          if (refreshedTokens.expires_in && !isNaN(Number(refreshedTokens.expires_in)) && refreshedTokens.expires_in > 0) {
            newExpiry = new Date(Date.now() + refreshedTokens.expires_in * 1000);
          } else {
            newExpiry = new Date(Date.now() + 3600 * 1000);
          }
          
          const updateData = {
            googleBusinessAccessToken: refreshedTokens.access_token,
            googleBusinessTokenExpiry: newExpiry
          };
          
          if (refreshedTokens.refresh_token) {
            updateData.googleBusinessRefreshToken = refreshedTokens.refresh_token;
          }
          
          await User.findByIdAndUpdate(adminUser._id, updateData);
          
          // Update tokens for this request
          adminTokens.access_token = refreshedTokens.access_token;
          if (refreshedTokens.refresh_token) {
            adminTokens.refresh_token = refreshedTokens.refresh_token;
          }
          
          console.log('[Google Business] ✅ Admin token refreshed successfully');
        } catch (refreshError) {
          console.error('[Google Business] ❌ Admin token refresh failed:', refreshError.message);
          
          if (refreshError.response?.data?.error === 'invalid_grant' || 
              refreshError.message?.includes('invalid_grant')) {
            return res.status(401).json({ 
              error: 'Admin Google Business Profile refresh token expired. Please reconnect.',
              requiresReauth: true,
              details: 'Token has been expired or revoked. Click "Reconnect" to authorize again.'
            });
          }
          
          // Continue with existing token if refresh fails (might still work)
        }
      }
    }

    // Set up OAuth client with admin tokens
    oauth2Client.setCredentials(adminTokens);

    // Use the correct Google Business Profile API approach
    // First, get all accounts the user has access to
    let accounts;
    try {
      const accountManagement = google.mybusinessaccountmanagement({ version: 'v1', auth: oauth2Client });
      const accountsResponse = await accountManagement.accounts.list();
      accounts = accountsResponse.data.accounts || [];
    } catch (apiError) {
      // Check if it's an invalid_grant error (expired refresh token)
      if (apiError.message?.includes('invalid_grant') || apiError.response?.data?.error === 'invalid_grant') {
        console.error('❌ Admin refresh token expired or revoked during API call');
        return res.status(401).json({ 
          error: 'Admin Google Business Profile refresh token expired. Please reconnect.',
          requiresReauth: true,
          details: 'Token has been expired or revoked. Click "Reconnect" to authorize again.'
        });
      }
      // If it's a different error, re-throw it
      throw apiError;
    }

    console.log('Found accounts:', accounts.length);
    console.log('Account details:', accounts.map(acc => ({
      name: acc.name,
      accountName: acc.accountName,
      displayName: acc.displayName,
      type: acc.type,
      verificationState: acc.verificationState
    })));
    
    // If no accounts found, that's the issue
    if (accounts.length === 0) {
      console.log('No accounts found - this is the root issue');
      return res.status(400).json({ 
        error: 'No accounts found. Please ensure info@clinimedia.ca has access to Google Business Profiles.',
        debug: { accountsFound: 0 }
      });
    }

    // Look for the LOCATION_GROUP account (CliniMedia)
    const groupAccount = accounts.find(acc => 
      acc.type === 'LOCATION_GROUP' && 
      (acc.accountName === 'CliniMedia' || acc.displayName === 'CliniMedia')
    );

    if (!groupAccount) {
      console.log('No LOCATION_GROUP found. Available accounts:', accounts.map(acc => ({
        name: acc.name,
        accountName: acc.accountName,
        displayName: acc.displayName,
        type: acc.type
      })));
      return res.status(400).json({ 
        error: 'CliniMedia group not found. Please ensure the group exists and info@clinimedia.ca is a manager.',
        debug: {
          accountsFound: accounts.length,
          accountDetails: accounts.map(acc => ({
            name: acc.name,
            accountName: acc.accountName,
            displayName: acc.displayName,
            type: acc.type
          }))
        }
      });
    }

    console.log('Found group account:', {
      name: groupAccount.name,
      accountName: groupAccount.accountName,
      displayName: groupAccount.displayName,
      type: groupAccount.type
    });

    // Now get all locations within this group
    const businessProfiles = [];
    const mybusiness = google.mybusinessbusinessinformation({ version: 'v1', auth: oauth2Client });
    
    try {
      console.log(`Fetching locations for group: ${groupAccount.name}`);
      
      // Use minimal mask that was working before
      const locationsResponse = await mybusiness.accounts.locations.list({
        parent: groupAccount.name,
        pageSize: 100,
        readMask: 'name,title'  // Minimal mask that was working
      });
      
      const locations = locationsResponse.data.locations || [];
      console.log(`Found ${locations.length} locations in group`);
      
      // Add each location as a business profile
      locations.forEach(location => {
        businessProfiles.push({
          id: location.name.split('/').pop(),
          name: location.title || location.storefrontAddress?.addressLines?.[0] || 'Unknown Business',
          address: location.storefrontAddress?.addressLines?.join(', ') || '',
          phone: location.primaryPhone || '',
          website: location.websiteUri || '',
          accountName: groupAccount.name,
          accountId: groupAccount.name.split('/').pop(),
          verificationState: location.verificationState || 'UNKNOWN',
          locationName: location.name // Full location resource name for insights
        });
      });
      
    } catch (locationError) {
      console.error('Error fetching locations from group:', locationError.message);
      
      // Log detailed error information to identify the specific field causing the issue
      const payload = locationError?.response?.data;
      console.error('HTTP Error Details:', {
        code: payload?.error?.code,
        status: payload?.error?.status,
        message: payload?.error?.message
      });

      // Check for field violations in the error details
      const details = payload?.error?.details || [];
      console.error('Error details array:', details);
      
      for (const d of details) {
        if (d['@type']?.includes('google.rpc.BadRequest')) {
          console.error('BadRequest details:', d);
          for (const v of (d.fieldViolations || [])) {
            console.error('Field violation:', v.field, '-', v.description);
          }
        }
      }
      
      console.error('Full error details:', {
        errors: locationError?.errors,
        response: locationError?.response?.data,
        status: locationError?.status,
        code: locationError?.code
      });
      
      return res.status(500).json({ 
        error: 'Failed to fetch locations from CliniMedia group',
        details: locationError.message,
        debug: {
          errors: locationError?.errors,
          response: locationError?.response?.data,
          fieldViolations: details
        }
      });
    }

    console.log('=== SUCCESS ===');
    console.log('Group account:', groupAccount.name);
    console.log('Business profiles found:', businessProfiles.length);
    businessProfiles.forEach((profile, index) => {
      console.log(`Profile ${index + 1}: ${profile.name} (${profile.id})`);
    });
    console.log('================');

    if (businessProfiles.length === 0) {
      return res.status(400).json({ 
        error: 'No business profiles found in CliniMedia group. Please ensure clinics are transferred to the group.',
        debug: {
          groupAccount: groupAccount.name,
          groupType: groupAccount.type
        }
      });
    }

    res.json({ businessProfiles });
  } catch (error) {
    console.error('Admin business profiles fetch error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status
    });
    res.status(500).json({ 
      error: 'Failed to fetch business profiles',
      details: error.message 
    });
  }
});

// GET /api/google-business/admin-connection-status - Check if admin Google Business Profile is connected
router.get('/admin-connection-status', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const adminUser = await User.findOne({ role: 'admin' });
    
    if (!adminUser) {
      return res.json({ 
        connected: false, 
        message: 'Admin user not found' 
      });
    }
    
    // Check if admin has valid tokens
    const hasAccessToken = !!adminUser.googleBusinessAccessToken;
    const hasRefreshToken = !!adminUser.googleBusinessRefreshToken;
    const hasExpiry = !!adminUser.googleBusinessTokenExpiry;
    
    if (hasAccessToken && hasRefreshToken) {
      // Check if token is expired
      let isExpired = false;
      if (hasExpiry) {
        const expiresAt = new Date(adminUser.googleBusinessTokenExpiry).getTime();
        const now = Date.now();
        const refreshThreshold = 5 * 60 * 1000; // 5 minutes before expiry
        isExpired = now > (expiresAt - refreshThreshold);
      }
      
      return res.json({ 
        connected: true,
        hasAccessToken,
        hasRefreshToken,
        hasExpiry,
        isExpired,
        expiresAt: adminUser.googleBusinessTokenExpiry,
        message: 'Admin Google Business Profile is connected'
      });
    }
    
    return res.json({ 
      connected: false,
      hasAccessToken,
      hasRefreshToken,
      hasExpiry,
      message: 'Admin Google Business Profile not connected'
    });
  } catch (error) {
    console.error('❌ Failed to check admin connection status:', error);
    res.status(500).json({ 
      connected: false,
      error: 'Failed to check admin connection status',
      details: error.message 
    });
  }
});

// POST /api/google-business/save-admin-tokens - Save admin tokens to database (optional, callback already saves)
router.post('/save-admin-tokens', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { access_token, refresh_token, expires_in } = req.body;
    
    if (!access_token || !refresh_token) {
      return res.status(400).json({ error: 'access_token and refresh_token are required' });
    }
    
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      return res.status(404).json({ error: 'Admin user not found' });
    }
    
    // Calculate expiry date
    const tokenExpiry = expires_in 
      ? new Date(Date.now() + expires_in * 1000)
      : new Date(Date.now() + 3600 * 1000); // Default to 1 hour if not provided
    
    // Save tokens to admin user record
    adminUser.googleBusinessAccessToken = access_token;
    adminUser.googleBusinessRefreshToken = refresh_token;
    adminUser.googleBusinessTokenExpiry = tokenExpiry;
    await adminUser.save();
    
    console.log('✅ Admin Google Business Profile tokens saved to database (from frontend)');
    console.log(`   Token expiry: ${tokenExpiry.toISOString()}`);
    
    res.json({ 
      success: true, 
      message: 'Admin tokens saved successfully',
      expiresAt: tokenExpiry
    });
  } catch (error) {
    console.error('❌ Failed to save admin tokens:', error);
    res.status(500).json({ error: 'Failed to save admin tokens', details: error.message });
  }
});

// POST /api/google-business/save-business-profile - Save selected business profile
router.post('/save-business-profile', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { customerId, businessProfileId, businessProfileName, tokens } = req.body;

    console.log('Save business profile request:', {
      customerId,
      businessProfileId,
      businessProfileName,
      hasTokens: !!tokens,
      tokenKeys: tokens ? Object.keys(tokens) : null
    });

    if (!customerId || !businessProfileId || !businessProfileName) {
      console.log('Missing required fields:', {
        customerId: !!customerId,
        businessProfileId: !!businessProfileId,
        businessProfileName: !!businessProfileName,
        tokens: !!tokens
      });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // ✅ FIXED: Use admin tokens from database if tokens not provided in request
    let tokensToUse = tokens;
    if (!tokens || !tokens.access_token || !tokens.refresh_token) {
      console.log('⚠️ Tokens not provided in request, using admin tokens from database');
      const adminUser = await User.findOne({ role: 'admin' });
      if (adminUser?.googleBusinessAccessToken && adminUser?.googleBusinessRefreshToken) {
        tokensToUse = {
          access_token: adminUser.googleBusinessAccessToken,
          refresh_token: adminUser.googleBusinessRefreshToken,
          expires_in: adminUser.googleBusinessTokenExpiry 
            ? Math.floor((new Date(adminUser.googleBusinessTokenExpiry).getTime() - Date.now()) / 1000)
            : 3600
        };
        console.log('✅ Using admin tokens from database');
      } else {
        return res.status(400).json({ 
          error: 'No tokens available. Please connect admin account first or provide tokens in request.' 
        });
      }
    }

    // Update customer with business profile info
    const updateData = {
      googleBusinessProfileId: businessProfileId,
      googleBusinessProfileName: businessProfileName,
      googleBusinessAccessToken: tokensToUse.access_token,
      googleBusinessRefreshToken: tokensToUse.refresh_token,
      googleBusinessNeedsReauth: false // ✅ FIXED: Always clear reauth flag when saving new tokens
    };

    // ✅ FIXED: Always set expiry - default to 1 hour if expires_in is not provided
    // OAuth tokens typically expire in 1 hour, so use that as default
    // This prevents immediate expiry checks that would incorrectly trigger reauth
    if (tokensToUse.expires_in && !isNaN(tokensToUse.expires_in) && tokensToUse.expires_in > 0) {
      updateData.googleBusinessTokenExpiry = new Date(Date.now() + tokensToUse.expires_in * 1000);
      console.log(`✅ Token expiry set: ${tokensToUse.expires_in} seconds from now`);
    } else {
      // Default to 1 hour (3600 seconds) if expires_in is not provided
      // This prevents the expiry check from immediately triggering a refresh
      updateData.googleBusinessTokenExpiry = new Date(Date.now() + 3600 * 1000);
      console.log('⚠️ Token expires_in not provided or invalid, defaulting to 1 hour expiry');
    }
    
    console.log('💾 Saving business profile with tokens:', {
      customerId,
      businessProfileId,
      businessProfileName,
      hasAccessToken: !!tokensToUse.access_token,
      hasRefreshToken: !!tokensToUse.refresh_token,
      tokenExpiry: updateData.googleBusinessTokenExpiry,
      needsReauth: false,
      usingAdminTokens: !tokens || !tokens.access_token
    });

    // ✅ FIXED: Use findByIdAndUpdate with { new: true } and verify the update
    const updatedCustomer = await User.findByIdAndUpdate(
      customerId, 
      updateData,
      { new: true, runValidators: true } // Return updated document and run validators
    );

    if (!updatedCustomer) {
      console.error('❌ Customer not found:', customerId);
      return res.status(404).json({ error: 'Customer not found' });
    }

    // ✅ FIXED: Verify the data was actually saved
    console.log('✅ Successfully saved business profile for customer:', customerId);
    console.log('   Verified saved data:', {
      profileId: updatedCustomer.googleBusinessProfileId,
      profileName: updatedCustomer.googleBusinessProfileName,
      hasAccessToken: !!updatedCustomer.googleBusinessAccessToken,
      hasRefreshToken: !!updatedCustomer.googleBusinessRefreshToken,
      tokenExpiry: updatedCustomer.googleBusinessTokenExpiry,
      needsReauth: updatedCustomer.googleBusinessNeedsReauth
    });

    res.json({ 
      success: true, 
      message: 'Business profile connected successfully',
      customer: {
        _id: updatedCustomer._id,
        googleBusinessProfileId: updatedCustomer.googleBusinessProfileId,
        googleBusinessProfileName: updatedCustomer.googleBusinessProfileName
      }
    });
  } catch (error) {
    console.error('Save business profile error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      customerId: req.body.customerId
    });
    res.status(500).json({ error: 'Failed to save business profile' });
  }
});

// GET /api/google-business/business-insights/:customerId - Get business insights
router.get('/business-insights/:customerId', authenticateToken, async (req, res) => {
  try {
    const { customerId } = req.params;
    const { start, end, days, compare } = req.query;

    // Get customer data
    let customer = await User.findById(customerId);
    if (!customer) {
      console.error(`❌ Customer not found: ${customerId}`);
      return res.status(404).json({ error: 'Customer not found' });
    }

    console.log(`🔍 Customer Google Business Profile check:`, {
      customerId: customer._id,
      customerName: customer.name,
      hasProfileId: !!customer.googleBusinessProfileId,
      profileId: customer.googleBusinessProfileId,
      hasAccessToken: !!customer.googleBusinessAccessToken,
      hasRefreshToken: !!customer.googleBusinessRefreshToken,
      profileName: customer.googleBusinessProfileName
    });

    // ✅ FIXED: Check if customer has profile assigned
    if (!customer || !customer.googleBusinessProfileId) {
      console.error(`❌ Missing Google Business Profile data for customer ${customerId}:`, {
        customerExists: !!customer,
        hasProfileId: !!customer?.googleBusinessProfileId,
        profileId: customer?.googleBusinessProfileId,
        profileName: customer?.googleBusinessProfileName
      });
      return res.status(400).json({ 
        error: 'No Google Business Profile connected. Please contact your administrator to connect a Google Business Profile.',
        details: {
          customerExists: !!customer,
          hasProfileId: !!customer?.googleBusinessProfileId,
          message: 'Please ensure the admin has assigned a Google Business Profile.'
        }
      });
    }
    
    // ✅ FIXED: Always prefer admin tokens (they're auto-refreshed) - customer tokens are just copies
    // This ensures customers always have working tokens even if their copied tokens expire
    let tokensToUse;
    let tokenExpiry;
    let usingAdminTokens = false;
    
    // Priority 1: Use admin tokens (always fresh, auto-refreshed every 30 seconds)
    const adminUser = await User.findOne({ role: 'admin' });
    if (adminUser?.googleBusinessAccessToken && adminUser?.googleBusinessRefreshToken) {
      tokensToUse = {
        access_token: adminUser.googleBusinessAccessToken,
        refresh_token: adminUser.googleBusinessRefreshToken
      };
      tokenExpiry = adminUser.googleBusinessTokenExpiry;
      usingAdminTokens = true;
      console.log('✅ Using admin tokens for customer (always fresh and auto-refreshed)');
    } 
    // Priority 2: Fallback to customer tokens if admin tokens somehow missing
    else if (customer.googleBusinessAccessToken && customer.googleBusinessRefreshToken) {
      tokensToUse = {
        access_token: customer.googleBusinessAccessToken,
        refresh_token: customer.googleBusinessRefreshToken
      };
      tokenExpiry = customer.googleBusinessTokenExpiry;
      usingAdminTokens = false;
      console.log('⚠️ Using customer tokens (admin tokens not available)');
    } 
    // Priority 3: No tokens available
    else {
      return res.status(400).json({ 
        error: 'Google Business Profile tokens not available. Please ask your administrator to reconnect.',
        details: {
          customerHasTokens: !!(customer.googleBusinessAccessToken && customer.googleBusinessRefreshToken),
          adminHasTokens: !!(adminUser?.googleBusinessAccessToken && adminUser?.googleBusinessRefreshToken),
          message: 'Both customer and admin tokens are missing. Admin needs to reconnect.'
        }
      });
    }

    // Check if we have stored data for this date range first
    // ✅ NEW: Allow forcing fresh data fetch
    const forceRefresh = req.query.forceRefresh === 'true';
    
    let storedData = null;
    if (!forceRefresh && days && !start && !end) {
      // For standard date ranges (7, 30, 90 days), check for stored data
      const today = new Date();
      const bufferDays = 2; // ✅ FIXED: Reduced from 3 to 2 days (Google data is typically 1-2 days behind)
      const daysNum = parseInt(days);
      const totalDays = daysNum + bufferDays;
      const calculatedStartDate = new Date(today.getTime() - totalDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const calculatedEndDate = new Date(today.getTime() - bufferDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // ✅ FIX 1: For 90-day requests, just find the most recent 90-day record
      // Don't require exact date match since dates change daily
      if (daysNum === 90) {
        storedData = await GoogleBusinessInsights.findOne({
          customerId: customerId,
          'period.days': daysNum
        }).sort({ lastUpdated: -1 });
        
        // Check if the stored data is fresh (less than 24 hours old)
        if (storedData) {
          const dataAge = Date.now() - new Date(storedData.lastUpdated).getTime();
          const maxAge = 24 * 60 * 60 * 1000; // 24 hours
          
          if (dataAge > maxAge) {
            const ageInHours = Math.round(dataAge / (60 * 60 * 1000));
            console.log(`⚠️ Stored 90-day data is ${ageInHours} hours old - fetching fresh data`);
            storedData = null; // Force fresh fetch
          } else {
            const ageInHours = Math.round(dataAge / (60 * 60 * 1000));
            console.log(`✅ Using cached 90-day data (${ageInHours} hours old)`);
            
            // Filter daily data to match the requested date range if needed
            if (storedData.dailyData && storedData.dailyData.length > 0) {
              const filteredDailyData = storedData.dailyData.filter(day => {
                const dayDateStr = typeof day.date === 'string' ? day.date : new Date(day.date).toISOString().split('T')[0];
                return dayDateStr >= calculatedStartDate && dayDateStr <= calculatedEndDate;
              });
              
              if (filteredDailyData.length > 0) {
                // Recalculate summary from filtered daily data
                storedData = {
                  ...storedData,
                  period: {
                    start: calculatedStartDate,
                    end: calculatedEndDate,
                    days: daysNum
                  },
                  metrics: {
                    totalViews: filteredDailyData.reduce((sum, day) => sum + (day.views || 0), 0),
                    totalSearches: filteredDailyData.reduce((sum, day) => sum + (day.searches || 0), 0),
                    totalCalls: filteredDailyData.reduce((sum, day) => sum + (day.calls || 0), 0),
                    totalDirections: filteredDailyData.reduce((sum, day) => sum + (day.directions || 0), 0),
                    totalWebsiteClicks: filteredDailyData.reduce((sum, day) => sum + (day.websiteClicks || 0), 0)
                  },
                  dailyData: filteredDailyData
                };
              }
            }
          }
        }
      } else {
        // For 7 and 30 day requests, try exact date match first
        storedData = await GoogleBusinessInsights.findOne({
          customerId: customerId,
          'period.start': calculatedStartDate,
          'period.end': calculatedEndDate,
          'period.days': daysNum
        }).sort({ lastUpdated: -1 });
      }

      if (storedData) {
        // ✅ NEW: Check if stored data is fresh
        // For 90-day data, freshness check is already done above (24 hours)
        // For 7/30 day data, check freshness here (12 hours)
        if (daysNum !== 90) {
          // Safety check: ensure lastUpdated exists (should always exist due to model default)
          if (!storedData.lastUpdated) {
            console.log(`⚠️ Stored data missing lastUpdated timestamp - forcing fresh fetch`);
            storedData = null; // Force fresh API call
          } else {
            const dataAge = Date.now() - new Date(storedData.lastUpdated).getTime();
            const maxAge = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
            
            if (dataAge > maxAge) {
              const ageInHours = Math.round(dataAge / (60 * 60 * 1000));
              console.log(`⚠️ Stored data is ${ageInHours} hours old - forcing fresh fetch`);
              storedData = null; // Force fresh API call
            } else {
              const ageInHours = Math.round(dataAge / (60 * 60 * 1000));
              console.log(`✅ Using cached data (${ageInHours} hours old) for ${customer.name} (${days} days)`);
            }
          }
        }
        // For 90-day data, freshness check was already done above, so we skip this check
      }
      
      if (storedData) {
        // Return stored data with current timestamp
        const response = {
          businessProfileName: storedData.businessProfileName,
          period: storedData.period,
          summary: storedData.metrics,
          dailyData: storedData.dailyData,
          dataSource: 'stored',
          lastUpdated: storedData.lastUpdated
        };

        // Add comparison data if requested
        if (compare === 'true' && days) {
          const comparisonDays = parseInt(days);
          const comparisonTotalDays = comparisonDays + bufferDays;
          const comparisonStartDate = new Date(new Date(calculatedStartDate).getTime() - comparisonTotalDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const comparisonEndDate = new Date(new Date(calculatedStartDate).getTime() - bufferDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

          const comparisonData = await GoogleBusinessInsights.findOne({
            customerId: customerId,
            'period.start': comparisonStartDate,
            'period.end': comparisonEndDate,
            'period.days': comparisonDays
          }).sort({ lastUpdated: -1 });

          if (comparisonData) {
            const current = storedData.metrics;
            const previous = comparisonData.metrics;
            
            response.comparison = {
              totalViews: {
                current: current.totalViews,
                previous: previous.totalViews,
                change: current.totalViews - previous.totalViews,
                changePercent: previous.totalViews > 0 ? 
                  ((current.totalViews - previous.totalViews) / previous.totalViews * 100).toFixed(1) : 0
              },
              totalSearches: {
                current: current.totalSearches,
                previous: previous.totalSearches,
                change: current.totalSearches - previous.totalSearches,
                changePercent: previous.totalSearches > 0 ? 
                  ((current.totalSearches - previous.totalSearches) / previous.totalSearches * 100).toFixed(1) : 0
              },
              totalWebsiteClicks: {
                current: current.totalWebsiteClicks,
                previous: previous.totalWebsiteClicks,
                change: current.totalWebsiteClicks - previous.totalWebsiteClicks,
                changePercent: previous.totalWebsiteClicks > 0 ? 
                  ((current.totalWebsiteClicks - previous.totalWebsiteClicks) / previous.totalWebsiteClicks * 100).toFixed(1) : 0
              },
              totalCalls: {
                current: current.totalCalls,
                previous: previous.totalCalls,
                change: current.totalCalls - previous.totalCalls,
                changePercent: previous.totalCalls > 0 ? 
                  ((current.totalCalls - previous.totalCalls) / previous.totalCalls * 100).toFixed(1) : 0
              },
              totalDirections: {
                current: current.totalDirections,
                previous: previous.totalDirections,
                change: current.totalDirections - previous.totalDirections,
                changePercent: previous.totalDirections > 0 ? 
                  ((current.totalDirections - previous.totalDirections) / previous.totalDirections * 100).toFixed(1) : 0
              }
            };
          }
        }

        return res.json(response);
      }
    }

    // ✅ FIXED: Token validation and refresh logic
    const now = Date.now();
    const expiresAt = tokenExpiry ? new Date(tokenExpiry).getTime() : 0;
    const refreshThreshold = 5 * 60 * 1000; // Refresh 5 minutes before expiry

    // Log and validate the token we're about to use
    console.log('🔍 Token validation:', {
      usingAdminTokens,
      hasAccessToken: !!tokensToUse.access_token,
      hasRefreshToken: !!tokensToUse.refresh_token,
      expiresAt: tokenExpiry,
      expiresInMs: expiresAt - now,
      expiresInMinutes: expiresAt > 0 ? Math.floor((expiresAt - now) / (60 * 1000)) : 'unknown',
      needsRefresh: expiresAt > 0 && now > (expiresAt - refreshThreshold),
      hasExpiry: !!tokenExpiry,
      refreshThresholdMinutes: Math.floor(refreshThreshold / (60 * 1000))
    });

    // ✅ FIXED: Refresh tokens if they expire soon (whether customer or admin tokens)
    if (expiresAt > 0 && now > (expiresAt - refreshThreshold)) {
      console.log('🔄 Token expires soon, refreshing proactively...');
      
      if (!tokensToUse.refresh_token) {
        console.error('❌ No refresh token available');
        // If using admin tokens and they're expired, try to refresh admin tokens
        if (usingAdminTokens) {
          const adminUser = await User.findOne({ role: 'admin' });
          if (adminUser?.googleBusinessRefreshToken) {
            try {
              const refreshedTokens = await refreshGoogleBusinessToken(adminUser.googleBusinessRefreshToken);
              // Update admin tokens
              const newExpiry = refreshedTokens.expires_in 
                ? new Date(Date.now() + refreshedTokens.expires_in * 1000)
                : new Date(Date.now() + 3600 * 1000);
              
              await User.findByIdAndUpdate(adminUser._id, {
                googleBusinessAccessToken: refreshedTokens.access_token,
                googleBusinessTokenExpiry: newExpiry,
                googleBusinessRefreshToken: refreshedTokens.refresh_token || adminUser.googleBusinessRefreshToken
              });
              
              // Update tokens to use
              tokensToUse = {
                access_token: refreshedTokens.access_token,
                refresh_token: refreshedTokens.refresh_token || adminUser.googleBusinessRefreshToken
              };
              tokenExpiry = newExpiry;
              console.log('✅ Admin tokens refreshed, using for customer');
            } catch (refreshError) {
              console.error('❌ Admin token refresh failed:', refreshError.message);
              return res.status(401).json({ 
                error: 'Google Business Profile connection expired. Please ask your administrator to reconnect.',
                requiresReauth: true,
                details: 'Admin tokens expired. Admin needs to reconnect their account.'
              });
            }
          }
        } else {
          // ✅ FIXED: This branch means refresh_token is missing from tokensToUse
          // Since we always prefer admin tokens first, this should rarely happen
          // But if it does, we've already tried admin tokens above, so return error
          console.error('❌ No refresh token available in tokensToUse');
          console.error('   Using admin tokens:', usingAdminTokens);
          console.error('   Admin has refresh token:', !!(adminUser?.googleBusinessRefreshToken));
          console.error('   Customer has refresh token:', !!(customer.googleBusinessRefreshToken));
          
          // If we're using admin tokens but they don't have refresh token, admin needs to reconnect
          if (usingAdminTokens) {
            return res.status(401).json({ 
              error: 'Google Business Profile connection expired. Please ask your administrator to reconnect.',
              requiresReauth: true,
              details: 'Admin refresh token missing. Admin needs to reconnect their account.'
            });
          } else {
            // We're using customer tokens but they don't have refresh token
            // This shouldn't happen since we prefer admin tokens, but handle it gracefully
            await User.findByIdAndUpdate(customerId, {
              googleBusinessNeedsReauth: true
            });
            return res.status(401).json({ 
              error: 'Google Business Profile refresh token missing. Please ask your administrator to reconnect.',
              requiresReauth: true
            });
          }
        }
      } else {
        // We have a refresh token, try to refresh
        try {
          const refreshedTokens = await refreshGoogleBusinessToken(tokensToUse.refresh_token);
          
          console.log('🔍 Refresh credentials received:', {
            hasAccessToken: !!refreshedTokens.access_token,
            hasRefreshToken: !!refreshedTokens.refresh_token,
            expiresIn: refreshedTokens.expires_in
          });
          
          // Calculate new expiry
          const newExpiry = refreshedTokens.expires_in && !isNaN(Number(refreshedTokens.expires_in)) && refreshedTokens.expires_in > 0
            ? new Date(Date.now() + refreshedTokens.expires_in * 1000)
            : new Date(Date.now() + 3600 * 1000);
          
          // Update tokens to use
          tokensToUse = {
            access_token: refreshedTokens.access_token,
            refresh_token: refreshedTokens.refresh_token || tokensToUse.refresh_token
          };
          tokenExpiry = newExpiry;
          
          // Update database - if using customer tokens, update customer; if using admin, update admin
          if (usingAdminTokens) {
            const adminUser = await User.findOne({ role: 'admin' });
            if (adminUser) {
              await User.findByIdAndUpdate(adminUser._id, {
                googleBusinessAccessToken: refreshedTokens.access_token,
                googleBusinessTokenExpiry: newExpiry,
                googleBusinessRefreshToken: refreshedTokens.refresh_token || adminUser.googleBusinessRefreshToken
              });
            }
          } else {
            // Update customer tokens
            const updateData = {
              googleBusinessAccessToken: refreshedTokens.access_token,
              googleBusinessTokenExpiry: newExpiry,
              googleBusinessNeedsReauth: false
            };
            if (refreshedTokens.refresh_token) {
              updateData.googleBusinessRefreshToken = refreshedTokens.refresh_token;
            }
            await User.findByIdAndUpdate(customerId, updateData);
          }
          
          console.log('✅ Token refreshed successfully, new expiry:', newExpiry);
        } catch (refreshError) {
          console.error('❌ Token refresh failed:', refreshError.message);
          console.error('❌ Refresh error details:', refreshError.response?.data);
          
          // Handle invalid_grant (token expired/revoked)
          if (refreshError.response?.data?.error === 'invalid_grant' || 
              refreshError.message?.includes('invalid_grant')) {
            // If using admin tokens, admin needs to reconnect
            if (usingAdminTokens) {
              return res.status(401).json({ 
                error: 'Google Business Profile connection expired. Please ask your administrator to reconnect their account.',
                requiresReauth: true,
                details: 'Admin tokens expired. Admin needs to reconnect.'
              });
            }
            
            // Mark customer as needing re-auth
            await User.findByIdAndUpdate(customerId, {
              googleBusinessNeedsReauth: true
            });
            
            return res.status(401).json({ 
              error: 'Google Business Profile connection expired. Please ask your administrator to reconnect your Google Business Profile.',
              requiresReauth: true,
              details: 'Refresh token expired or revoked. Admin needs to re-assign the profile.'
            });
          }
          
          return res.status(401).json({ 
            error: 'Google Business Profile token refresh failed. Please ask your administrator to reconnect.',
            details: refreshError.response?.data?.error_description || refreshError.message 
          });
        }
      }
    }
    
    // ✅ FIXED: Clear reauth flag if tokens exist and are valid
    if (customer.googleBusinessNeedsReauth && tokensToUse.access_token && tokensToUse.refresh_token) {
      console.log(`⚠️ Customer ${customerId} has reauth flag set but tokens are valid - clearing flag`);
      await User.findByIdAndUpdate(customerId, {
        googleBusinessNeedsReauth: false
      });
    }
    
    // Set up OAuth client with tokens (customer or admin)
    oauth2Client.setCredentials({
      access_token: tokensToUse.access_token,
      refresh_token: tokensToUse.refresh_token
    });

    // Use Business Profile Performance API (recommended by ChatGPT)
    const performance = google.businessprofileperformance({ version: 'v1', auth: oauth2Client });

    // ✅ FIXED: Get access token and location name early (before they're used)
    // Get the current access token (might have been refreshed)
    const currentCredentials = oauth2Client.credentials;
    let accessToken = currentCredentials.access_token || customer.googleBusinessAccessToken;
    
    // ✅ FIXED: Define locationName early (before comparison fetch)
    const locationId = customer.googleBusinessProfileId;
    const locationName = `locations/${locationId}`;

    // Set date range with support for dynamic ranges and comparisons
    const today = new Date();
    const bufferDays = 2; // ✅ FIXED: Reduced from 3 to 2 days (Google data is typically 1-2 days behind, not 3)
    
    let endDate, startDate, comparisonData = null;
    
    if (start && end) {
      // Custom date range - apply 2-day buffer to end date to match Google's data freshness
      const endDateObj = new Date(end + 'T00:00:00Z');
      const bufferEndDate = new Date(endDateObj.getTime() - 2 * 24 * 60 * 60 * 1000);
      
      startDate = start;
      endDate = bufferEndDate.toISOString().split('T')[0];
      
      console.log(`📅 Custom date range requested: ${start} to ${end}`);
      console.log(`📅 Applied 2-day buffer: ${startDate} to ${endDate}`);
    } else if (days) {
      // Dynamic range (7, 30, 90 days) - FIXED: Calculate start date first, then end date
      const daysNum = parseInt(days);
      const totalDays = daysNum + bufferDays; // Total days including buffer
      startDate = new Date(today.getTime() - totalDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      endDate = new Date(today.getTime() - bufferDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    } else {
      // Default to last 30 days - FIXED: Calculate start date first, then end date
      const totalDays = 30 + bufferDays; // Total days including buffer
      startDate = new Date(today.getTime() - totalDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      endDate = new Date(today.getTime() - bufferDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
    
    // Handle comparison if requested
    if (compare === 'true' && days) {
      const daysNum = parseInt(days);
      const totalDays = daysNum + bufferDays; // Total days including buffer
      const comparisonStartDate = new Date(new Date(startDate).getTime() - totalDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const comparisonEndDate = new Date(new Date(startDate).getTime() - bufferDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      console.log(`🔍 Fetching comparison data: ${comparisonStartDate} to ${comparisonEndDate}`);
      
      // Fetch comparison data
      try {
        const comparisonInsights = await fetchBusinessInsightsData(
          oauth2Client, 
          locationName, 
          comparisonStartDate, 
          comparisonEndDate, 
          accessToken
        );
        
        if (comparisonInsights) {
          comparisonData = {
            period: { start: comparisonStartDate, end: comparisonEndDate },
            summary: summarizeMulti_v1(comparisonInsights)
          };
          console.log('🔍 Comparison data fetched:', comparisonData.summary);
        }
      } catch (comparisonError) {
        console.error('❌ Failed to fetch comparison data:', comparisonError.message);
        // Don't fail the main request if comparison fails
      }
    }

    // Defensive request guards - reject invalid date ranges
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ 
        error: 'Invalid date range: start date cannot be after end date',
        details: { startDate, endDate, originalStart: start, originalEnd: end }
      });
    }
    
    // ✅ FIXED: Validate that custom date range end date is not in the future
    if (start && end) {
      const requestedEnd = new Date(end + 'T00:00:00Z');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (requestedEnd > today) {
        console.log(`⚠️ Custom end date ${end} is in the future, adjusted to ${endDate} (2-day buffer)`);
      }
    }

    // Convert dates to the format expected by the API
    const startDateObj = {
      year: parseInt(startDate.split('-')[0]),
      month: parseInt(startDate.split('-')[1]),
      day: parseInt(startDate.split('-')[2])
    };
    const endDateObj = {
      year: parseInt(endDate.split('-')[0]),
      month: parseInt(endDate.split('-')[1]),
      day: parseInt(endDate.split('-')[2])
    };

    // Validate date objects
    if (isNaN(startDateObj.year) || isNaN(startDateObj.month) || isNaN(startDateObj.day) ||
        isNaN(endDateObj.year) || isNaN(endDateObj.month) || isNaN(endDateObj.day)) {
      return res.status(400).json({ 
        error: 'Invalid date format',
        details: { startDateObj, endDateObj }
      });
    }

    console.log(`Fetching insights for location: ${locationName}`);
    console.log(`Date range: ${startDate} to ${endDate}`);
    console.log(`Start date object:`, startDateObj);
    console.log(`End date object:`, endDateObj);
    
    // Log if this is a custom date range
    const isCustomRange = !!(start && end);
    console.log(`📅 Range type: ${isCustomRange ? 'CUSTOM' : 'STANDARD'} (${days} days)`);
    
    // First try a simple single metric test to isolate the issue
    console.log('🧪 Testing single metric first...');
    try {
      const testResponse = await axios.get(
        `https://businessprofileperformance.googleapis.com/v1/${locationName}:getDailyMetricsTimeSeries`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          params: new URLSearchParams({
            'dailyMetric': 'WEBSITE_CLICKS',
            'dailyRange.start_date.year': startDateObj.year,
            'dailyRange.start_date.month': startDateObj.month,
            'dailyRange.start_date.day': startDateObj.day,
            'dailyRange.end_date.year': endDateObj.year,
            'dailyRange.end_date.month': endDateObj.month,
            'dailyRange.end_date.day': endDateObj.day
          }),
          paramsSerializer: p => p.toString()
        }
      );
      
      const testData = testResponse.data;
      const testPoints = testData?.timeSeries?.datedValues || [];
      const testTotal = testPoints.reduce((sum, p) => sum + Number(p.value || 0), 0);
      console.log('🧪 Single metric test - points:', testPoints.length, 'total:', testTotal);
      console.log('🧪 Single metric response:', JSON.stringify(testData, null, 2));
    } catch (testError) {
      console.error('🧪 Single metric test failed:', testError.response?.data);
      // Don't fail the main request if test fails - just log and continue
    }

    // ✅ FIXED: Update access token in case it was refreshed during test call
    const updatedCredentials = oauth2Client.credentials;
    accessToken = updatedCredentials.access_token || accessToken;

    // Fetch main insights data using helper function
    const insights = await fetchBusinessInsightsData(oauth2Client, locationName, startDate, endDate, accessToken);
    console.log('🔍 Raw API Response:', JSON.stringify(insights, null, 2));
    
    // Debug parsing with bullet-proof function - FIXED for correct schema
    function summarizeMulti_v1(data) {
      const groups = Array.isArray(data?.multiDailyMetricTimeSeries)
        ? data.multiDailyMetricTimeSeries
        : [];

      console.log('🔍 Groups count:', groups.length);
      
      const flat = groups.flatMap(g => g?.dailyMetricTimeSeries ?? []);
      console.log('🔍 Flattened metrics count:', flat.length);
      
      const byMetric = {};

      for (const m of flat) {
        const metric = m?.dailyMetric;
        if (!metric) continue;
        
        console.log(`🔍 Processing metric: ${metric}`);
        
        const values = m?.timeSeries?.datedValues ?? [];
        console.log(`🔍 Values count for ${metric}:`, values.length);
        
        const total = values.reduce((s, p) => s + Number(p?.value ?? 0), 0);
        byMetric[metric] = { days: values.length, total, points: values };
        
        console.log(`🔍 Total for ${metric}:`, total);
      }

      const get = k => byMetric[k]?.total ?? 0;
      return {
        totalViews:
          get('BUSINESS_IMPRESSIONS_DESKTOP_SEARCH') +
          get('BUSINESS_IMPRESSIONS_MOBILE_SEARCH') +
          get('BUSINESS_IMPRESSIONS_DESKTOP_MAPS') +
          get('BUSINESS_IMPRESSIONS_MOBILE_MAPS'),
        totalSearches:
          get('BUSINESS_IMPRESSIONS_DESKTOP_SEARCH') +
          get('BUSINESS_IMPRESSIONS_MOBILE_SEARCH'),
        totalWebsiteClicks: get('WEBSITE_CLICKS'),
        totalCalls: get('CALL_CLICKS'),
        totalDirections: get('BUSINESS_DIRECTION_REQUESTS')
      };
    }
    
    const portalTotals = summarizeMulti_v1(insights);
    console.log('🔍 Portal Totals (Summary):', {
      totalViews: portalTotals.totalViews,
      totalSearches: portalTotals.totalSearches,
      totalCalls: portalTotals.totalCalls,
      totalDirections: portalTotals.totalDirections,
      totalWebsiteClicks: portalTotals.totalWebsiteClicks
    });
    
    // Calculate comparison metrics if comparison data is available
    let comparisonMetrics = null;
    if (comparisonData) {
      const current = portalTotals;
      const previous = comparisonData.summary;
      
      comparisonMetrics = {
        totalViews: {
          current: current.totalViews,
          previous: previous.totalViews,
          change: current.totalViews - previous.totalViews,
          changePercent: previous.totalViews > 0 ? 
            ((current.totalViews - previous.totalViews) / previous.totalViews * 100).toFixed(1) : 0
        },
        totalSearches: {
          current: current.totalSearches,
          previous: previous.totalSearches,
          change: current.totalSearches - previous.totalSearches,
          changePercent: previous.totalSearches > 0 ? 
            ((current.totalSearches - previous.totalSearches) / previous.totalSearches * 100).toFixed(1) : 0
        },
        totalWebsiteClicks: {
          current: current.totalWebsiteClicks,
          previous: previous.totalWebsiteClicks,
          change: current.totalWebsiteClicks - previous.totalWebsiteClicks,
          changePercent: previous.totalWebsiteClicks > 0 ? 
            ((current.totalWebsiteClicks - previous.totalWebsiteClicks) / previous.totalWebsiteClicks * 100).toFixed(1) : 0
        },
        totalCalls: {
          current: current.totalCalls,
          previous: previous.totalCalls,
          change: current.totalCalls - previous.totalCalls,
          changePercent: previous.totalCalls > 0 ? 
            ((current.totalCalls - previous.totalCalls) / previous.totalCalls * 100).toFixed(1) : 0
        },
        totalDirections: {
          current: current.totalDirections,
          previous: previous.totalDirections,
          change: current.totalDirections - previous.totalDirections,
          changePercent: previous.totalDirections > 0 ? 
            ((current.totalDirections - previous.totalDirections) / previous.totalDirections * 100).toFixed(1) : 0
        }
      };
    }

    const processedData = {
      businessProfileName: customer.googleBusinessProfileName,
      period: { start: startDate, end: endDate },
      summary: portalTotals,
      comparison: comparisonMetrics,
      dailyData: []
    };

    // Process metric data from the correct API format (multiDailyMetricTimeSeries[].dailyMetricTimeSeries[])
    if (insights.multiDailyMetricTimeSeries) {
      // Flatten the nested structure
      const flatMetrics = insights.multiDailyMetricTimeSeries.flatMap(group => 
        group?.dailyMetricTimeSeries ?? []
      );
      
      flatMetrics.forEach(metricSeries => {
        const metric = metricSeries.dailyMetric;
        const timeSeries = metricSeries.timeSeries;
        const dailyValues = timeSeries?.datedValues || [];

        dailyValues.forEach(dailyValue => {
          const date = `${dailyValue.date.year}-${String(dailyValue.date.month).padStart(2, '0')}-${String(dailyValue.date.day).padStart(2, '0')}`;
          
          if (!processedData.dailyData.find(d => d.date === date)) {
            processedData.dailyData.push({
              date,
              views: 0,
              searches: 0,
              calls: 0,
              directions: 0,
              websiteClicks: 0
              // Removed conversations - deprecated by Google
            });
          }

          const dailyData = processedData.dailyData.find(d => d.date === date);
          // Handle missing value field - if no value field, it means 0
          const value = dailyValue.value !== undefined ? Number(dailyValue.value) : 0;
          
          switch (metric) {
            case 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH':
            case 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH':
              dailyData.searches += value;
              // DON'T add to summary - we already calculated it in summarizeMulti_v1
              break;
            case 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS':
            case 'BUSINESS_IMPRESSIONS_MOBILE_MAPS':
              dailyData.views += value;
              // DON'T add to summary - we already calculated it in summarizeMulti_v1
              break;
            case 'CALL_CLICKS':
              dailyData.calls += value;
              // DON'T add to summary - we already calculated it in summarizeMulti_v1
              break;
            case 'BUSINESS_DIRECTION_REQUESTS':
              dailyData.directions += value;
              // DON'T add to summary - we already calculated it in summarizeMulti_v1
              break;
            case 'WEBSITE_CLICKS':
              dailyData.websiteClicks += value;
              // DON'T add to summary - we already calculated it in summarizeMulti_v1
              break;
            // Removed BUSINESS_CONVERSATIONS - deprecated by Google
          }
        });
      });
    }

    // ✅ FIXED: Filter daily data to only include dates within the requested range
    // The API might return data outside the requested range, so we need to filter it
    // Use explicit date comparison to ensure accuracy (handles YYYY-MM-DD string format correctly)
    processedData.dailyData = processedData.dailyData.filter(day => {
      const dayDate = day.date;
      // Ensure date is in YYYY-MM-DD format for string comparison (works correctly for ISO dates)
      if (!dayDate || typeof dayDate !== 'string') return false;
      // String comparison works for YYYY-MM-DD format, but be explicit about boundaries
      return dayDate >= startDate && dayDate <= endDate;
    });

    // Sort daily data by date
    processedData.dailyData.sort((a, b) => new Date(a.date) - new Date(b.date));

    // ✅ FIXED: Recalculate summary totals from filtered daily data to ensure accuracy
    // This ensures the summary matches the filtered daily data exactly
    const recalculatedSummary = {
      totalViews: processedData.dailyData.reduce((sum, day) => sum + (day.views || 0), 0),
      totalSearches: processedData.dailyData.reduce((sum, day) => sum + (day.searches || 0), 0),
      totalCalls: processedData.dailyData.reduce((sum, day) => sum + (day.calls || 0), 0),
      totalDirections: processedData.dailyData.reduce((sum, day) => sum + (day.directions || 0), 0),
      totalWebsiteClicks: processedData.dailyData.reduce((sum, day) => sum + (day.websiteClicks || 0), 0)
    };
    
    // Update summary with recalculated values
    processedData.summary = recalculatedSummary;

    // Verify day-by-day breakdown is correct
    console.log(`✅ Processed insights: ${processedData.dailyData.length} days of data (filtered to ${startDate} to ${endDate})`);
    console.log(`📅 Date range: ${startDate} to ${endDate}`);
    console.log('📊 Summary totals:', {
      totalViews: processedData.summary.totalViews,
      totalSearches: processedData.summary.totalSearches,
      totalCalls: processedData.summary.totalCalls,
      totalDirections: processedData.summary.totalDirections,
      totalWebsiteClicks: processedData.summary.totalWebsiteClicks
    });
    
    // Verify daily data totals match summary
    const dailyTotals = {
      views: processedData.dailyData.reduce((sum, day) => sum + (day.views || 0), 0),
      searches: processedData.dailyData.reduce((sum, day) => sum + (day.searches || 0), 0),
      calls: processedData.dailyData.reduce((sum, day) => sum + (day.calls || 0), 0),
      directions: processedData.dailyData.reduce((sum, day) => sum + (day.directions || 0), 0),
      websiteClicks: processedData.dailyData.reduce((sum, day) => sum + (day.websiteClicks || 0), 0)
    };
    
    console.log('🔍 Daily data totals (should match summary):', dailyTotals);
    
    // Log sample daily data for verification
    if (processedData.dailyData.length > 0) {
      console.log('📋 Sample daily data (first 5 days):', processedData.dailyData.slice(0, 5));
      console.log('📋 Sample daily data (last 5 days):', processedData.dailyData.slice(-5));
    }

    res.json(processedData);
  } catch (error) {
    console.error('❌ Business insights fetch error:', error);
    console.error('❌ HTTP Status:', error.response?.status, error.response?.statusText);
    console.error('❌ Error Payload:', error.response?.data);
    console.error('❌ Request Details:', {
      url: error.config?.url,
      method: error.config?.method,
      params: error.config?.params,
      headers: error.config?.headers
    });
    
    // ✅ FIXED: Ensure customer is available in catch block - refetch if needed
    // Only refetch if customer wasn't already fetched or if we need fresh data
    if (!customer) {
      try {
        customer = await User.findById(req.params.customerId);
      } catch (fetchError) {
        console.error('❌ Failed to fetch customer in error handler:', fetchError.message);
      }
    }
    
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      customerId: req.params.customerId,
      locationId: customer?.googleBusinessProfileId || 'customer_not_found'
    });
    
    // ✅ FIXED: Handle authentication errors (401/403) - token might be expired
    // If we get a 401/403, try to refresh the token one more time
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log('🔄 API call returned 401/403 - token may be expired, attempting refresh...');
      
      // Only try refresh if we have a refresh token and haven't already tried
      // Refetch customer to ensure we have latest token state
      if (!customer) {
        try {
          customer = await User.findById(req.params.customerId);
        } catch (fetchError) {
          console.error('❌ Failed to fetch customer for token refresh:', fetchError.message);
        }
      }
      
      if (customer?.googleBusinessRefreshToken && !error._refreshAttempted) {
        try {
          const refreshedTokens = await refreshGoogleBusinessToken(customer.googleBusinessRefreshToken);
          
          // Update customer with new tokens
          let newExpiry = null;
          if (refreshedTokens.expires_in && !isNaN(Number(refreshedTokens.expires_in)) && refreshedTokens.expires_in > 0) {
            newExpiry = new Date(Date.now() + refreshedTokens.expires_in * 1000);
          } else {
            newExpiry = new Date(Date.now() + 3600 * 1000);
          }
          
          await User.findByIdAndUpdate(customerId, {
            googleBusinessAccessToken: refreshedTokens.access_token,
            googleBusinessTokenExpiry: newExpiry,
            googleBusinessRefreshToken: refreshedTokens.refresh_token || customer.googleBusinessRefreshToken,
            googleBusinessNeedsReauth: false
          });
          
          console.log('✅ Token refreshed after API 401 error, retrying request...');
          
          // Retry the request with new token (but only once to avoid infinite loop)
          error._refreshAttempted = true;
          // Note: We don't retry here automatically to avoid complexity
          // Instead, return a clear error message asking user to retry
          return res.status(401).json({ 
            error: 'Google Business Profile token expired. Please refresh the page to retry.',
            requiresReauth: false,
            details: 'Token was refreshed, please try again.'
          });
        } catch (refreshError) {
          console.error('❌ Token refresh failed after API 401 error:', refreshError.message);
          
          // Mark as needing reauth if refresh token is invalid
          if (refreshError.response?.data?.error === 'invalid_grant' || 
              refreshError.message?.includes('invalid_grant')) {
            await User.findByIdAndUpdate(customerId, {
              googleBusinessNeedsReauth: true
            });
            
            return res.status(401).json({ 
              error: 'Google Business Profile connection expired. Please ask your administrator to reconnect your Google Business Profile.',
              requiresReauth: true,
              details: 'Refresh token expired or revoked. Admin needs to re-assign the profile.'
            });
          }
          
          return res.status(401).json({ 
            error: 'Google Business Profile token refresh failed. Please ask your administrator to reconnect.',
            requiresReauth: true,
            details: refreshError.response?.data?.error_description || refreshError.message
          });
        }
      } else if (customer?.googleBusinessNeedsReauth && !customer?.googleBusinessProfileId) {
        // Only return error if profileId is missing - if profileId exists, we can still use admin tokens
        return res.status(401).json({ 
          error: 'Google Business Profile connection expired. Please ask your administrator to reconnect your Google Business Profile.',
          requiresReauth: true,
          details: 'Your Google Business Profile tokens have expired. Admin needs to re-assign the profile.'
        });
      }
    }
    
    // Log to Google Cloud Console format for debugging
    // ✅ FIXED: Define metrics array for error logging
    const errorMetrics = [
      'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
      'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
      'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
      'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
      'WEBSITE_CLICKS',
      'CALL_CLICKS',
      'BUSINESS_DIRECTION_REQUESTS'
    ];
    
    console.error('🔍 Cloud Console Debug Info:', {
      serviceName: 'businessprofileperformance.googleapis.com',
      method: 'fetchMultiDailyMetricsTimeSeries',
      statusCode: error.response?.status,
      errorMessage: error.response?.data?.error?.message,
      requestParams: {
        locationId: customer?.googleBusinessProfileId,
        metrics: errorMetrics,
        dateRange: { start: startDateObj, end: endDateObj }
      }
    });
    
    // Return appropriate error based on status code
    if (error.response?.status === 401 || error.response?.status === 403) {
      return res.status(401).json({ 
        error: 'Google Business Profile authentication failed. Please ask your administrator to reconnect.',
        requiresReauth: true,
        details: error.response?.data?.error?.message || error.message
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch business insights',
      details: error.message 
    });
  }
});

// PATCH /api/google-business/disconnect/:customerId - Disconnect business profile
router.patch('/disconnect/:customerId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { customerId } = req.params;

    await User.findByIdAndUpdate(customerId, {
      googleBusinessProfileId: null,
      googleBusinessProfileName: null,
      googleBusinessAccessToken: null,
      googleBusinessRefreshToken: null,
      googleBusinessTokenExpiry: null,
      googleBusinessNeedsReauth: false // Clear reauth flag when disconnecting
    });

    res.json({ success: true, message: 'Google Business Profile disconnected' });
  } catch (error) {
    console.error('Disconnect business profile error:', error);
    res.status(500).json({ error: 'Failed to disconnect business profile' });
  }
});

// GET /api/google-business/group-insights - Get insights for all locations in the group
router.get('/group-insights', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    // ✅ FIXED: Get admin tokens from database first (with fallback to header/env)
    let adminTokens;
    let adminUser = await User.findOne({ role: 'admin' });
    
    // Priority 1: Database (most reliable, persistent)
    if (adminUser?.googleBusinessAccessToken && adminUser?.googleBusinessRefreshToken) {
      adminTokens = {
        access_token: adminUser.googleBusinessAccessToken,
        refresh_token: adminUser.googleBusinessRefreshToken
      };
      console.log('[Google Business] Using admin tokens from database (group-insights)');
    } 
    // Priority 2: Header (from frontend, temporary)
    else if (req.headers['x-admin-tokens']) {
      adminTokens = JSON.parse(req.headers['x-admin-tokens']);
      console.log('[Google Business] Using admin tokens from header (group-insights)');
    } 
    // Priority 3: Environment variables (fallback)
    else {
      adminTokens = {
        access_token: process.env.GOOGLE_BUSINESS_ADMIN_ACCESS_TOKEN,
        refresh_token: process.env.GOOGLE_BUSINESS_ADMIN_REFRESH_TOKEN
      };
      console.log('[Google Business] Using admin tokens from environment variables (group-insights)');
    }

    if (!adminTokens.access_token) {
      return res.status(400).json({ error: 'Admin Google Business Profile not connected. Please connect first.' });
    }

    // ✅ FIXED: Check if token needs refresh and refresh if needed
    if (adminUser) {
      const now = Date.now();
      const expiresAt = adminUser.googleBusinessTokenExpiry ? new Date(adminUser.googleBusinessTokenExpiry).getTime() : 0;
      const refreshThreshold = 5 * 60 * 1000; // Refresh 5 minutes before expiry
      
      if (expiresAt > 0 && now > (expiresAt - refreshThreshold)) {
        console.log('[Google Business] Admin token expires soon, refreshing proactively (group-insights)...');
        
        if (!adminUser.googleBusinessRefreshToken) {
          return res.status(401).json({ 
            error: 'Admin Google Business Profile refresh token missing. Please reconnect.',
            requiresReauth: true
          });
        }
        
        try {
          const refreshedTokens = await refreshGoogleBusinessToken(adminUser.googleBusinessRefreshToken);
          
          // Calculate new expiry
          let newExpiry = null;
          if (refreshedTokens.expires_in && !isNaN(Number(refreshedTokens.expires_in)) && refreshedTokens.expires_in > 0) {
            newExpiry = new Date(Date.now() + refreshedTokens.expires_in * 1000);
          } else {
            newExpiry = new Date(Date.now() + 3600 * 1000);
          }
          
          const updateData = {
            googleBusinessAccessToken: refreshedTokens.access_token,
            googleBusinessTokenExpiry: newExpiry
          };
          
          if (refreshedTokens.refresh_token) {
            updateData.googleBusinessRefreshToken = refreshedTokens.refresh_token;
          }
          
          await User.findByIdAndUpdate(adminUser._id, updateData);
          
          // Update tokens for this request
          adminTokens.access_token = refreshedTokens.access_token;
          if (refreshedTokens.refresh_token) {
            adminTokens.refresh_token = refreshedTokens.refresh_token;
          }
          
          console.log('[Google Business] ✅ Admin token refreshed successfully (group-insights)');
        } catch (refreshError) {
          console.error('[Google Business] ❌ Admin token refresh failed (group-insights):', refreshError.message);
          
          if (refreshError.response?.data?.error === 'invalid_grant' || 
              refreshError.message?.includes('invalid_grant')) {
            return res.status(401).json({ 
              error: 'Admin Google Business Profile refresh token expired. Please reconnect.',
              requiresReauth: true,
              details: 'Token has been expired or revoked. Click "Reconnect" to authorize again.'
            });
          }
          
          // Continue with existing token if refresh fails (might still work)
        }
      }
    }

    // Set up OAuth client with admin tokens
    oauth2Client.setCredentials(adminTokens);

    // First, get all locations from the group
    const accountManagement = google.mybusinessaccountmanagement({ version: 'v1', auth: oauth2Client });
    const accountsResponse = await accountManagement.accounts.list();
    const accounts = accountsResponse.data.accounts || [];

    // Find the group account
    const groupAccount = accounts.find(acc => 
      acc.type === 'LOCATION_GROUP' && 
      (acc.accountName === 'CliniMedia' || acc.displayName === 'CliniMedia')
    );

    if (!groupAccount) {
      return res.status(400).json({ error: 'CliniMedia group not found' });
    }

    // Get all locations
    const mybusiness = google.mybusinessbusinessinformation({ version: 'v1', auth: oauth2Client });
    const locationsResponse = await mybusiness.accounts.locations.list({
      parent: groupAccount.name,
      pageSize: 100,
      readMask: 'name,title'
    });
    
    const locations = locationsResponse.data.locations || [];
    console.log(`Fetching insights for ${locations.length} locations`);

    // Set up Performance API
    const performance = google.businessprofileperformance({ version: 'v1', auth: oauth2Client });

    // Helper function to convert date to Google format
    const toGoogleDate = (date) => ({
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate()
    });

    // Calculate date range with buffer (Google data is 2 days behind)
    const bufferDays = 2; // ✅ FIXED: Apply buffer to group-insights endpoint
    const endDate = new Date();
    endDate.setUTCDate(endDate.getUTCDate() - bufferDays); // End date is 2 days ago
    const startDate = new Date();
    startDate.setUTCDate(endDate.getUTCDate() - (parseInt(days) - 1)); // Start date is (days-1) before end date

    const timeRange = {
      startDate: toGoogleDate(startDate),
      endDate: toGoogleDate(endDate)
    };

    // Metrics to fetch - safe metric set (no deprecated metrics)
    const METRICS = [
      'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
      'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
      'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
      'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
      'WEBSITE_CLICKS',
      'CALL_CLICKS',
      'BUSINESS_DIRECTION_REQUESTS'
      // Removed BUSINESS_CONVERSATIONS - deprecated by Google
    ];

    // Fetch insights for each location with rate limiting
    const results = [];
    const concurrency = 2; // Process 2 locations at a time
    const queue = [...locations];
    
    const workers = Array.from({ length: concurrency }).map(async () => {
      while (queue.length) {
        const location = queue.shift();
        const locationId = location.name.split('/')[1];
        
        try {
          console.log(`Fetching insights for ${location.title} (${locationId})`);
          
          // Use raw HTTP request for Business Profile Performance API with proper parameter serialization
          // Build query parameters without [] brackets using URLSearchParams
          const params = new URLSearchParams();
          
          // Add metrics as repeated parameters (no [] brackets)
          METRICS.forEach(metric => params.append('dailyMetrics', metric));
          
          // Add date range parameters
          params.append('dailyRange.start_date.year', timeRange.startDate.year);
          params.append('dailyRange.start_date.month', timeRange.startDate.month);
          params.append('dailyRange.start_date.day', timeRange.startDate.day);
          params.append('dailyRange.end_date.year', timeRange.endDate.year);
          params.append('dailyRange.end_date.month', timeRange.endDate.month);
          params.append('dailyRange.end_date.day', timeRange.endDate.day);
          
          const insightsResponse = await axios.get(
            `https://businessprofileperformance.googleapis.com/v1/locations/${locationId}:fetchMultiDailyMetricsTimeSeries`,
            {
              headers: {
                'Authorization': `Bearer ${adminTokens.access_token}`
              },
              params,
              paramsSerializer: p => p.toString() // Ensure no [] brackets are added
            }
          );

          // Process the insights data using correct schema parsing
          const processedInsights = {
            locationId,
            locationName: location.title,
            period: {
              start: startDate.toISOString().split('T')[0],
              end: endDate.toISOString().split('T')[0]
            },
            summary: {
              totalViews: 0,
              totalSearches: 0,
              totalCalls: 0,
              totalDirections: 0,
              totalWebsiteClicks: 0
            },
            dailyData: []
          };

          // Process metric data using correct schema (multiDailyMetricTimeSeries[].dailyMetricTimeSeries[])
          if (insightsResponse.data.multiDailyMetricTimeSeries) {
            // Flatten the nested structure
            const flatMetrics = insightsResponse.data.multiDailyMetricTimeSeries.flatMap(group => 
              group?.dailyMetricTimeSeries ?? []
            );
            
            flatMetrics.forEach(metricSeries => {
              const metric = metricSeries.dailyMetric;
              const timeSeries = metricSeries.timeSeries;
              const dailyValues = timeSeries?.datedValues || [];

              dailyValues.forEach(dailyValue => {
                const date = `${dailyValue.date.year}-${String(dailyValue.date.month).padStart(2, '0')}-${String(dailyValue.date.day).padStart(2, '0')}`;
                
                if (!processedInsights.dailyData.find(d => d.date === date)) {
                  processedInsights.dailyData.push({
                    date,
                    views: 0,
                    searches: 0,
                    calls: 0,
                    directions: 0,
                    websiteClicks: 0
                  });
                }

                const dailyData = processedInsights.dailyData.find(d => d.date === date);
                // Handle missing value field - if no value field, it means 0
                const value = dailyValue.value !== undefined ? Number(dailyValue.value) : 0;
                
                switch (metric) {
                  case 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH':
                  case 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH':
                    dailyData.searches += value;
                    processedInsights.summary.totalSearches += value;
                    break;
                  case 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS':
                  case 'BUSINESS_IMPRESSIONS_MOBILE_MAPS':
                    dailyData.views += value;
                    processedInsights.summary.totalViews += value;
                    break;
                  case 'CALL_CLICKS':
                    dailyData.calls += value;
                    processedInsights.summary.totalCalls += value;
                    break;
                  case 'BUSINESS_DIRECTION_REQUESTS':
                    dailyData.directions += value;
                    processedInsights.summary.totalDirections += value;
                    break;
                  case 'WEBSITE_CLICKS':
                    dailyData.websiteClicks += value;
                    processedInsights.summary.totalWebsiteClicks += value;
                    break;
                }
              });
            });
          }

          // Sort daily data by date
          processedInsights.dailyData.sort((a, b) => new Date(a.date) - new Date(b.date));

          results.push(processedInsights);
          console.log(`✅ Insights fetched for ${location.title}`);
          
        } catch (error) {
          console.error(`❌ Failed to fetch insights for ${location.title}:`, error.message);
          results.push({
            locationId,
            locationName: location.title,
            error: true,
            errorMessage: error.message
          });
        }
      }
    });

    await Promise.all(workers);

    console.log(`📊 Insights fetch complete: ${results.length} locations processed`);
    
    res.json({
      success: true,
      period: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        days: parseInt(days)
      },
      locations: results,
      summary: {
        totalLocations: results.length,
        successfulFetches: results.filter(r => !r.error).length,
        failedFetches: results.filter(r => r.error).length
      }
    });

  } catch (error) {
    console.error('Group insights fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch group insights',
      details: error.message 
    });
  }
});

// ✅ NEW: Manual refresh endpoints for admin
// POST /api/google-business/manual-refresh/:customerId - Refresh single customer
router.post('/manual-refresh/:customerId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const customerId = req.params.customerId;
    
    console.log(`🔄 Manual refresh triggered by admin for customer: ${customerId}`);
    
    // Delete ALL old stored data for this customer
    const deleteResult = await GoogleBusinessInsights.deleteMany({ 
      customerId: new mongoose.Types.ObjectId(customerId)
    });
    console.log(`🗑️ Deleted ${deleteResult.deletedCount} old records`);
    
    // Trigger immediate refresh for this specific customer
    const customer = await User.findById(customerId);
    if (!customer || !customer.googleBusinessProfileId) {
      return res.status(404).json({ 
        success: false, 
        error: 'Customer not found or no Google Business Profile connected' 
      });
    }
    
    // Run refresh for this customer only
    await GoogleBusinessDataRefreshService.refreshSingleCustomer(customer);
    
    res.json({ 
      success: true, 
      message: `Data refresh completed for ${customer.name || customer.email}`,
      deletedRecords: deleteResult.deletedCount
    });
  } catch (error) {
    console.error('❌ Manual refresh error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/google-business/manual-refresh-all - Refresh all customers
router.post('/manual-refresh-all', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    console.log(`🔄 Manual refresh triggered by admin for ALL customers`);
    
    await GoogleBusinessDataRefreshService.refreshAllBusinessProfiles();
    
    res.json({ 
      success: true, 
      message: 'Data refresh triggered for all customers'
    });
  } catch (error) {
    console.error('❌ Manual refresh all error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;
