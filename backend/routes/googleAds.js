// Google Ads API Routes - Fresh Implementation
const express = require('express');
const axios = require('axios');
const router = express.Router();
const User = require('../models/User');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

// Constants
const MCC_CUSTOMER_ID = '4037087680';
const SCOPES = ['https://www.googleapis.com/auth/adwords'];

// ============================================
// Health Check - Debug endpoint
// ============================================

router.get('/health', (req, res) => {
  const missing = [
    'GOOGLE_ADS_CLIENT_ID',
    'GOOGLE_ADS_CLIENT_SECRET',
    'GOOGLE_ADS_REDIRECT_URI',
    'GOOGLE_ADS_DEVELOPER_TOKEN',
  ].filter(key => !process.env[key]);

  res.json({
    ok: missing.length === 0,
    missing,
    hasClientId: !!process.env.GOOGLE_ADS_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_ADS_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_ADS_REDIRECT_URI,
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ? 'SET' : 'MISSING',
    loginCustomerId: MCC_CUSTOMER_ID,
  });
});

// ============================================
// OAuth Implementation
// ============================================

// GET /api/google-ads/auth/admin - Start OAuth flow
router.get('/auth/admin', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    // Sanity check: required envs
    ['GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_REDIRECT_URI'].forEach(key => {
      if (!process.env[key]) {
        throw new Error(`Missing env: ${key}`);
      }
    });

  const adminUser = await User.findOne({ role: 'admin' });
  if (!adminUser) {
    return res.status(404).json({ error: 'Admin user not found' });
  }
  
  const redirectUri = process.env.GOOGLE_ADS_REDIRECT_URI;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_ADS_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${SCOPES[0]}&response_type=code&state=${adminUser._id}&access_type=offline&prompt=consent`;

    console.log('✅ OAuth URL generated successfully');
    console.log('   Redirect URI:', redirectUri);
    console.log('   Admin ID:', adminUser._id);

  res.json({ authUrl });
  } catch (error) {
    console.error('❌ OAuth URL generation error:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      env: {
        CLIENT_ID: !!process.env.GOOGLE_ADS_CLIENT_ID,
        CLIENT_SECRET: !!process.env.GOOGLE_ADS_CLIENT_SECRET,
        REDIRECT_URI: process.env.GOOGLE_ADS_REDIRECT_URI,
      },
    });
    res.status(500).json({ error: 'Failed to generate OAuth URL', details: error.message });
  }
});

// GET /api/google-ads/callback - Handle OAuth callback
router.get('/callback', async (req, res) => {
  const { code, state: adminUserId, error: oauthError } = req.query;
  
  // Handle OAuth errors
  if (oauthError) {
    console.error('❌ OAuth callback error from Google:', req.query);
    const frontendPort = process.env.VITE_PORT || 5173;
    const frontendUrl = process.env.FRONTEND_URL || `http://localhost:${frontendPort}`;
    return res.redirect(`${frontendUrl}/admin/google-ads?error=${oauthError}`);
  }
  
  try {
    if (!code || !adminUserId) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    // Exchange code for tokens
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.GOOGLE_ADS_REDIRECT_URI,
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Save tokens to admin user
    await User.findByIdAndUpdate(adminUserId, {
      googleAdsAccessToken: access_token,
      googleAdsRefreshToken: refresh_token,
      googleAdsTokenExpiry: new Date(Date.now() + expires_in * 1000),
    });

    // Check for refresh token
    if (!refresh_token) {
      throw new Error('No refresh_token returned. Ensure access_type=offline & prompt=consent.');
    }
    
    console.log('✅ Google Ads OAuth successful for admin:', adminUserId);
    
    const frontendPort = process.env.VITE_PORT || 5173;
    const frontendUrl = process.env.FRONTEND_URL || `http://localhost:${frontendPort}`;
    res.redirect(`${frontendUrl}/admin/google-ads?success=true`);
  } catch (error) {
    console.error('❌ Token exchange failed:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      response: error?.response?.data,
    });
    const frontendPort = process.env.VITE_PORT || 5173;
    const frontendUrl = process.env.FRONTEND_URL || `http://localhost:${frontendPort}`;
    res.redirect(`${frontendUrl}/admin/google-ads?error=${error.message}`);
  }
});

// Helper: Get fresh access token from refresh token
async function getAccessToken(refreshToken) {
  const response = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  return response.data.access_token;
}

// Helper: Make GAQL query to Google Ads API
async function executeGAQLQuery(accessToken, customerId, query) {
  const url = `https://googleads.googleapis.com/v22/customers/${customerId}/googleAds:search`;
  
  const response = await axios.post(url, { query }, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      'login-customer-id': MCC_CUSTOMER_ID,
      'Content-Type': 'application/json'
    }
  });

  return response.data.results || [];
}

// ============================================
// Accounts Endpoint
// ============================================

// GET /api/google-ads/accounts - List accessible customer accounts
router.get('/accounts', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser || !adminUser.googleAdsRefreshToken) {
      return res.status(401).json({ error: 'Admin Google Ads not connected' });
    }

    const accessToken = await getAccessToken(adminUser.googleAdsRefreshToken);

    // Use customer_client hierarchy query to get all child accounts under MCC
    const gaqlQuery = `
      SELECT
        customer_client.client_customer,
        customer_client.descriptive_name,
        customer_client.level,
        customer_client.currency_code,
        customer_client.status
      FROM customer_client
      WHERE customer_client.level <= 1
      ORDER BY customer_client.descriptive_name
    `;

    const searchUrl = `https://googleads.googleapis.com/v22/customers/${MCC_CUSTOMER_ID}/googleAds:search`;
    const response = await axios.post(searchUrl, { query: gaqlQuery }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        'login-customer-id': MCC_CUSTOMER_ID,
          'Content-Type': 'application/json'
      }
    });

    const results = response.data.results || [];
    console.log(`🔍 Found ${results.length} accounts in hierarchy`);
    
    // Log first result to debug structure
    if (results.length > 0) {
      console.log('🔍 Sample result structure:', JSON.stringify(results[0], null, 2));
    }

    // Extract customer IDs and names (API returns camelCase, not snake_case!)
    const accounts = results.map(row => {
      const client = row.customerClient || {}; // camelCase!
      const customerIdRaw = client.clientCustomer || ''; // camelCase!
      const customerId = typeof customerIdRaw === 'string' 
        ? customerIdRaw.replace('customers/', '') 
        : String(customerIdRaw).replace('customers/', '');
      
      // Skip MCC itself
      if (customerId === MCC_CUSTOMER_ID || !customerId) {
        return null;
      }

      return {
        id: customerId,
        name: client.descriptiveName || `Account ${customerId}`, // camelCase!
        currency: client.currencyCode || 'CAD', // camelCase!
        timeZone: 'America/Toronto',
        descriptiveName: client.descriptiveName || `Account ${customerId}`, // camelCase!
        level: client.level,
        status: client.status
      };
    }).filter(Boolean); // Remove null entries

    console.log(`✅ Returning ${accounts.length} accessible customer accounts`);
    res.json(accounts);
  } catch (error) {
    console.error('❌ List accounts error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to list accounts', details: error.message });
  }
});

// ============================================
// KPIs Endpoint
// ============================================

// GET /api/google-ads/kpis?accountId=XXX&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/kpis', authenticateToken, async (req, res) => {
  try {
    const { accountId, from, to } = req.query;
    
    if (!accountId) {
      return res.status(400).json({ error: 'accountId required' });
    }

    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser?.googleAdsRefreshToken) {
      return res.status(401).json({ error: 'Admin Google Ads not connected' });
    }

    const accessToken = await getAccessToken(adminUser.googleAdsRefreshToken);

    // Determine date range - handle custom range or use default
    let dateClause;
    if (from && to) {
      // Custom date range
      dateClause = `segments.date BETWEEN '${from}' AND '${to}'`;
    } else {
      // Default: last 30 days
      dateClause = `segments.date DURING LAST_30_DAYS`;
    }

    console.log(`📅 KPIs date clause: ${dateClause}`);

    const gaql = `
      SELECT 
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions, 
        metrics.conversions, 
        metrics.ctr,
        metrics.cost_per_conversion
      FROM customer
      WHERE ${dateClause}
    `;

    const results = await executeGAQLQuery(accessToken, accountId, gaql);

    // Roll up metrics (API returns camelCase!)
    const totals = results.reduce((acc, row) => {
      const m = row.metrics || {}; // Might be camelCase
      acc.costMicros += Number(m.costMicros || m.cost_micros || 0);
      acc.clicks += Number(m.clicks || 0);
      acc.impressions += Number(m.impressions || 0);
      acc.conversions += Number(m.conversions || 0);
      return acc;
    }, { costMicros: 0, clicks: 0, impressions: 0, conversions: 0 });

    // Calculate derived metrics (guard against division by zero)
    const spend = totals.costMicros / 1_000_000;
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) : 0;
    const cpa = totals.conversions > 0 ? (spend / totals.conversions) : 0;

    // Return in format expected by frontend
    res.json({
      spend,
      clicks: totals.clicks,
      impressions: totals.impressions,
      conversions: totals.conversions,
      ctr,
      cpa,
      // Also include camelCase versions for frontend compatibility
      totalCost: spend,
      totalClicks: totals.clicks,
      totalImpressions: totals.impressions,
      totalConversions: totals.conversions,
      avgCtr: ctr,
      avgCpa: cpa
    });
  } catch (error) {
    console.error('KPIs error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch KPIs', details: error.message });
  }
});

// ============================================
// Daily Metrics Endpoint
// ============================================

// GET /api/google-ads/daily?accountId=XXX&from=...&to=...
router.get('/daily', authenticateToken, async (req, res) => {
  try {
    const { accountId, from, to } = req.query;
    
    if (!accountId) {
      return res.status(400).json({ error: 'accountId required' });
    }

    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser?.googleAdsRefreshToken) {
      return res.status(401).json({ error: 'Admin Google Ads not connected' });
    }

    const accessToken = await getAccessToken(adminUser.googleAdsRefreshToken);

    // Determine date range
    let dateClause;
    if (from && to) {
      // Custom date range or standard range (7, 30, 90 days)
      dateClause = `segments.date BETWEEN '${from}' AND '${to}'`;
      console.log(`📅 Daily metrics date range: ${from} to ${to}`);
    } else {
      // Default: last 30 days
      dateClause = `segments.date DURING LAST_30_DAYS`;
      console.log(`📅 Daily metrics date clause: ${dateClause} (default)`);
    }

    const gaql = `
      SELECT
        segments.date, 
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.conversions
      FROM customer
      WHERE ${dateClause}
      ORDER BY segments.date
    `;

    const results = await executeGAQLQuery(accessToken, accountId, gaql);

    // Transform to arrays by date (API returns camelCase!)
    const daily = {};
    results.forEach(row => {
      const date = row.segments?.date;
      if (date) {
        const m = row.metrics || {};
        const costMicros = m.costMicros || m.cost_micros || 0;
        daily[date] = {
          spend: costMicros / 1_000_000,
          cost: costMicros / 1_000_000, // Also add 'cost' field for chart compatibility
          clicks: Number(m.clicks || 0),
          impressions: Number(m.impressions || 0),
          conversions: Number(m.conversions || 0)
        };
      }
    });

    const dateCount = Object.keys(daily).length;
    console.log(`📅 Daily metrics: ${dateCount} days of data returned (from ${from || 'default'} to ${to || 'default'})`);
    
    res.json({ daily });
  } catch (error) {
    console.error('Daily metrics error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch daily metrics', details: error.message });
  }
});

// ============================================
// Campaigns Endpoint
// ============================================

// GET /api/google-ads/campaigns?accountId=XXX&from=...&to=...
router.get('/campaigns', authenticateToken, async (req, res) => {
  try {
    const { accountId, from, to } = req.query;
    
    if (!accountId) {
      return res.status(400).json({ error: 'accountId required' });
    }

    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser?.googleAdsRefreshToken) {
      return res.status(401).json({ error: 'Admin Google Ads not connected' });
    }

    const accessToken = await getAccessToken(adminUser.googleAdsRefreshToken);

    // Determine date range
    let dateClause;
    if (from && to) {
      dateClause = `segments.date BETWEEN '${from}' AND '${to}'`;
    } else {
      dateClause = `segments.date DURING LAST_30_DAYS`;
    }

    const gaql = `
          SELECT 
            campaign.id, 
            campaign.name, 
            campaign.status, 
            campaign.advertising_channel_type,
        metrics.cost_micros,
        metrics.clicks,
            metrics.impressions, 
            metrics.conversions, 
        metrics.cost_per_conversion
          FROM campaign
      WHERE ${dateClause}
        AND campaign.status = 'ENABLED'
    `;

    const results = await executeGAQLQuery(accessToken, accountId, gaql);

    // Transform to table rows (API returns camelCase!)
    const campaigns = results.map(row => {
      const c = row.campaign || {};
      const m = row.metrics || {};
      const costMicros = m.costMicros || m.cost_micros || 0;
      const spend = costMicros / 1_000_000;
      const conversions = Number(m.conversions || 0);
      const cpa = conversions > 0 ? (spend / conversions) : 0;

      return {
        campaignId: String(c.id || ''),
        name: c.name || '',
        status: c.status || '',
        channel: c.advertisingChannelType || c.advertising_channel_type || '',
        spend,
        clicks: Number(m.clicks || 0),
        impressions: Number(m.impressions || 0),
        conversions,
        cpa
      };
    });

    res.json({ campaigns });
  } catch (error) {
    console.error('Campaigns error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch campaigns', details: error.message });
  }
});

// ============================================
// Account Assignment Endpoints
// ============================================

// POST /api/google-ads/save-account - Assign Google Ads account to customer
router.post('/save-account', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { clinicId, accountId, accountName, currency, timeZone } = req.body;
    
    if (!clinicId || !accountId) {
      return res.status(400).json({ error: 'clinicId and accountId required' });
    }

    const user = await User.findByIdAndUpdate(
      clinicId,
      { 
        googleAdsCustomerId: accountId,
        googleAdsAccountName: accountName || null
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      success: true, 
      message: 'Google Ads account assigned successfully',
      accountId,
      accountName 
    });
  } catch (error) {
    console.error('Save account error:', error);
    res.status(500).json({ error: 'Failed to save Google Ads account' });
  }
});

// PATCH /api/google-ads/disconnect/:clinicId - Disconnect Google Ads from customer
router.patch('/disconnect/:clinicId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { clinicId } = req.params;

  try {
    const user = await User.findByIdAndUpdate(
      clinicId,
      {
        googleAdsAccessToken: null,
        googleAdsRefreshToken: null,
        googleAdsTokenExpiry: null,
        googleAdsCustomerId: null,
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Google Ads disconnected successfully!', user });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Google Ads' });
  }
});

module.exports = router;

