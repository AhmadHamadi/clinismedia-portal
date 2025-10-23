// Google Ads API Routes
// TODO: Add scheduled job to update AI insights every 24 hours
// This would generate customer-focused insights based on performance data
// and store them in the database for consistent display across sessions

const express = require('express');
const axios = require('axios');
const router = express.Router();
const User = require('../models/User');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');
const { asMccCustomer, asClientCustomer, dumpAdsError, serializeError } = require('../services/googleAdsClient');

// Google Ads OAuth routes (authenticated)
router.get('/auth/:clinicId', authenticateToken, authorizeRole(['admin']), (req, res) => {
  const clinicId = req.params.clinicId;
  const redirectUri = process.env.GOOGLE_ADS_REDIRECT_URI;

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_ADS_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=https://www.googleapis.com/auth/adwords&response_type=code&state=${clinicId}`;

  res.json({ authUrl });
});

// Get available Google Ads accounts (for dropdown)
router.get('/accounts', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    // TODO: Replace with real Google Ads API call when Basic Access is approved
    // For now, return mock accounts for testing
    const mockAccounts = [
      {
        id: '1234567890',
        name: 'CliniMedia - Main Account',
        currency: 'CAD',
        timeZone: 'America/Toronto',
        descriptiveName: 'CliniMedia Main Google Ads Account'
      },
      {
        id: '2345678901',
        name: 'Dental Clinic - Calgary',
        currency: 'CAD', 
        timeZone: 'America/Edmonton',
        descriptiveName: 'Calgary Dental Practice'
      },
      {
        id: '3456789012',
        name: 'Medical Center - Vancouver',
        currency: 'CAD',
        timeZone: 'America/Vancouver', 
        descriptiveName: 'Vancouver Medical Center'
      },
      {
        id: '4567890123',
        name: 'Clinic - Toronto',
        currency: 'CAD',
        timeZone: 'America/Toronto',
        descriptiveName: 'Toronto Health Clinic'
      }
    ];

    res.json(mockAccounts);
  } catch (error) {
    console.error('Error fetching Google Ads accounts:', error);
    res.status(500).json({ error: 'Failed to fetch Google Ads accounts' });
  }
});

router.get('/callback', async (req, res) => {
  const { code, state: clinicId } = req.query;
  const redirectUri = process.env.GOOGLE_ADS_REDIRECT_URI;

  console.log(`Google Ads OAuth callback received for clinic: ${clinicId}`);

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    const tokenData = tokenResponse.data;

    // Save tokens to user
    await User.findByIdAndUpdate(clinicId, {
      googleAdsAccessToken: tokenData.access_token,
      googleAdsRefreshToken: tokenData.refresh_token,
      googleAdsTokenExpiry: new Date(Date.now() + tokenData.expires_in * 1000),
    });

    console.log(`Google Ads tokens saved for clinic: ${clinicId}`);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/admin/google-ads?success=true&clinicId=${clinicId}`);
  } catch (error) {
    console.error('Google Ads OAuth callback error:', error.response?.data || error.message);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/admin/google-ads?error=true`);
  }
});

// Get Google Ads insights for a customer
router.get('/insights/:customerId', authenticateToken, async (req, res) => {
  try {
    const { customerId } = req.params;
    const { startDate, endDate } = req.query;

    // Verify the user is requesting their own data or is an admin
    if (req.user.role !== 'admin' && req.user.id !== customerId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await User.findById(customerId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.googleAdsAccessToken) {
      return res.status(404).json({ error: 'Google Ads not connected' });
    }

    // TODO: Implement actual Google Ads API calls here
    // For now, return comprehensive mock data
    const mockData = {
      totalImpressions: Math.floor(Math.random() * 10000) + 5000,
      totalClicks: Math.floor(Math.random() * 500) + 100,
      totalCost: Math.random() * 1000 + 200,
      ctr: Math.random() * 5 + 2, // 2-7%
      conversionRate: Math.random() * 3 + 1, // 1-4%
      conversions: Math.floor(Math.random() * 20) + 5,
      costPerConversion: Math.random() * 50 + 25,
      averageCpc: Math.random() * 2 + 0.5,
      averageCpm: Math.random() * 20 + 10,
      qualityScore: Math.random() * 4 + 6, // 6-10
      searchImpressionShare: Math.random() * 30 + 40, // 40-70%
      searchRankLostImpressionShare: Math.random() * 20 + 10,
      searchExactMatchImpressionShare: Math.random() * 25 + 15,
      displayImpressionShare: Math.random() * 20 + 30,
      displayRankLostImpressionShare: Math.random() * 15 + 5,
      videoViews: Math.floor(Math.random() * 2000) + 500,
      videoViewRate: Math.random() * 10 + 5,
      videoQuartile25Rate: Math.random() * 20 + 60,
      videoQuartile50Rate: Math.random() * 15 + 45,
      videoQuartile75Rate: Math.random() * 10 + 30,
      videoQuartile100Rate: Math.random() * 5 + 15,
      lastUpdated: new Date().toISOString()
    };

    res.json(mockData);
  } catch (error) {
    console.error('Google Ads insights error:', error);
    res.status(500).json({ error: 'Failed to fetch Google Ads insights' });
  }
});

// Get Google Ads campaigns for a customer
router.get('/campaigns/:customerId', authenticateToken, async (req, res) => {
  try {
    const { customerId } = req.params;
    const { startDate, endDate } = req.query;

    // Verify the user is requesting their own data or is an admin
    if (req.user.role !== 'admin' && req.user.id !== customerId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await User.findById(customerId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.googleAdsAccessToken) {
      return res.status(404).json({ error: 'Google Ads not connected' });
    }

    // TODO: Implement Google Ads API calls here
    // For now, return mock campaign data
    const mockCampaigns = [
      {
        id: '12345678901',
        name: 'Search Campaign - Brand Terms',
        status: 'ENABLED',
        type: 'SEARCH',
        impressions: Math.floor(Math.random() * 5000) + 2000,
        clicks: Math.floor(Math.random() * 200) + 50,
        cost: Math.random() * 500 + 100,
        conversions: Math.floor(Math.random() * 10) + 2,
        ctr: Math.random() * 4 + 2,
        averageCpc: Math.random() * 2 + 0.5
      },
      {
        id: '12345678902',
        name: 'Display Campaign - Remarketing',
        status: 'ENABLED',
        type: 'DISPLAY',
        impressions: Math.floor(Math.random() * 10000) + 5000,
        clicks: Math.floor(Math.random() * 300) + 100,
        cost: Math.random() * 300 + 50,
        conversions: Math.floor(Math.random() * 8) + 1,
        ctr: Math.random() * 2 + 1,
        averageCpc: Math.random() * 1 + 0.3
      },
      {
        id: '12345678903',
        name: 'Video Campaign - Awareness',
        status: 'PAUSED',
        type: 'VIDEO',
        impressions: Math.floor(Math.random() * 3000) + 1000,
        clicks: Math.floor(Math.random() * 100) + 20,
        cost: Math.random() * 200 + 30,
        conversions: Math.floor(Math.random() * 5) + 1,
        ctr: Math.random() * 3 + 1,
        averageCpc: Math.random() * 1.5 + 0.4
      },
      {
        id: '12345678904',
        name: 'Shopping Campaign - Products',
        status: 'ENABLED',
        type: 'SHOPPING',
        impressions: Math.floor(Math.random() * 8000) + 3000,
        clicks: Math.floor(Math.random() * 400) + 150,
        cost: Math.random() * 800 + 200,
        conversions: Math.floor(Math.random() * 15) + 5,
        ctr: Math.random() * 5 + 3,
        averageCpc: Math.random() * 2.5 + 0.8
      }
    ];

    res.json(mockCampaigns);
  } catch (error) {
    console.error('Google Ads campaigns error:', error);
    res.status(500).json({ error: 'Failed to fetch Google Ads campaigns' });
  }
});

// Save Google Ads account to customer
router.post('/save-account', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { clinicId, accountId, accountName, currency, timeZone } = req.body;

    const user = await User.findByIdAndUpdate(clinicId, {
      googleAdsCustomerId: accountId,
    }, { new: true });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      success: true, 
      message: 'Google Ads account connected successfully',
      accountId,
      accountName 
    });
  } catch (error) {
    console.error('Save Google Ads account error:', error);
    res.status(500).json({ error: 'Failed to save Google Ads account' });
  }
});

// Disconnect Google Ads for a clinic (Admin only)
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

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Google Ads disconnected successfully!', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to disconnect Google Ads' });
  }
});

// Customer endpoints (for customers to view their own Google Ads data)
// Get Google Ads insights for current customer
router.get('/insights/me', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.id;
    const { startDate, endDate, forceRefresh } = req.query;

    const user = await User.findById(customerId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.googleAdsAccessToken) {
      return res.status(404).json({ error: 'Google Ads not connected' });
    }

    // TODO: Replace with real Google Ads API calls when Basic Access is approved
    // For now, return comprehensive mock data
    const mockData = {
      totalImpressions: Math.floor(Math.random() * 10000) + 5000,
      totalClicks: Math.floor(Math.random() * 500) + 100,
      totalCost: Math.random() * 1000 + 200,
      ctr: Math.random() * 5 + 2, // 2-7%
      conversionRate: Math.random() * 3 + 1, // 1-4%
      conversions: Math.floor(Math.random() * 20) + 5,
      costPerConversion: Math.random() * 50 + 25,
      averageCpc: Math.random() * 2 + 0.5,
      averageCpm: Math.random() * 20 + 10,
      qualityScore: Math.random() * 4 + 6, // 6-10
      searchImpressionShare: Math.random() * 30 + 40, // 40-70%
      searchRankLostImpressionShare: Math.random() * 20 + 10,
      searchExactMatchImpressionShare: Math.random() * 25 + 15,
      displayImpressionShare: Math.random() * 20 + 30,
      displayRankLostImpressionShare: Math.random() * 15 + 5,
      videoViews: Math.floor(Math.random() * 2000) + 500,
      videoViewRate: Math.random() * 10 + 5,
      videoQuartile25Rate: Math.random() * 20 + 60,
      videoQuartile50Rate: Math.random() * 15 + 45,
      videoQuartile75Rate: Math.random() * 10 + 30,
      videoQuartile100Rate: Math.random() * 5 + 15,
      lastUpdated: new Date().toISOString()
    };

    res.json(mockData);
  } catch (error) {
    console.error('Customer Google Ads insights error:', error);
    res.status(500).json({ error: 'Failed to fetch Google Ads insights' });
  }
});

// Get Google Ads campaigns for current customer
router.get('/campaigns/me', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.id;
    const { startDate, endDate } = req.query;

    const user = await User.findById(customerId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.googleAdsAccessToken) {
      return res.status(404).json({ error: 'Google Ads not connected' });
    }

    // TODO: Replace with real Google Ads API calls when Basic Access is approved
    // For now, return mock campaign data
    const mockCampaigns = [
      {
        id: '12345678901',
        name: 'Search Campaign - Brand Terms',
        status: 'ENABLED',
        type: 'SEARCH',
        impressions: Math.floor(Math.random() * 5000) + 2000,
        clicks: Math.floor(Math.random() * 200) + 50,
        cost: Math.random() * 500 + 100,
        conversions: Math.floor(Math.random() * 10) + 2,
        ctr: Math.random() * 4 + 2,
        averageCpc: Math.random() * 2 + 0.5
      },
      {
        id: '12345678902',
        name: 'Display Campaign - Remarketing',
        status: 'ENABLED',
        type: 'DISPLAY',
        impressions: Math.floor(Math.random() * 10000) + 5000,
        clicks: Math.floor(Math.random() * 300) + 100,
        cost: Math.random() * 300 + 50,
        conversions: Math.floor(Math.random() * 8) + 1,
        ctr: Math.random() * 2 + 1,
        averageCpc: Math.random() * 1 + 0.3
      },
      {
        id: '12345678903',
        name: 'Video Campaign - Awareness',
        status: 'PAUSED',
        type: 'VIDEO',
        impressions: Math.floor(Math.random() * 3000) + 1000,
        clicks: Math.floor(Math.random() * 100) + 20,
        cost: Math.random() * 200 + 30,
        conversions: Math.floor(Math.random() * 5) + 1,
        ctr: Math.random() * 3 + 1,
        averageCpc: Math.random() * 1.5 + 0.4
      }
    ];

    res.json(mockCampaigns);
  } catch (error) {
    console.error('Customer Google Ads campaigns error:', error);
    res.status(500).json({ error: 'Failed to fetch Google Ads campaigns' });
  }
});

// Get Google Ads account info for current customer
router.get('/account/me', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.id;

    const user = await User.findById(customerId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.googleAdsAccessToken) {
      return res.status(404).json({ error: 'Google Ads not connected' });
    }

    // TODO: Replace with real Google Ads API calls when Basic Access is approved
    // For now, return mock account data
    const mockAccount = {
      id: user.googleAdsCustomerId || '1234567890',
      name: 'CliniMedia - Main Account',
      currency: 'CAD',
      timeZone: 'America/Toronto',
      descriptiveName: 'CliniMedia Main Google Ads Account'
    };

    res.json(mockAccount);
  } catch (error) {
    console.error('Customer Google Ads account error:', error);
    res.status(500).json({ error: 'Failed to fetch Google Ads account' });
  }
});

// Get account name for a specific customer ID
router.get('/account/name', authenticateToken, async (req, res) => {
  try {
    const { customerId } = req.query;
    console.log(`[ACCOUNT/NAME] Request for customer: ${customerId}`);

    if (!customerId) {
      return res.status(400).json({ error: 'customerId required' });
    }

    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser || !adminUser.googleAdsRefreshToken || !adminUser.googleAdsCustomerId) {
      return res.status(400).json({ error: 'Admin Google Ads not connected' });
    }

    const customer = asClientCustomer(adminUser.googleAdsRefreshToken, adminUser.googleAdsCustomerId, customerId);
    console.log(`[ACCOUNT/NAME] Created customer client for: ${customerId}`);

    // Get account info
    const accountInfo = await customer.query(`
      SELECT 
        customer.id, 
        customer.descriptive_name, 
        customer.currency_code, 
        customer.time_zone
      FROM customer
      LIMIT 1
    `);

    console.log(`[ACCOUNT/NAME] Found account info for: ${customerId}`);

    res.json({
      success: true,
      customerId: customerId,
      accountInfo: accountInfo[0] || null,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ACCOUNT/NAME] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch account name', 
      details: error.message 
    });
  }
});

// Debug endpoint to test hierarchy connection
router.get('/debug/hierarchy', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser || !adminUser.googleAdsRefreshToken) {
      return res.status(404).json({ error: 'Admin Google Ads not connected' });
    }

    console.log('🔍 Testing hierarchy connection...');

    // A/B TEST: Uncomment this line to test with static data
    // return res.json({ ok: true, count: 1, items: [{ id:"1234567890", name:"Test", level:1, currency:"CAD", status:"ENABLED" }] });

    const managerCustomerId = '4037087680';

    // Get access token
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: adminUser.googleAdsRefreshToken,
      grant_type: 'refresh_token',
    });

    const accessToken = tokenResponse.data.access_token;

    // Test hierarchy query using ChatGPT's exact GAQL
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

    const searchUrl = `https://googleads.googleapis.com/v22/customers/${managerCustomerId}/googleAds:search`;
    const searchResponse = await axios.post(searchUrl, {
      query: gaqlQuery
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        'login-customer-id': managerCustomerId,
        'Content-Type': 'application/json'
      },
      validateStatus: () => true // Don't throw on non-2xx status codes
    });

    // Check if the response was successful
    if (searchResponse.status < 200 || searchResponse.status >= 300) {
      console.error('🚨 Google Ads API Error:', searchResponse.status, searchResponse.data);
      return res.status(500).json({
        error: 'Google Ads API call failed',
        details: `Status ${searchResponse.status}: ${JSON.stringify(searchResponse.data)}`
      });
    }

    console.log('🔍 API Response Status:', searchResponse.status);
    console.log('🔍 API Response Data Type:', typeof searchResponse.data);
    console.log('🔍 API Response Data Keys:', Object.keys(searchResponse.data || {}));

    console.time("[HIER] map+filter");
    const arr = Array.isArray(searchResponse?.data?.results)
      ? searchResponse.data.results
      : [];

    console.log("[HIER] results type=", Object.prototype.toString.call(arr), "len=", arr?.length);

    const mapped = arr.map(r => r?.customerClient);
    console.log("[HIER] mapped type=", Object.prototype.toString.call(mapped), "len=", mapped?.length);

    const filtered = mapped.filter(Boolean);
    console.timeEnd("[HIER] map+filter");

    console.log("[HIER] filtered type=", Object.prototype.toString.call(filtered), "len=", filtered?.length);

    const items = filtered.map(client => ({
      id: String(client.clientCustomer || "").replace("customers/", ""),
      name: client.descriptiveName ?? null,
      level: Number(client.level ?? 0),
      currency: client.currencyCode ?? null,
      status: client.status ?? null,
    }));

    console.log("[HIER] final items count:", items.length);

    return res.json({ 
      ok: true, 
      count: items.length, 
      items: items,
      managerAccount: managerCustomerId,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('🚨 Hierarchy debug error:', error);
    res.status(500).json({ 
      error: 'Failed to test hierarchy connection', 
      details: error.message 
    });
  }
});

// Get daily metrics for a specific client - WORKING VERSION using ChatGPT's patterns
router.get('/metrics/daily', authenticateToken, async (req, res) => {
  try {
    const { customerId, days, startDate, endDate } = req.query;
    console.log(`[METRICS/DAILY] Request for customer: ${customerId}, days: ${days}, startDate: ${startDate}, endDate: ${endDate}`);

    if (!customerId) {
      return res.status(400).json({ error: 'customerId required' });
    }

    // Determine date range for GAQL query
    let dateRangeClause;
    if (startDate && endDate) {
      // Custom date range
      dateRangeClause = `segments.date BETWEEN '${startDate}' AND '${endDate}'`;
    } else if (days) {
      // Days parameter (7, 30)
      dateRangeClause = `segments.date DURING LAST_${days}_DAYS`;
    } else {
      // Default to 30 days
      dateRangeClause = `segments.date DURING LAST_30_DAYS`;
    }

    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser || !adminUser.googleAdsRefreshToken || !adminUser.googleAdsCustomerId) {
      return res.status(400).json({ error: 'Admin Google Ads not connected' });
    }

    const customer = asClientCustomer(adminUser.googleAdsRefreshToken, adminUser.googleAdsCustomerId, customerId);
    console.log(`[METRICS/DAILY] Created customer client for: ${customerId}`);

    // 1. Account info using ChatGPT's exact GAQL
    const accountInfo = await customer.query(`
      SELECT 
        customer.id, 
        customer.descriptive_name, 
        customer.currency_code, 
        customer.time_zone
      FROM customer
      LIMIT 1
    `);

    // 2. Daily KPIs using ChatGPT's exact GAQL
    const dailyKPIs = await customer.query(`
      SELECT 
        segments.date, 
        metrics.impressions, 
        metrics.clicks, 
        metrics.cost_micros,
        metrics.conversions, 
        metrics.conversions_value
      FROM customer
      WHERE ${dateRangeClause}
      ORDER BY segments.date
    `);

    // 3. Top campaigns using ChatGPT's exact GAQL
    const topCampaigns = await customer.query(`
      SELECT 
        campaign.id, 
        campaign.name, 
        campaign.status, 
        campaign.primary_status,
        campaign.advertising_channel_type,
        metrics.impressions, 
        metrics.clicks, 
        metrics.conversions, 
        metrics.cost_micros
      FROM campaign
      WHERE campaign.status IN ('ENABLED', 'PAUSED')
        AND ${dateRangeClause}
      ORDER BY metrics.cost_micros DESC
      LIMIT 10
    `);

    console.log(`[METRICS/DAILY] Found ${topCampaigns.length} campaigns, ${dailyKPIs.length} daily rows`);

    // Calculate totals
    const totals = dailyKPIs.reduce((acc, row) => {
      acc.impressions += Number(row.metrics?.impressions ?? 0);
      acc.clicks += Number(row.metrics?.clicks ?? 0);
      acc.cost += Number(row.metrics?.cost_micros ?? 0) / 1_000_000;
      acc.conversions += Number(row.metrics?.conversions ?? 0);
      acc.conversionsValue += Number(row.metrics?.conversions_value ?? 0);
      return acc;
    }, { impressions: 0, clicks: 0, cost: 0, conversions: 0, conversionsValue: 0 });

    // Create daily performance data
    const dailyPerformance = {};
    dailyKPIs.forEach(day => {
      if (day.segments?.date) {
        dailyPerformance[day.segments.date] = {
          cost: Number(day.metrics?.cost_micros ?? 0) / 1_000_000,
          clicks: Number(day.metrics?.clicks ?? 0),
          impressions: Number(day.metrics?.impressions ?? 0),
          conversions: Number(day.metrics?.conversions ?? 0),
          conversionsValue: Number(day.metrics?.conversions_value ?? 0)
        };
      }
    });

    console.log(`[METRICS/DAILY] Daily performance keys:`, Object.keys(dailyPerformance));

    // Calculate additional metrics
    const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) : 0;
    const avgCpa = totals.conversions > 0 ? (totals.cost / totals.conversions) : 0;

    res.json({
      summary: {
        totalCost: totals.cost,
        totalClicks: totals.clicks,
        totalImpressions: totals.impressions,
        totalConversions: totals.conversions,
        totalConversionsValue: totals.conversionsValue,
        avgCtr: avgCtr,
        avgCpa: avgCpa
      },
      campaigns: topCampaigns.map(campaign => ({
        campaignId: campaign.campaign?.id?.toString(),
        campaignName: campaign.campaign?.name,
        status: campaign.campaign?.status,
        channelType: campaign.campaign?.advertising_channel_type,
        cost: Number(campaign.metrics?.cost_micros ?? 0) / 1_000_000,
        clicks: Number(campaign.metrics?.clicks ?? 0),
        impressions: Number(campaign.metrics?.impressions ?? 0),
        conversions: Number(campaign.metrics?.conversions ?? 0),
        conversionsValue: Number(campaign.metrics?.conversions_value ?? 0),
        costPerConversion: Number(campaign.metrics?.conversions ?? 0) > 0 ? 
          (Number(campaign.metrics?.cost_micros ?? 0) / 1_000_000) / Number(campaign.metrics?.conversions ?? 0) : 0,
        ctr: Number(campaign.metrics?.impressions ?? 0) > 0 ? 
          (Number(campaign.metrics?.clicks ?? 0) / Number(campaign.metrics?.impressions ?? 0)) * 100 : 0,
        averageCpc: Number(campaign.metrics?.clicks ?? 0) > 0 ? 
          (Number(campaign.metrics?.cost_micros ?? 0) / 1_000_000) / Number(campaign.metrics?.clicks ?? 0) : 0
      })),
      insights: {
        dailyPerformance: dailyPerformance
      },
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('[METRICS/DAILY] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch metrics', 
      details: error.message 
    });
  }
});

// Comprehensive debug endpoint to show ALL available data for each account
router.get('/debug/all-accounts', authenticateToken, async (req, res) => {
  try {
    // Only allow admin access
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser || !adminUser.googleAdsRefreshToken) {
      return res.status(404).json({ error: 'Admin Google Ads not connected' });
    }

    console.log('🔍 Starting comprehensive account data extraction...');

    const managerCustomerId = '4037087680';

    // Get access token
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: adminUser.googleAdsRefreshToken,
      grant_type: 'refresh_token',
    });

    const accessToken = tokenResponse.data.access_token;

    // Get customer hierarchy using ChatGPT's exact GAQL
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

    const searchUrl = `https://googleads.googleapis.com/v22/customers/${managerCustomerId}/googleAds:search`;
    const searchResponse = await axios.post(searchUrl, {
      query: gaqlQuery
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        'login-customer-id': managerCustomerId,
        'Content-Type': 'application/json'
      }
    });

    const customerClients = searchResponse.data.results || [];
    console.log(`🔍 Found ${customerClients.length} customer clients`);

    const accessibleCustomers = customerClients.map(client => `customers/${client.customer_client.client_customer}`);
    const accountDetails = [];

    for (const customerResource of accessibleCustomers) {
      try {
        const customerId = customerResource.replace('customers/', '');
        console.log(`🔍 Processing account: ${customerId}`);

        // Skip manager account
        if (customerId === '4037087680') {
          console.log(`🔍 Skipping manager account: ${customerId}`);
          continue;
        }

        const customer = asClientCustomer(adminUser.googleAdsRefreshToken, adminUser.googleAdsCustomerId, customerId);

        // 1. Account info using ChatGPT's exact GAQL
        const accountInfo = await customer.query(`
          SELECT 
            customer.id, 
            customer.descriptive_name, 
            customer.currency_code, 
            customer.time_zone
          FROM customer
          LIMIT 1
        `);

        // 2. Daily KPIs using ChatGPT's exact GAQL
        const dailyKPIs = await customer.query(`
          SELECT 
            segments.date, 
            metrics.impressions, 
            metrics.clicks, 
            metrics.cost_micros,
            metrics.conversions, 
            metrics.conversions_value
          FROM customer
          WHERE segments.date DURING LAST_30_DAYS
          ORDER BY segments.date
        `);

        // 3. Top campaigns using ChatGPT's exact GAQL
        const topCampaigns = await customer.query(`
          SELECT 
            campaign.id, 
            campaign.name, 
            campaign.status, 
            campaign.primary_status,
            campaign.advertising_channel_type,
            metrics.impressions, 
            metrics.clicks, 
            metrics.conversions, 
            metrics.cost_micros
          FROM campaign
          WHERE campaign.status IN ('ENABLED', 'PAUSED')
            AND segments.date DURING LAST_30_DAYS
          ORDER BY metrics.cost_micros DESC
          LIMIT 10
        `);

        console.log(`🔍 [${customerId}] Found ${topCampaigns.length} campaigns, ${dailyKPIs.length} daily rows`);

        // Calculate totals
        const totals = dailyKPIs.reduce((acc, row) => {
          acc.impressions += Number(row.metrics?.impressions ?? 0);
          acc.clicks += Number(row.metrics?.clicks ?? 0);
          acc.cost += Number(row.metrics?.cost_micros ?? 0) / 1_000_000;
          acc.conversions += Number(row.metrics?.conversions ?? 0);
          acc.conversionsValue += Number(row.metrics?.conversions_value ?? 0);
          return acc;
        }, { impressions: 0, clicks: 0, cost: 0, conversions: 0, conversionsValue: 0 });

        const accountData = {
          customerId,
          info: accountInfo[0] || null,
          kpis: {
            ...totals,
            ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
            averageCpc: totals.clicks > 0 ? totals.cost / totals.clicks : 0,
            conversionRate: totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0,
            costPerConversion: totals.conversions > 0 ? totals.cost / totals.conversions : 0
          },
          topCampaigns: topCampaigns.map(campaign => ({
            id: campaign.campaign?.id?.toString(),
            name: campaign.campaign?.name,
            status: campaign.campaign?.status,
            primaryStatus: campaign.campaign?.primary_status,
            channelType: campaign.campaign?.advertising_channel_type,
            impressions: Number(campaign.metrics?.impressions ?? 0),
            clicks: Number(campaign.metrics?.clicks ?? 0),
            cost: Number(campaign.metrics?.cost_micros ?? 0) / 1_000_000,
            conversions: Number(campaign.metrics?.conversions ?? 0),
            conversionsValue: Number(campaign.metrics?.conversions_value ?? 0),
            ctr: Number(campaign.metrics?.impressions ?? 0) > 0 ? 
              (Number(campaign.metrics?.clicks ?? 0) / Number(campaign.metrics?.impressions ?? 0)) * 100 : 0
          })),
          dailyKPIs: dailyKPIs.map(day => ({
            date: day.segments?.date,
            impressions: Number(day.metrics?.impressions ?? 0),
            clicks: Number(day.metrics?.clicks ?? 0),
            cost: Number(day.metrics?.cost_micros ?? 0) / 1_000_000,
            conversions: Number(day.metrics?.conversions ?? 0),
            conversionsValue: Number(day.metrics?.conversions_value ?? 0)
          })),
          lastUpdated: new Date().toISOString()
        };

        accountDetails.push(accountData);
        console.log(`✅ Successfully processed account ${customerId}: ${topCampaigns.length} campaigns`);

      } catch (accountError) {
        console.error(`❌ Error processing account ${customerResource}:`, accountError.message);
        accountDetails.push({
          customerId: customerResource.replace('customers/', ''),
          error: accountError.message,
          lastUpdated: new Date().toISOString()
        });
      }
    }

    res.json({
      success: true,
      totalAccounts: accountDetails.length,
      managerAccount: '4037087680',
      accounts: accountDetails,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('🚨 Debug error:', error);
    res.status(500).json({ 
      error: 'Failed to extract account data', 
      details: error.message 
    });
  }
});

module.exports = router;