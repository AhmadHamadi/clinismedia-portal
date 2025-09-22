const express = require('express');
const axios = require('axios');
const router = express.Router();
const User = require('../models/User');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

// Facebook OAuth routes (authenticated)
router.get('/auth/:clinicId', authenticateToken, authorizeRole(['admin']), (req, res) => {
  const clinicId = req.params.clinicId;
  const redirectUri = process.env.FB_REDIRECT_URI;
  
  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=4066501436955681&redirect_uri=${encodeURIComponent(redirectUri)}&state=${clinicId}&scope=pages_show_list,pages_read_engagement,pages_manage_metadata,pages_read_user_content,pages_manage_posts,pages_manage_engagement`;
  
  res.json({ authUrl });
});

router.get('/callback', async (req, res) => {
  const { code, state: clinicId } = req.query;
  const redirectUri = process.env.FB_REDIRECT_URI;
  const clientId = '4066501436955681';
  const clientSecret = process.env.FB_APP_SECRET;

  console.log(`Facebook OAuth callback received for clinic: ${clinicId}`);

  try {
    // Exchange code for user access token
    const tokenRes = await axios.get(
      `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${clientId}&redirect_uri=${redirectUri}&client_secret=${clientSecret}&code=${code}`
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

    // Get list of pages
    const pagesRes = await axios.get(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${userAccessToken}`
    );
    const pages = pagesRes.data.data;

    console.log(`Found ${pages.length} Facebook pages for clinic: ${clinicId}`);

    // Redirect to frontend with the pages data
    const frontendUrl = `${process.env.FRONTEND_URL}/admin/facebook?pages=${encodeURIComponent(JSON.stringify(pages))}&userAccessToken=${userAccessToken}&tokenExpiry=${tokenExpiry}&clinicId=${clinicId}`;
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
    const meRes = await axios.get(`https://graph.facebook.com/v19.0/me?access_token=${pageAccessToken}`);
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
    
    const user = await User.findByIdAndUpdate(
      clinicId,
      {
        facebookPageId: pageId,
        facebookPageName: pageName,
        facebookAccessToken: pageAccessToken,
        facebookTokenExpiry: tokenExpiry || null,
      },
      { new: true }
    );
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    console.log(`Successfully connected Facebook page to clinic: ${user.name}`);
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
      const meRes = await axios.get(`https://graph.facebook.com/v19.0/me?access_token=${user.facebookAccessToken}`);
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
    
    const formatDate = (date) => {
      return date.toISOString().split('T')[0];
    };
    
    // Fetch Facebook insights
    const metrics = [
      { key: 'impressions', metric: 'page_impressions' },
      { key: 'reach', metric: 'page_impressions_unique' },
      { key: 'engagements', metric: 'page_post_engagements' },
      { key: 'followers', metric: 'page_fans' },
    ];
    const results = await Promise.all(metrics.map(async ({ key, metric }) => {
      try {
        const res = await axios.get(`https://graph.facebook.com/v19.0/${user.facebookPageId}/insights?metric=${metric}&period=day&since=${formatDate(startDate)}&until=${formatDate(endDate)}&access_token=${user.facebookAccessToken}`);
        return { key, values: res.data.data[0]?.values || [] };
      } catch (err) {
        console.error(`Failed to fetch metric ${metric}:`, err.response?.data || err.message);
        return { key, values: [] };
      }
    }));
    const metricsObj = Object.fromEntries(results.map(r => [r.key, r.values]));
    
    const insights = {
      pageInfo: {
        id: user.facebookPageId,
        name: user.facebookPageName,
      },
      period: {
        start: formatDate(startDate),
        end: formatDate(endDate),
      },
      metrics: metricsObj,
      summary: {
        totalImpressions: metricsObj.impressions.reduce((sum, val) => sum + (val.value || 0), 0) || 0,
        totalReach: metricsObj.reach.reduce((sum, val) => sum + (val.value || 0), 0) || 0,
        totalEngagements: metricsObj.engagements.reduce((sum, val) => sum + (val.value || 0), 0) || 0,
        currentFollowers: metricsObj.followers[metricsObj.followers.length - 1]?.value || 0,
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
