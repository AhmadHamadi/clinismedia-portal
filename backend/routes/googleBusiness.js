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
  const axios = require('axios');
  
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

// OAuth 2.0 configuration
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
// Ensure redirect URI is properly set - must match Google Cloud Console configuration
const redirectUri = process.env.GOOGLE_BUSINESS_REDIRECT_URI || `${backendUrl}/api/google-business/callback`;

console.log('🔧 Google Business OAuth Configuration:', {
  backendUrl,
  redirectUri,
  hasClientId: !!process.env.GOOGLE_BUSINESS_CLIENT_ID,
  hasClientSecret: !!process.env.GOOGLE_BUSINESS_CLIENT_SECRET,
  railwayDomain: process.env.RAILWAY_PUBLIC_DOMAIN
});

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_BUSINESS_CLIENT_ID,
  process.env.GOOGLE_BUSINESS_CLIENT_SECRET,
  redirectUri
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
    
    // Use the same redirect URI logic
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state: 'admin', // Use 'admin' as state for admin OAuth
      prompt: 'consent', // Force consent screen to get refresh token
      redirect_uri: redirectUri
    });

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
    
    // Use the same redirect URI logic as admin auth
    const authUrl = oauth2Client.generateAuthUrl({
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

// GET /api/google-business/callback - Handle OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing authorization code or state' });
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // If this is admin OAuth, store tokens in environment or database
    if (state === 'admin') {
      // For now, we'll redirect with tokens in URL
      // In production, you might want to store these in a database
      const frontendPort = process.env.VITE_PORT || 5173;
      const frontendUrl = process.env.FRONTEND_URL || `http://localhost:${frontendPort}`;
      res.redirect(`${frontendUrl}/admin/google-business?admin_oauth_success=true&access_token=${tokens.access_token}&refresh_token=${tokens.refresh_token}`);
    } else {
      // Handle customer-specific OAuth (if needed in future)
      const frontendPort = process.env.VITE_PORT || 5173;
      const frontendUrl = process.env.FRONTEND_URL || `http://localhost:${frontendPort}`;
      res.redirect(`${frontendUrl}/admin/google-business?oauth_success=true&clinic_id=${state}&access_token=${tokens.access_token}&refresh_token=${tokens.refresh_token}`);
    }
  } catch (error) {
    console.error('OAuth callback error:', error);
    // Redirect to frontend with error
    const frontendPort = process.env.VITE_PORT || 5173;
    const frontendUrl = process.env.FRONTEND_URL || `http://localhost:${frontendPort}`;
    res.redirect(`${frontendUrl}/admin/google-business?oauth_error=true`);
  }
});

// GET /api/google-business/admin-business-profiles - Get all business profiles from admin account
router.get('/admin-business-profiles', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    // Get tokens from header or environment
    let adminTokens;
    
    if (req.headers['x-admin-tokens']) {
      // Use tokens passed from frontend
      adminTokens = JSON.parse(req.headers['x-admin-tokens']);
    } else {
      // Fallback to environment variables
      adminTokens = {
        access_token: process.env.GOOGLE_BUSINESS_ADMIN_ACCESS_TOKEN,
        refresh_token: process.env.GOOGLE_BUSINESS_ADMIN_REFRESH_TOKEN
      };
    }

    if (!adminTokens.access_token) {
      return res.status(400).json({ error: 'Admin Google Business Profile not connected. Please connect first.' });
    }

    // Set up OAuth client with admin tokens
    oauth2Client.setCredentials(adminTokens);

    // Only refresh if access token is actually expired or missing
    // The OAuth2Client will automatically refresh when making API calls if needed
    // We don't need to proactively refresh here - it happens on-demand during API calls

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

    if (!customerId || !businessProfileId || !businessProfileName || !tokens) {
      console.log('Missing required fields:', {
        customerId: !!customerId,
        businessProfileId: !!businessProfileId,
        businessProfileName: !!businessProfileName,
        tokens: !!tokens
      });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Update customer with business profile info
    const updateData = {
      googleBusinessProfileId: businessProfileId,
      googleBusinessProfileName: businessProfileName,
      googleBusinessAccessToken: tokens.access_token,
      googleBusinessRefreshToken: tokens.refresh_token,
      googleBusinessNeedsReauth: false // Clear reauth flag when saving new tokens
    };

    // Only add expiry if we have a valid expires_in value
    if (tokens.expires_in && !isNaN(tokens.expires_in)) {
      updateData.googleBusinessTokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);
    }

    await User.findByIdAndUpdate(customerId, updateData);

    console.log('Successfully saved business profile for customer:', customerId);
    res.json({ success: true, message: 'Business profile connected successfully' });
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
    const customer = await User.findById(customerId);
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

    // Fail fast if customer is required but missing
    if (!customer || !customer.googleBusinessProfileId || !customer.googleBusinessAccessToken) {
      console.error(`❌ Missing Google Business Profile data for customer ${customerId}:`, {
        customerExists: !!customer,
        hasProfileId: !!customer?.googleBusinessProfileId,
        profileId: customer?.googleBusinessProfileId,
        hasAccessToken: !!customer?.googleBusinessAccessToken,
        hasRefreshToken: !!customer?.googleBusinessRefreshToken,
        profileName: customer?.googleBusinessProfileName
      });
      return res.status(400).json({ 
        error: 'Missing customer or assigned Google Business Profile location',
        details: {
          customerExists: !!customer,
          hasProfileId: !!customer?.googleBusinessProfileId,
          hasAccessToken: !!customer?.googleBusinessAccessToken,
          message: 'Please ensure the admin has assigned a Google Business Profile and tokens were saved correctly.'
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

    // Set up OAuth client
    oauth2Client.setCredentials({
      access_token: customer.googleBusinessAccessToken,
      refresh_token: customer.googleBusinessRefreshToken
    });

    // Token validation and refresh logic with proper expiry guard
    const now = Date.now();
    const expiresAt = customer.googleBusinessTokenExpiry ? new Date(customer.googleBusinessTokenExpiry).getTime() : 0;
    const refreshThreshold = 60 * 1000; // 60 seconds before expiry

    // Log and validate the token we're about to use
    console.log('🔍 Token validation:', {
      hasAccessToken: !!customer.googleBusinessAccessToken,
      hasRefreshToken: !!customer.googleBusinessRefreshToken,
      expiresAt: customer.googleBusinessTokenExpiry,
      expiresInMs: expiresAt - now,
      needsRefresh: now > (expiresAt - refreshThreshold)
    });

    if (!customer.googleBusinessAccessToken) {
      return res.status(400).json({ error: 'No access_token in store' });
    }

    // Pre-call expiry guard: refresh if token expires within 60 seconds
    if (now > (expiresAt - refreshThreshold)) {
      console.log('🔄 Token expires soon, refreshing proactively...');
      
      if (!customer.googleBusinessRefreshToken) {
        console.error('❌ No refresh token available for customer');
        await User.findByIdAndUpdate(customerId, {
          googleBusinessNeedsReauth: true
        });
        return res.status(401).json({ 
          error: 'Google Business Profile refresh token missing. Please ask your administrator to reconnect.',
          requiresReauth: true
        });
      }
      
      try {
        // Use direct token refresh (like Google Ads) - doesn't require redirect URI match
        const refreshedTokens = await refreshGoogleBusinessToken(customer.googleBusinessRefreshToken);
        
        console.log('🔍 Refresh credentials received:', {
          hasAccessToken: !!refreshedTokens.access_token,
          hasRefreshToken: !!refreshedTokens.refresh_token,
          expiresIn: refreshedTokens.expires_in
        });
        
        // Update customer with new tokens and recompute expiry
        let newExpiry = null;
        if (refreshedTokens.expires_in && !isNaN(Number(refreshedTokens.expires_in))) {
          newExpiry = new Date(Date.now() + refreshedTokens.expires_in * 1000);
        }
        
        const updateData = {
          googleBusinessAccessToken: refreshedTokens.access_token,
          googleBusinessNeedsReauth: false // Clear reauth flag on successful refresh
        };
        
        // Preserve refresh token (use new if provided, otherwise keep existing)
        if (refreshedTokens.refresh_token) {
          updateData.googleBusinessRefreshToken = refreshedTokens.refresh_token;
        }
        
        if (newExpiry) {
          updateData.googleBusinessTokenExpiry = newExpiry;
        }
        
        await User.findByIdAndUpdate(customerId, updateData);
        
        // Update our local OAuth client credentials for API calls
        oauth2Client.setCredentials({
          access_token: refreshedTokens.access_token,
          refresh_token: refreshedTokens.refresh_token || customer.googleBusinessRefreshToken
        });
        
        console.log('✅ Token refreshed successfully using direct API call, new expiry:', newExpiry);
      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError.message);
        console.error('❌ Refresh error details:', refreshError.response?.data);
        
        // Handle refresh token rotation (invalid_grant)
        if (refreshError.response?.data?.error === 'invalid_grant' || 
            refreshError.message?.includes('invalid_grant')) {
          // Mark customer as needing re-auth
          await User.findByIdAndUpdate(customerId, {
            googleBusinessNeedsReauth: true
          });
          
          console.error(`❌ Customer ${customerId} needs re-authentication - tokens expired`);
          
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
    
    // Also check if customer was marked as needing reauth
    if (customer.googleBusinessNeedsReauth) {
      console.error(`❌ Customer ${customerId} marked as needing re-authentication`);
      return res.status(401).json({ 
        error: 'Google Business Profile connection expired. Please ask your administrator to reconnect your Google Business Profile.',
        requiresReauth: true,
        details: 'Your Google Business Profile tokens have expired. Admin needs to re-assign the profile.'
      });
    }

    // Use Business Profile Performance API (recommended by ChatGPT)
    const performance = google.businessprofileperformance({ version: 'v1', auth: oauth2Client });

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
        details: { startDate, endDate }
      });
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

    // Use the location ID from the customer's profile
    const locationId = customer.googleBusinessProfileId;
    const locationName = `locations/${locationId}`;

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

    // Get the current access token (might have been refreshed)
    const currentCredentials = oauth2Client.credentials;
    const accessToken = currentCredentials.access_token;

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

    // Sort daily data by date
    processedData.dailyData.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Verify day-by-day breakdown is correct
    console.log(`✅ Processed insights: ${processedData.dailyData.length} days of data`);
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
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      customerId: req.params.customerId,
      locationId: customer?.googleBusinessProfileId || 'customer_not_found'
    });
    
    // Log to Google Cloud Console format for debugging
    console.error('🔍 Cloud Console Debug Info:', {
      serviceName: 'businessprofileperformance.googleapis.com',
      method: 'fetchMultiDailyMetricsTimeSeries',
      statusCode: error.response?.status,
      errorMessage: error.response?.data?.error?.message,
      requestParams: {
        locationId: customer?.googleBusinessProfileId,
        metrics: metrics,
        dateRange: { start: startDateObj, end: endDateObj }
      }
    });
    
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
      googleBusinessTokenExpiry: null
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
    
    // Get tokens from header or environment
    let adminTokens;
    
    if (req.headers['x-admin-tokens']) {
      adminTokens = JSON.parse(req.headers['x-admin-tokens']);
    } else {
      adminTokens = {
        access_token: process.env.GOOGLE_BUSINESS_ADMIN_ACCESS_TOKEN,
        refresh_token: process.env.GOOGLE_BUSINESS_ADMIN_REFRESH_TOKEN
      };
    }

    if (!adminTokens.access_token) {
      return res.status(400).json({ error: 'Admin Google Business Profile not connected. Please connect first.' });
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
          const axios = require('axios');
          
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
