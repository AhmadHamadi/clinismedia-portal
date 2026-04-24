const express = require('express');
const axios = require('axios');
const router = express.Router();
const User = require('../models/User');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const FB_DIALOG_VERSION = 'v21.0';

function getFacebookClientId() {
  return process.env.FB_APP_ID || '4066501436955681';
}

function getFacebookRedirectUri(req) {
  if (process.env.FB_REDIRECT_URI) {
    return process.env.FB_REDIRECT_URI;
  }

  const host = req?.headers?.host || req?.headers?.['x-forwarded-host'];

  if (host) {
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      const port = host.split(':')[1] || process.env.PORT || 3000;
      return `http://localhost:${port}/api/facebook/callback`;
    }

    if (host.includes('clinimediaportal.ca')) {
      return 'https://api.clinimediaportal.ca/api/facebook/callback';
    }
  }

  return process.env.NODE_ENV === 'development'
    ? `http://localhost:${process.env.PORT || 3000}/api/facebook/callback`
    : 'https://api.clinimediaportal.ca/api/facebook/callback';
}

function getFacebookFrontendUrl(req) {
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }

  const redirectUri = process.env.FB_REDIRECT_URI || '';
  if (redirectUri.includes('api.clinimediaportal.ca') || redirectUri.includes('clinimediaportal.ca')) {
    return 'https://www.clinimediaportal.ca';
  }

  const host = req?.headers?.host || req?.headers?.['x-forwarded-host'];
  if (host) {
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      return `http://localhost:${process.env.VITE_PORT || 5173}`;
    }

    if (host.includes('clinimediaportal.ca')) {
      return 'https://www.clinimediaportal.ca';
    }
  }

  return process.env.NODE_ENV === 'development'
    ? `http://localhost:${process.env.VITE_PORT || 5173}`
    : 'https://www.clinimediaportal.ca';
}

async function fetchLinkedInstagramAccount(pageId, accessTokens = []) {
  const uniqueTokens = [...new Set(accessTokens.filter(Boolean))];
  const candidateFields = [
    'instagram_business_account{id,name,username}',
    'connected_instagram_account{id,name,username}',
  ];

  for (const accessToken of uniqueTokens) {
    for (const field of candidateFields) {
      try {
        const response = await axios.get(`${GRAPH_API_BASE}/${pageId}`, {
          params: {
            fields: field,
            access_token: accessToken,
          },
        });

        const fieldName = field.split('{')[0];
        const instagramAccount = response.data?.[fieldName];
        if (!instagramAccount?.id) {
          continue;
        }

        return {
          instagramAccountId: instagramAccount.id,
          instagramAccountName: instagramAccount.name || null,
          instagramUsername: instagramAccount.username || null,
        };
      } catch (error) {
        console.warn(
          `Failed to fetch ${field} for Facebook page ${pageId}:`,
          error.response?.data || error.message
        );
      }
    }
  }

  return null;
}

// Facebook OAuth routes (authenticated)
router.get('/auth/:clinicId', authenticateToken, authorizeRole(['admin']), (req, res) => {
  const clinicId = req.params.clinicId;
  const redirectUri = getFacebookRedirectUri(req);
  const clientId = getFacebookClientId();
  const scopes = [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_metadata',
    'pages_read_user_content',
    'pages_manage_posts',
    'pages_manage_engagement',
    'instagram_basic',
    'instagram_manage_insights',
  ];

  const authUrl = `https://www.facebook.com/${FB_DIALOG_VERSION}/dialog/oauth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${clinicId}&scope=${encodeURIComponent(scopes.join(','))}`;
  
  res.json({ authUrl });
});

router.get('/callback', async (req, res) => {
  const { code, state: clinicId } = req.query;
  const redirectUri = getFacebookRedirectUri(req);
  const clientId = getFacebookClientId();
  const clientSecret = process.env.FB_APP_SECRET;

  console.log(`Facebook OAuth callback received for clinic: ${clinicId}`);

  try {
    // Exchange code for user access token
    const tokenRes = await axios.get(
      `${GRAPH_API_BASE}/oauth/access_token?client_id=${clientId}&redirect_uri=${redirectUri}&client_secret=${clientSecret}&code=${code}`
    );
    const userAccessToken = tokenRes.data.access_token;
    const tokenExpiry = tokenRes.data.expires_in
      ? new Date(Date.now() + tokenRes.data.expires_in * 1000)
      : null;

    // Save the user access token to the admin's user record
    // (For now, just update the first admin user)
    const adminUser = await User.findOneAndUpdate(
      { role: 'admin' },
      {
        facebookUserAccessToken: userAccessToken,
        facebookUserTokenExpiry: tokenExpiry,
      },
      { new: true }
    );
    if (!adminUser) {
      console.warn('No admin user found to save Facebook user access token.');
    }

    // Also save the user access token to the specific clinic/customer
    // This allows them to access their own ad accounts
    const clinicUser = await User.findByIdAndUpdate(
      clinicId,
      {
        facebookUserAccessToken: userAccessToken,
        facebookUserTokenExpiry: tokenExpiry,
      },
      { new: true }
    );
    if (clinicUser) {
      console.log(`Saved Facebook user access token for clinic: ${clinicUser.name}`);
    }

    // Get list of pages
    const pagesRes = await axios.get(
      `${GRAPH_API_BASE}/me/accounts?access_token=${userAccessToken}`
    );
    const pages = pagesRes.data.data;

    console.log(`Found ${pages.length} Facebook pages for clinic: ${clinicId}`);

    // Redirect to frontend with the pages data
    const frontendUrl = `${getFacebookFrontendUrl(req)}/admin/facebook?pages=${encodeURIComponent(JSON.stringify(pages))}&userAccessToken=${userAccessToken}&tokenExpiry=${tokenExpiry}&clinicId=${clinicId}`;
    res.redirect(frontendUrl);
  } catch (error) {
    console.error('Facebook OAuth callback error:', error.response?.data || error.message);
    res.status(500).send('Facebook OAuth failed');
  }
});

// New endpoint: Save selected Facebook Page info to the user (clinic/customer)
// Only admins can save Facebook page connections
router.post('/save-page', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { clinicId, pageId, pageName, pageAccessToken, tokenExpiry } = req.body;
  
  console.log(`Saving Facebook page for clinic: ${clinicId}`);
  console.log(`Page details: ${pageName} (${pageId})`);

  if (!clinicId || !pageId || !pageAccessToken) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate that the provided token is a valid Page Access Token for the selected page
  try {
    const meRes = await axios.get(`${GRAPH_API_BASE}/me?access_token=${pageAccessToken}`);
    const tokenPageId = meRes.data.id;
    console.log('Token validation: /me returned id:', tokenPageId, 'Expected pageId:', pageId);
    if (tokenPageId !== pageId) {
      console.error('Provided access token does not match the selected page. Assignment rejected.');
      return res.status(400).json({ error: 'Provided access token does not match the selected page. Please reconnect Facebook and try again.' });
    }
  } catch (err) {
    console.error('Failed to validate page access token:', err.response?.data || err.message);
    return res.status(400).json({ error: 'Invalid or expired Page Access Token. Please reconnect Facebook and try again.' });
  }

  try {
    // First, check if this page is already connected to another clinic
    const existingConnection = await User.findOne({ 
      facebookPageId: pageId,
      _id: { $ne: clinicId } // Exclude the current clinic
    });
    
    if (existingConnection) {
      console.log(`Warning: Page ${pageName} is already connected to clinic: ${existingConnection.name}`);
      return res.status(400).json({ 
        error: `This Facebook page is already connected to clinic: ${existingConnection.name}. Please select a different page.` 
      });
    }

    const clinicUser = await User.findById(clinicId).select('facebookUserAccessToken');
    const adminUser = await User.findById(req.user.id).select('facebookUserAccessToken');
    const linkedInstagramAccount = await fetchLinkedInstagramAccount(pageId, [
      pageAccessToken,
      clinicUser?.facebookUserAccessToken,
      adminUser?.facebookUserAccessToken,
    ]);
    
    const user = await User.findByIdAndUpdate(
      clinicId,
      {
        facebookPageId: pageId,
        facebookPageName: pageName,
        instagramAccountId: linkedInstagramAccount?.instagramAccountId || null,
        instagramAccountName: linkedInstagramAccount?.instagramAccountName || null,
        instagramUsername: linkedInstagramAccount?.instagramUsername || null,
        facebookAccessToken: pageAccessToken,
        facebookTokenExpiry: tokenExpiry || null,
      },
      { new: true }
    );
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    console.log(`Successfully connected Facebook page to clinic: ${user.name}`);
    if (linkedInstagramAccount?.instagramAccountId) {
      console.log(`Linked Instagram professional account detected: ${linkedInstagramAccount.instagramUsername || linkedInstagramAccount.instagramAccountId}`);
    } else {
      console.log('No linked Instagram professional account was returned for this Facebook Page.');
    }
    res.json({ message: 'Facebook Page connected and saved!', user });
  } catch (error) {
    console.error('Error saving Facebook page:', error);
    res.status(500).json({ error: 'Failed to save Facebook Page info' });
  }
});

// Endpoint to disconnect Facebook page from a customer
router.patch('/disconnect/:clinicId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { clinicId } = req.params;
  
  try {
    const user = await User.findByIdAndUpdate(
      clinicId,
      {
        facebookPageId: null,
        facebookPageName: null,
        instagramAccountId: null,
        instagramAccountName: null,
        instagramUsername: null,
        facebookAccessToken: null,
        facebookTokenExpiry: null,
      },
      { new: true }
    );
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Facebook Page disconnected successfully!', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to disconnect Facebook Page' });
  }
});

// Get Facebook insights for a customer's connected page
router.get('/insights/:customerId', authenticateToken, async (req, res) => {
  const { customerId } = req.params;
  const { start, end } = req.query;
  
  try {
    // Verify the user is requesting their own data or is an admin
    if (req.user.role !== 'admin' && req.user.id !== customerId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const user = await User.findById(customerId);
    console.log('Customer Facebook assignment:', {
      id: user?._id,
      name: user?.name,
      facebookPageId: user?.facebookPageId,
      facebookPageName: user?.facebookPageName,
      facebookAccessToken: user?.facebookAccessToken,
      facebookTokenExpiry: user?.facebookTokenExpiry,
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.facebookPageId || !user.facebookAccessToken) {
      return res.status(404).json({ error: 'No Facebook page connected' });
    }

    // Validate that the saved token is a valid Page Access Token for the assigned page
    try {
      const meRes = await axios.get(`${GRAPH_API_BASE}/me?access_token=${user.facebookAccessToken}`);
      const tokenPageId = meRes.data.id;
      console.log('Insights token validation: /me returned id:', tokenPageId, 'Expected pageId:', user.facebookPageId);
      if (tokenPageId !== user.facebookPageId) {
        console.error('Saved access token does not match the assigned page. Insights fetch aborted.');
        return res.status(400).json({ error: 'Saved access token does not match the assigned page. Please reconnect Facebook and re-assign the page.' });
      }
    } catch (err) {
      console.error('Failed to validate saved page access token before insights fetch:', err.response?.data || err.message);
      return res.status(400).json({ error: 'Invalid or expired Page Access Token. Please reconnect Facebook and re-assign the page.' });
    }
    
    // Use custom date range if provided, else default to last 30 days
    let endDate = end ? new Date(end) : new Date();
    let startDate = start ? new Date(start) : new Date(endDate);
    if (!start) startDate.setDate(endDate.getDate() - 30);
    
    // Calculate previous month date range for comparison
    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const formatDate = (date) => {
      return date.toISOString().split('T')[0];
    };
    
    // Fetch Facebook insights for current period
    // 2026 metric set: per Meta's Page Insights deprecation (page_impressions
    // sunset Nov 15 2025, page_impressions_unique sunset Jun 15 2025), use
    // page_media_view (total impressions, counts repeats) and
    // page_total_media_view_unique (reach, unique users). These are DIFFERENT
    // metrics — reach <= impressions. Mapping the same metric to both was
    // hiding the distinction.
    // page_fans was also deprecated; we already use page_follows.
    const metrics = [
      { key: 'impressions', metric: 'page_media_view', period: 'day' },
      { key: 'reach', metric: 'page_total_media_view_unique', period: 'day' },
      { key: 'engagements', metric: 'page_post_engagements', period: 'day' },
      { key: 'followers', metric: 'page_follows', period: 'day' },
      { key: 'pageViews', metric: 'page_views_total', period: 'day' },
      { key: 'videoViews', metric: 'page_video_views', period: 'day' },
    ];
    
    // Helper function to fetch followers using the new page_follows metric
    const fetchFollowers = async (startDate, endDate) => {
      try {
        // ✅ FIXED: Use page_follows (page_fans is deprecated as of Nov 2025)
        const res = await axios.get(
          `${GRAPH_API_BASE}/${user.facebookPageId}/insights?metric=page_follows&period=day&since=${formatDate(startDate)}&until=${formatDate(endDate)}&access_token=${user.facebookAccessToken}`
        );
        
        let values = [];
        if (res.data.data && res.data.data.length > 0) {
          values = res.data.data[0].values || [];
        } else if (res.data.values) {
          values = res.data.values || [];
        }
        
        if (Array.isArray(values) && values.length > 0) {
          console.log(`✅ page_follows (day period): ${values.length} items`);
          return values;
        } else {
          console.warn(`⚠️ page_follows returned empty data`);
          return [];
        }
      } catch (err) {
        console.error(`❌ Failed to fetch page_follows:`, err.response?.data?.error || err.message);
        return [];
      }
    };
    
    const [currentResults, previousResults] = await Promise.all([
      // Current period
      Promise.all(metrics.map(async ({ key, metric, period = 'day' }) => {
        // Special handling for followers using page_follows metric
        if (key === 'followers') {
          const values = await fetchFollowers(startDate, endDate);
          return { key, values };
        }
        
        try {
          const res = await axios.get(`${GRAPH_API_BASE}/${user.facebookPageId}/insights?metric=${metric}&period=${period}&since=${formatDate(startDate)}&until=${formatDate(endDate)}&access_token=${user.facebookAccessToken}`);
          
          // Log the API response structure for debugging
          console.log(`📊 Facebook API Response for ${metric} (${key}, period=${period}):`, {
            hasData: !!res.data.data,
            dataLength: res.data.data?.length || 0,
            firstItem: res.data.data?.[0] ? {
              name: res.data.data[0].name,
              period: res.data.data[0].period,
              valuesCount: res.data.data[0].values?.length || 0,
              sampleValue: res.data.data[0].values?.[0] || null
            } : null
          });
          
          // Extract values array - handle different possible response structures
          let values = [];
          if (res.data.data && res.data.data.length > 0) {
            // Standard structure: res.data.data[0].values
            values = res.data.data[0].values || [];
          } else if (res.data.values) {
            // Alternative structure: res.data.values
            values = res.data.values || [];
          }
          
          // Ensure values is an array and has the expected structure
          if (!Array.isArray(values)) {
            console.warn(`⚠️ Values for ${metric} is not an array:`, typeof values);
            values = [];
          }
          
          console.log(`✅ Extracted ${values.length} values for ${metric} (${key})`);
          if (values.length > 0) {
            console.log(`   Sample value:`, values[0]);
          }
          
          return { key, values };
        } catch (err) {
          console.error(`❌ Failed to fetch metric ${metric} (${key}, period=${period}):`, err.response?.data || err.message);
          return { key, values: [] };
        }
      })),
      // Previous period
      Promise.all(metrics.map(async ({ key, metric, period = 'day' }) => {
        // Special handling for followers using page_follows metric
        if (key === 'followers') {
          const values = await fetchFollowers(prevStartDate, prevEndDate);
          return { key, values };
        }
        
        try {
          const res = await axios.get(`${GRAPH_API_BASE}/${user.facebookPageId}/insights?metric=${metric}&period=${period}&since=${formatDate(prevStartDate)}&until=${formatDate(prevEndDate)}&access_token=${user.facebookAccessToken}`);
          
          // Extract values array - handle different possible response structures
          let values = [];
          if (res.data.data && res.data.data.length > 0) {
            values = res.data.data[0].values || [];
          } else if (res.data.values) {
            values = res.data.values || [];
          }
          
          // Ensure values is an array
          if (!Array.isArray(values)) {
            values = [];
          }
          
          return { key, values };
        } catch (err) {
          console.error(`❌ Failed to fetch previous period metric ${metric} (${key}, period=${period}):`, err.response?.data || err.message);
          return { key, values: [] };
        }
      }))
    ]);
    
    const currentMetricsObj = Object.fromEntries(currentResults.map(r => [r.key, r.values]));
    const previousMetricsObj = Object.fromEntries(previousResults.map(r => [r.key, r.values]));
    
    // Log the processed metrics for debugging
    console.log('📊 Processed Metrics Structure:');
    console.log('   impressions:', currentMetricsObj.impressions?.length || 0, 'items');
    console.log('   followers:', currentMetricsObj.followers?.length || 0, 'items');
    console.log('   reach:', currentMetricsObj.reach?.length || 0, 'items');
    console.log('   engagements:', currentMetricsObj.engagements?.length || 0, 'items');
    console.log('   pageViews:', currentMetricsObj.pageViews?.length || 0, 'items');
    console.log('   videoViews:', currentMetricsObj.videoViews?.length || 0, 'items');
    
    // Ensure all metrics are arrays (defensive programming)
    Object.keys(currentMetricsObj).forEach(key => {
      if (!Array.isArray(currentMetricsObj[key])) {
        console.warn(`⚠️ ${key} is not an array, converting to empty array`);
        currentMetricsObj[key] = [];
      }
    });
    Object.keys(previousMetricsObj).forEach(key => {
      if (!Array.isArray(previousMetricsObj[key])) {
        previousMetricsObj[key] = [];
      }
    });
    
    // Helper function to calculate percentage change
    const calculatePercentageChange = (previous, current) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };
    
    const insights = {
      pageInfo: {
        id: user.facebookPageId,
        name: user.facebookPageName,
      },
      period: {
        start: formatDate(startDate),
        end: formatDate(endDate),
      },
      metrics: {
        impressions: Array.isArray(currentMetricsObj.impressions) ? currentMetricsObj.impressions : [],
        reach: Array.isArray(currentMetricsObj.reach) ? currentMetricsObj.reach : [],
        engagements: Array.isArray(currentMetricsObj.engagements) ? currentMetricsObj.engagements : [],
        followers: Array.isArray(currentMetricsObj.followers) ? currentMetricsObj.followers : [],
        pageViews: Array.isArray(currentMetricsObj.pageViews) ? currentMetricsObj.pageViews : [],
        videoViews: Array.isArray(currentMetricsObj.videoViews) ? currentMetricsObj.videoViews : [],
      },
      summary: {
        totalImpressions: (Array.isArray(currentMetricsObj.impressions) ? currentMetricsObj.impressions : []).reduce((sum, val) => sum + (val?.value || 0), 0) || 0,
        totalReach: (Array.isArray(currentMetricsObj.reach) ? currentMetricsObj.reach : []).reduce((sum, val) => sum + (val?.value || 0), 0) || 0,
        totalEngagements: (Array.isArray(currentMetricsObj.engagements) ? currentMetricsObj.engagements : []).reduce((sum, val) => sum + (val?.value || 0), 0) || 0,
        currentFollowers: (Array.isArray(currentMetricsObj.followers) && currentMetricsObj.followers.length > 0) ? (currentMetricsObj.followers[currentMetricsObj.followers.length - 1]?.value || 0) : 0,
        totalPageViews: (Array.isArray(currentMetricsObj.pageViews) ? currentMetricsObj.pageViews : []).reduce((sum, val) => sum + (val?.value || 0), 0) || 0,
        totalVideoViews: (Array.isArray(currentMetricsObj.videoViews) ? currentMetricsObj.videoViews : []).reduce((sum, val) => sum + (val?.value || 0), 0) || 0,
      },
      previousSummary: {
        totalImpressions: (Array.isArray(previousMetricsObj.impressions) ? previousMetricsObj.impressions : []).reduce((sum, val) => sum + (val?.value || 0), 0) || 0,
        totalReach: (Array.isArray(previousMetricsObj.reach) ? previousMetricsObj.reach : []).reduce((sum, val) => sum + (val?.value || 0), 0) || 0,
        totalEngagements: (Array.isArray(previousMetricsObj.engagements) ? previousMetricsObj.engagements : []).reduce((sum, val) => sum + (val?.value || 0), 0) || 0,
        currentFollowers: (Array.isArray(previousMetricsObj.followers) && previousMetricsObj.followers.length > 0) ? (previousMetricsObj.followers[previousMetricsObj.followers.length - 1]?.value || 0) : 0,
        totalPageViews: (Array.isArray(previousMetricsObj.pageViews) ? previousMetricsObj.pageViews : []).reduce((sum, val) => sum + (val?.value || 0), 0) || 0,
        totalVideoViews: (Array.isArray(previousMetricsObj.videoViews) ? previousMetricsObj.videoViews : []).reduce((sum, val) => sum + (val?.value || 0), 0) || 0,
      },
      comparisons: {
        impressionsChange: calculatePercentageChange(
          (Array.isArray(previousMetricsObj.impressions) ? previousMetricsObj.impressions : []).reduce((sum, val) => sum + (val?.value || 0), 0) || 0,
          (Array.isArray(currentMetricsObj.impressions) ? currentMetricsObj.impressions : []).reduce((sum, val) => sum + (val?.value || 0), 0) || 0
        ),
        reachChange: calculatePercentageChange(
          (Array.isArray(previousMetricsObj.reach) ? previousMetricsObj.reach : []).reduce((sum, val) => sum + (val?.value || 0), 0) || 0,
          (Array.isArray(currentMetricsObj.reach) ? currentMetricsObj.reach : []).reduce((sum, val) => sum + (val?.value || 0), 0) || 0
        ),
        engagementsChange: calculatePercentageChange(
          (Array.isArray(previousMetricsObj.engagements) ? previousMetricsObj.engagements : []).reduce((sum, val) => sum + (val?.value || 0), 0) || 0,
          (Array.isArray(currentMetricsObj.engagements) ? currentMetricsObj.engagements : []).reduce((sum, val) => sum + (val?.value || 0), 0) || 0
        ),
        followersChange: calculatePercentageChange(
          (Array.isArray(previousMetricsObj.followers) && previousMetricsObj.followers.length > 0) ? (previousMetricsObj.followers[previousMetricsObj.followers.length - 1]?.value || 0) : 0,
          (Array.isArray(currentMetricsObj.followers) && currentMetricsObj.followers.length > 0) ? (currentMetricsObj.followers[currentMetricsObj.followers.length - 1]?.value || 0) : 0
        ),
        pageViewsChange: calculatePercentageChange(
          (Array.isArray(previousMetricsObj.pageViews) ? previousMetricsObj.pageViews : []).reduce((sum, val) => sum + (val?.value || 0), 0) || 0,
          (Array.isArray(currentMetricsObj.pageViews) ? currentMetricsObj.pageViews : []).reduce((sum, val) => sum + (val?.value || 0), 0) || 0
        ),
        videoViewsChange: calculatePercentageChange(
          (Array.isArray(previousMetricsObj.videoViews) ? previousMetricsObj.videoViews : []).reduce((sum, val) => sum + (val?.value || 0), 0) || 0,
          (Array.isArray(currentMetricsObj.videoViews) ? currentMetricsObj.videoViews : []).reduce((sum, val) => sum + (val?.value || 0), 0) || 0
        ),
      }
    };
    
    res.json(insights);
  } catch (error) {
    console.error('Facebook insights error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch Facebook insights' });
  }
});

// Endpoint to get the admin's Facebook user access token and expiry
router.get('/admin-token', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) return res.status(404).json({ error: 'Admin user not found' });
    res.json({
      facebookUserAccessToken: adminUser.facebookUserAccessToken,
      facebookUserTokenExpiry: adminUser.facebookUserTokenExpiry,
    });
  } catch (error) {
    console.error('Error fetching admin Facebook user access token:', error);
    res.status(500).json({ error: 'Failed to fetch admin Facebook user access token' });
  }
});

module.exports = router; 
