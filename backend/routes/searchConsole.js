const express = require('express');
const { google } = require('googleapis');
const axios = require('axios');
const crypto = require('crypto');
const User = require('../models/User');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');
const {
  buildSearchConsoleUpdate,
  deriveSearchConsolePropertyFromWebsite,
  SearchConsoleValidationError,
} = require('../utils/searchConsoleProperty');
const { findGoogleIntegrationAdminUser } = require('../utils/googleIntegrationAdminUser');

const router = express.Router();

const READONLY_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const oauthStateStore = new Map();
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function cleanupExpiredOauthStates() {
  const now = Date.now();
  for (const [state, entry] of oauthStateStore.entries()) {
    if (!entry || entry.expiresAt <= now) {
      oauthStateStore.delete(state);
    }
  }
}

function getSearchConsoleRedirectUri(req) {
  if (process.env.SEARCH_CONSOLE_REDIRECT_URI) {
    return process.env.SEARCH_CONSOLE_REDIRECT_URI;
  }

  const protocol = req?.protocol || (req?.headers?.['x-forwarded-proto'] || 'http');
  const host = req?.headers?.host || req?.headers?.['x-forwarded-host'];

  if (host) {
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      const port = host.split(':')[1] || process.env.PORT || 5000;
      return `http://localhost:${port}/api/search-console/callback`;
    }

    if (host.includes('clinimediaportal.ca')) {
      return 'https://api.clinimediaportal.ca/api/search-console/callback';
    }

    return `${protocol}://${host}/api/search-console/callback`;
  }

  return 'https://api.clinimediaportal.ca/api/search-console/callback';
}

function getFrontendUrl(req) {
  const host = req?.headers?.host || req?.headers?.['x-forwarded-host'];
  if (host && (host.includes('localhost') || host.includes('127.0.0.1'))) {
    return `http://localhost:${process.env.VITE_PORT || 5173}`;
  }

  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }

  return 'https://www.clinimediaportal.ca';
}

function createOAuthClient(req) {
  return new google.auth.OAuth2(
    process.env.SEARCH_CONSOLE_CLIENT_ID,
    process.env.SEARCH_CONSOLE_CLIENT_SECRET,
    getSearchConsoleRedirectUri(req)
  );
}

async function refreshSearchConsoleAccessToken(adminUser, req) {
  if (!adminUser?.searchConsoleRefreshToken) {
    throw new Error('Search Console is not connected for the portal admin.');
  }

  const expiresAt = adminUser.searchConsoleTokenExpiry ? new Date(adminUser.searchConsoleTokenExpiry).getTime() : 0;
  const needsRefresh = !adminUser.searchConsoleAccessToken || expiresAt <= Date.now() + 60 * 1000;

  if (!needsRefresh) {
    return adminUser.searchConsoleAccessToken;
  }

  const payload = new URLSearchParams({
    client_id: process.env.SEARCH_CONSOLE_CLIENT_ID,
    client_secret: process.env.SEARCH_CONSOLE_CLIENT_SECRET,
    refresh_token: adminUser.searchConsoleRefreshToken,
    grant_type: 'refresh_token',
  });

  const response = await axios.post('https://oauth2.googleapis.com/token', payload.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  adminUser.searchConsoleAccessToken = response.data.access_token;
  adminUser.searchConsoleTokenExpiry = new Date(Date.now() + (response.data.expires_in || 3600) * 1000);
  await adminUser.save();

  return adminUser.searchConsoleAccessToken;
}

async function getAuthorizedSearchConsoleClient(req) {
  const adminUser = await findGoogleIntegrationAdminUser(req, 'searchConsole');

  if (!adminUser) {
    throw new Error('No admin user found for Search Console integration.');
  }

  const accessToken = await refreshSearchConsoleAccessToken(adminUser, req);
  const oauth2Client = createOAuthClient(req);
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: adminUser.searchConsoleRefreshToken,
  });

  return { oauth2Client, adminUser };
}

function toDateString(date) {
  return new Date(date).toISOString().split('T')[0];
}

function sumRows(rows = [], key) {
  return rows.reduce((sum, row) => sum + (row[key] || 0), 0);
}

async function runSearchAnalyticsQuery(webmasters, siteUrl, request) {
  const response = await webmasters.searchanalytics.query({
    siteUrl,
    requestBody: request,
  });

  return response.data.rows || [];
}

async function buildSearchConsolePerformance(webmasters, siteUrl, startDate, endDate) {
  const baseRequest = {
    startDate,
    endDate,
    dataState: 'final',
    type: 'web',
    rowLimit: 1000,
  };

  const [dailyRows, queryRows, pageRows, deviceRows, countryRows] = await Promise.all([
    runSearchAnalyticsQuery(webmasters, siteUrl, {
      ...baseRequest,
      dimensions: ['date'],
    }),
    runSearchAnalyticsQuery(webmasters, siteUrl, {
      ...baseRequest,
      dimensions: ['query'],
      rowLimit: 10,
    }),
    runSearchAnalyticsQuery(webmasters, siteUrl, {
      ...baseRequest,
      dimensions: ['page'],
      rowLimit: 10,
    }),
    runSearchAnalyticsQuery(webmasters, siteUrl, {
      ...baseRequest,
      dimensions: ['device'],
      rowLimit: 10,
    }),
    runSearchAnalyticsQuery(webmasters, siteUrl, {
      ...baseRequest,
      dimensions: ['country'],
      rowLimit: 10,
    }),
  ]);

  const totalClicks = sumRows(dailyRows, 'clicks');
  const totalImpressions = sumRows(dailyRows, 'impressions');
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  const weightedPosition = totalImpressions > 0
    ? dailyRows.reduce((sum, row) => sum + ((row.position || 0) * (row.impressions || 0)), 0) / totalImpressions
    : 0;

  return {
    summary: {
      totalClicks,
      totalImpressions,
      avgCtr,
      avgPosition: weightedPosition,
    },
    trend: dailyRows.map((row) => ({
      date: row.keys?.[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    })),
    topQueries: queryRows.map((row) => ({
      query: row.keys?.[0] || 'Unknown',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    })),
    topPages: pageRows.map((row) => ({
      page: row.keys?.[0] || 'Unknown',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    })),
    devices: deviceRows.map((row) => ({
      device: row.keys?.[0] || 'Unknown',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    })),
    countries: countryRows.map((row) => ({
      country: row.keys?.[0] || 'Unknown',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    })),
  };
}

function getCustomerContext(req) {
  if (req.user.role === 'receptionist' && req.user.parentCustomerId) {
    return req.user.parentCustomerId;
  }

  return req.user.id;
}

router.get('/auth/admin-connect', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    if (!process.env.SEARCH_CONSOLE_CLIENT_ID || !process.env.SEARCH_CONSOLE_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Search Console client credentials are not configured on the server.' });
    }

    cleanupExpiredOauthStates();
    const state = crypto.randomBytes(32).toString('hex');
    oauthStateStore.set(state, {
      userId: req.user.id,
      expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
    });

    const oauth2Client = createOAuthClient(req);
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [READONLY_SCOPE],
      state,
    });

    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating Search Console auth URL:', error);
    res.status(500).json({ error: 'Failed to start Search Console connection' });
  }
});

router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).send('Missing Search Console OAuth callback parameters.');
    }

    cleanupExpiredOauthStates();
    const stateEntry = typeof state === 'string' ? oauthStateStore.get(state) : null;
    if (!stateEntry || stateEntry.expiresAt <= Date.now()) {
      if (typeof state === 'string') {
        oauthStateStore.delete(state);
      }
      return res.status(400).send('Invalid or expired Search Console OAuth state.');
    }
    oauthStateStore.delete(state);

    const oauth2Client = createOAuthClient(req);
    const tokenResponse = await oauth2Client.getToken(code);
    const tokens = tokenResponse.tokens;

    const adminUser = await User.findOne({ _id: stateEntry.userId, role: 'admin' });
    if (!adminUser) {
      return res.status(404).send('Admin user not found for Search Console callback.');
    }

    adminUser.searchConsoleAccessToken = tokens.access_token || null;
    if (tokens.refresh_token) {
      adminUser.searchConsoleRefreshToken = tokens.refresh_token;
    }
    adminUser.searchConsoleTokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
    await adminUser.save();

    res.redirect(`${getFrontendUrl(req)}/admin/search-console?search_console_connected=true`);
  } catch (error) {
    console.error('Search Console callback error:', error.response?.data || error.message || error);
    res.status(500).send('Search Console OAuth failed');
  }
});

router.get('/status', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const adminUser = await findGoogleIntegrationAdminUser(req, 'searchConsole');

    res.json({
      connected: !!(adminUser?.searchConsoleRefreshToken || adminUser?.searchConsoleAccessToken),
      tokenExpiry: adminUser?.searchConsoleTokenExpiry || null,
      hasRefreshToken: !!adminUser?.searchConsoleRefreshToken,
    });
  } catch (error) {
    console.error('Error fetching Search Console status:', error);
    res.status(500).json({ error: 'Failed to fetch Search Console status' });
  }
});

router.get('/mappings', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const customers = await User.find({ role: 'customer' })
      .select('name email location websiteUrl searchConsolePropertyUrl')
      .sort({ name: 1 })
      .lean();

    res.json({ customers });
  } catch (error) {
    console.error('Error fetching Search Console mappings:', error);
    res.status(500).json({ error: 'Failed to fetch Search Console mappings' });
  }
});

router.post('/save-mapping', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { customerId, websiteUrl } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const updateData = buildSearchConsoleUpdate({ websiteUrl });

    const customer = await User.findOneAndUpdate(
      { _id: customerId, role: 'customer' },
      updateData,
      { new: true }
    )
      .select('name email location websiteUrl searchConsolePropertyUrl')
      .lean();

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({
      success: true,
      message: 'Search Console website mapping saved successfully',
      customer,
      derivedProperty: customer.websiteUrl ? deriveSearchConsolePropertyFromWebsite(customer.websiteUrl) : null,
    });
  } catch (error) {
    console.error('Error saving Search Console mapping:', error);
    const statusCode = error instanceof SearchConsoleValidationError ? 400 : 500;
    res.status(statusCode).json({ error: error.message || 'Failed to save Search Console mapping' });
  }
});

router.get('/my-overview', authenticateToken, authorizeRole(['customer', 'receptionist']), async (req, res) => {
  try {
    const customerId = getCustomerContext(req);

    const customer = await User.findOne({ _id: customerId, role: 'customer' })
      .select('name websiteUrl searchConsolePropertyUrl')
      .lean();

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const adminUser = await findGoogleIntegrationAdminUser(req, 'searchConsole');
    const apiReady = !!(customer.searchConsolePropertyUrl && (adminUser?.searchConsoleRefreshToken || adminUser?.searchConsoleAccessToken));

    res.json({
      customer: {
        _id: customer._id,
        name: customer.name,
        websiteUrl: customer.websiteUrl || null,
        searchConsolePropertyUrl: customer.searchConsolePropertyUrl || null,
        searchConsoleConnected: !!customer.searchConsolePropertyUrl,
      },
      apiReady,
      message: !customer.searchConsolePropertyUrl
        ? 'No Search Console property has been mapped for this clinic yet.'
        : apiReady
          ? 'Search Console is connected and ready to query live data for this clinic.'
          : 'Search Console property is mapped, but the portal admin still needs to connect the Search Console Google account.',
    });
  } catch (error) {
    console.error('Error fetching Search Console overview:', error);
    res.status(500).json({ error: 'Failed to fetch Search Console overview' });
  }
});

router.get('/my-performance', authenticateToken, authorizeRole(['customer', 'receptionist']), async (req, res) => {
  try {
    const customerId = getCustomerContext(req);
    const { from, to } = req.query;

    const endDate = to ? new Date(to) : new Date();
    const startDate = from ? new Date(from) : new Date(endDate.getTime() - 29 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date range' });
    }

    const customer = await User.findOne({ _id: customerId, role: 'customer' })
      .select('name websiteUrl searchConsolePropertyUrl')
      .lean();

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    if (!customer.searchConsolePropertyUrl) {
      return res.status(400).json({ error: 'No Search Console property is mapped for this clinic yet.' });
    }

    const { oauth2Client } = await getAuthorizedSearchConsoleClient(req);
    const webmasters = google.webmasters({ version: 'v3', auth: oauth2Client });
    const performance = await buildSearchConsolePerformance(
      webmasters,
      customer.searchConsolePropertyUrl,
      toDateString(startDate),
      toDateString(endDate)
    );

    res.json({
      customer: {
        name: customer.name,
        websiteUrl: customer.websiteUrl || null,
        searchConsolePropertyUrl: customer.searchConsolePropertyUrl,
      },
      period: {
        start: toDateString(startDate),
        end: toDateString(endDate),
      },
      ...performance,
    });
  } catch (error) {
    console.error('Error fetching Search Console performance:', error.response?.data || error.message || error);
    res.status(500).json({
      error: 'Failed to fetch Search Console performance',
      details: error.message || 'Unknown Search Console error',
    });
  }
});

router.patch('/disconnect/:customerId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { customerId } = req.params;

    const customer = await User.findOneAndUpdate(
      { _id: customerId, role: 'customer' },
      { websiteUrl: null, searchConsolePropertyUrl: null },
      { new: true }
    )
      .select('name email location websiteUrl searchConsolePropertyUrl')
      .lean();

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({
      success: true,
      message: 'Search Console property disconnected successfully',
      customer,
    });
  } catch (error) {
    console.error('Error disconnecting Search Console property:', error);
    res.status(500).json({ error: 'Failed to disconnect Search Console property' });
  }
});

module.exports = router;
module.exports.buildSearchConsolePerformance = buildSearchConsolePerformance;
module.exports.getAuthorizedSearchConsoleClient = getAuthorizedSearchConsoleClient;
