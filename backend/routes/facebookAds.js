const express = require('express');
const axios = require('axios');
const router = express.Router();
const User = require('../models/User');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

// Get Facebook Ads insights for a customer
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
    
    if (!user.facebookAccessToken) {
      return res.status(404).json({ error: 'Facebook Ads not connected' });
    }
    
    // TODO: Implement actual Facebook Marketing API calls here
    // For now, return comprehensive mock data
    const mockData = {
      totalImpressions: Math.floor(Math.random() * 50000) + 15000,
      totalClicks: Math.floor(Math.random() * 2000) + 500,
      totalSpend: Math.random() * 2000 + 500,
      ctr: Math.random() * 5 + 2, // 2-7%
      cpc: Math.random() * 3 + 0.5, // Cost per click
      cpm: Math.random() * 30 + 10, // Cost per mille
      reach: Math.floor(Math.random() * 30000) + 10000,
      frequency: Math.random() * 3 + 1, // 1-4
      totalLeads: Math.floor(Math.random() * 100) + 20,
      leadCost: Math.random() * 50 + 15,
      conversionRate: Math.random() * 5 + 2, // 2-7%
      roas: Math.random() * 8 + 2, // 2-10x
      lastUpdated: new Date().toISOString()
    };
    
    res.json(mockData);
  } catch (error) {
    console.error('Facebook Ads insights error:', error);
    res.status(500).json({ error: 'Failed to fetch Facebook Ads insights' });
  }
});

// Get Facebook Ads campaigns for a customer
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
    
    if (!user.facebookAccessToken) {
      return res.status(404).json({ error: 'Facebook Ads not connected' });
    }
    
    // TODO: Implement Facebook Marketing API calls here
    // For now, return mock campaign data
    const mockCampaigns = [
      {
        id: '123456789012345',
        name: 'Lead Generation Campaign',
        status: 'ACTIVE',
        objective: 'LEAD_GENERATION',
        impressions: Math.floor(Math.random() * 20000) + 10000,
        clicks: Math.floor(Math.random() * 800) + 200,
        spend: Math.random() * 800 + 200,
        reach: Math.floor(Math.random() * 15000) + 5000,
        leads: Math.floor(Math.random() * 50) + 10,
        ctr: Math.random() * 4 + 2,
        cpc: Math.random() * 3 + 0.5,
        roas: Math.random() * 6 + 3
      },
      {
        id: '123456789012346',
        name: 'Traffic Campaign',
        status: 'ACTIVE',
        objective: 'TRAFFIC',
        impressions: Math.floor(Math.random() * 15000) + 8000,
        clicks: Math.floor(Math.random() * 600) + 150,
        spend: Math.random() * 500 + 100,
        reach: Math.floor(Math.random() * 12000) + 4000,
        leads: Math.floor(Math.random() * 30) + 5,
        ctr: Math.random() * 3 + 1.5,
        cpc: Math.random() * 2 + 0.3,
        roas: Math.random() * 5 + 2
      },
      {
        id: '123456789012347',
        name: 'Brand Awareness Campaign',
        status: 'PAUSED',
        objective: 'BRAND_AWARENESS',
        impressions: Math.floor(Math.random() * 10000) + 5000,
        clicks: Math.floor(Math.random() * 300) + 100,
        spend: Math.random() * 300 + 50,
        reach: Math.floor(Math.random() * 8000) + 3000,
        leads: Math.floor(Math.random() * 15) + 2,
        ctr: Math.random() * 2 + 1,
        cpc: Math.random() * 1.5 + 0.2,
        roas: Math.random() * 4 + 1
      }
    ];
    
    res.json(mockCampaigns);
  } catch (error) {
    console.error('Facebook Ads campaigns error:', error);
    res.status(500).json({ error: 'Failed to fetch Facebook Ads campaigns' });
  }
});

// Get Facebook Ads account info for a customer
router.get('/account/:customerId', authenticateToken, async (req, res) => {
  try {
    const { customerId } = req.params;
    
    // Verify the user is requesting their own data or is an admin
    if (req.user.role !== 'admin' && req.user.id !== customerId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const user = await User.findById(customerId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.facebookAccessToken) {
      return res.status(404).json({ error: 'Facebook Ads not connected' });
    }
    
    // TODO: Implement Facebook Marketing API calls here
    // For now, return mock account data
    const mockAccount = {
      id: '123456789',
      name: `${user.name} - Facebook Ads Account`,
      currency: 'CAD',
      timeZone: 'America/Toronto',
      businessName: user.name || 'Business Account'
    };
    
    res.json(mockAccount);
  } catch (error) {
    console.error('Facebook Ads account error:', error);
    res.status(500).json({ error: 'Failed to fetch Facebook Ads account' });
  }
});

// Customer endpoints (for customers to view their own Facebook Ads data)
// Get Facebook Ads insights for current customer
router.get('/insights/me', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.id;
    const { startDate, endDate, forceRefresh } = req.query;
    
    const user = await User.findById(customerId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.facebookUserAccessToken) {
      return res.status(404).json({ error: 'Facebook not connected. Please contact your administrator to connect your Facebook account first.' });
    }

    // Validate that the saved user access token is valid
    try {
      const meRes = await axios.get(`https://graph.facebook.com/v19.0/me?access_token=${user.facebookUserAccessToken}`);
      console.log('Facebook Ads user token validation: /me returned user:', meRes.data.name);
    } catch (err) {
      console.error('Failed to validate saved user access token before Facebook Ads fetch:', err.response?.data || err.message);
      return res.status(400).json({ error: 'Invalid or expired User Access Token. Please reconnect Facebook.' });
    }

    // Use custom date range if provided, else default to last 30 days
    let endDateObj = endDate ? new Date(endDate) : new Date();
    let startDateObj = startDate ? new Date(startDate) : new Date(endDateObj);
    if (!startDate) startDateObj.setDate(endDateObj.getDate() - 30);
    
    const formatDate = (date) => {
      return date.toISOString().split('T')[0];
    };

        // Try to fetch Facebook Ads data using the user access token
        // This should work if the user has ads_read permission and ad account access
        try {
          console.log(`Attempting to fetch Facebook Ads data for user ${user.name} with ads_read permission...`);
          
          // First, try to get ad accounts associated with this user
          const adAccountsRes = await axios.get(`https://graph.facebook.com/v19.0/me/adaccounts?access_token=${user.facebookUserAccessToken}`);
          
          console.log('Ad accounts response:', adAccountsRes.data);
      
      if (adAccountsRes.data.data && adAccountsRes.data.data.length > 0) {
        const adAccountId = adAccountsRes.data.data[0].id;
        console.log(`Found ad account ${adAccountId} for user ${user.name}`);
        
        // Get insights from the ad account
        const insightsRes = await axios.get(`https://graph.facebook.com/v19.0/${adAccountId}/insights?fields=impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions&time_range={'since':'${formatDate(startDateObj)}','until':'${formatDate(endDateObj)}'}&access_token=${user.facebookUserAccessToken}`);
        
        console.log('Insights response:', insightsRes.data);
        
        const insightsData = insightsRes.data.data[0] || {};
        const actions = insightsData.actions || [];
        
        // Extract lead actions
        const leadAction = actions.find(action => action.action_type === 'lead');
        const totalLeads = leadAction ? parseInt(leadAction.value) : 0;
        
        const realData = {
          totalImpressions: parseInt(insightsData.impressions || 0),
          totalClicks: parseInt(insightsData.clicks || 0),
          totalSpend: parseFloat(insightsData.spend || 0),
          ctr: parseFloat(insightsData.ctr || 0),
          cpc: parseFloat(insightsData.cpc || 0),
          cpm: parseFloat(insightsData.cpm || 0),
          reach: parseInt(insightsData.reach || 0),
          frequency: parseFloat(insightsData.frequency || 0),
          totalLeads: totalLeads,
          leadCost: totalLeads > 0 ? parseFloat(insightsData.spend || 0) / totalLeads : 0,
          conversionRate: insightsData.clicks > 0 ? (totalLeads / insightsData.clicks) * 100 : 0,
          roas: insightsData.spend > 0 ? (totalLeads * 50) / parseFloat(insightsData.spend || 1) : 0, // Assuming $50 value per lead
          lastUpdated: new Date().toISOString(),
          source: 'real_facebook_ads_api'
        };
        
        console.log('Successfully fetched real Facebook Ads data:', realData);
        return res.json(realData);
      } else {
        console.log('No ad accounts found for this Facebook user, using mock data');
      }
        } catch (adsError) {
          console.log('Could not fetch real Facebook Ads data, using mock data:', adsError.response?.data || adsError.message);
          console.log('Error details:', adsError.response?.status, adsError.response?.statusText);
        }
    
    // Fallback to mock data if no ad account access or API fails
    const mockData = {
      totalImpressions: Math.floor(Math.random() * 50000) + 15000,
      totalClicks: Math.floor(Math.random() * 2000) + 500,
      totalSpend: Math.random() * 2000 + 500,
      ctr: Math.random() * 5 + 2, // 2-7%
      cpc: Math.random() * 3 + 0.5, // Cost per click
      cpm: Math.random() * 30 + 10, // Cost per mille
      reach: Math.floor(Math.random() * 30000) + 10000,
      frequency: Math.random() * 3 + 1, // 1-4
      totalLeads: Math.floor(Math.random() * 100) + 20,
      leadCost: Math.random() * 50 + 15,
      conversionRate: Math.random() * 5 + 2, // 2-7%
      roas: Math.random() * 8 + 2, // 2-10x
      lastUpdated: new Date().toISOString(),
      source: 'mock_data_fallback',
      note: 'Using mock data. To see real Facebook Ads data, ensure your Facebook page has ad account access and the page token includes ads_read permission.'
    };
    
    res.json(mockData);
  } catch (error) {
    console.error('Customer Facebook Ads insights error:', error);
    res.status(500).json({ error: 'Failed to fetch Facebook Ads insights' });
  }
});

// Get Facebook Ads campaigns for current customer
router.get('/campaigns/me', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.id;
    const { startDate, endDate } = req.query;
    
    const user = await User.findById(customerId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.facebookUserAccessToken) {
      return res.status(404).json({ error: 'Facebook not connected. Please contact your administrator to connect your Facebook account first.' });
    }

    // Validate that the saved user access token is valid
    try {
      const meRes = await axios.get(`https://graph.facebook.com/v19.0/me?access_token=${user.facebookUserAccessToken}`);
      console.log('Facebook Ads campaigns user token validation: /me returned user:', meRes.data.name);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid or expired User Access Token. Please reconnect Facebook.' });
    }

    // Use custom date range if provided, else default to last 30 days
    let endDateObj = endDate ? new Date(endDate) : new Date();
    let startDateObj = startDate ? new Date(startDate) : new Date(endDateObj);
    if (!startDate) startDateObj.setDate(endDateObj.getDate() - 30);
    
    const formatDate = (date) => {
      return date.toISOString().split('T')[0];
    };

    // Try to fetch real Facebook Ads campaigns
    try {
      // First, try to get ad accounts associated with this user
      const adAccountsRes = await axios.get(`https://graph.facebook.com/v19.0/me/adaccounts?access_token=${user.facebookUserAccessToken}`);
      
      if (adAccountsRes.data.data && adAccountsRes.data.data.length > 0) {
        const adAccountId = adAccountsRes.data.data[0].id;
        console.log(`Fetching campaigns for ad account ${adAccountId}`);
        
        // Get campaigns from the ad account
        const campaignsRes = await axios.get(`https://graph.facebook.com/v19.0/${adAccountId}/campaigns?fields=id,name,status,objective&access_token=${user.facebookUserAccessToken}`);
        
        const campaigns = campaignsRes.data.data || [];
        const campaignData = [];
        
        // Get insights for each campaign
        for (const campaign of campaigns.slice(0, 10)) { // Limit to first 10 campaigns
          try {
            const insightsRes = await axios.get(`https://graph.facebook.com/v19.0/${campaign.id}/insights?fields=impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions&time_range={'since':'${formatDate(startDateObj)}','until':'${formatDate(endDateObj)}'}&access_token=${user.facebookUserAccessToken}`);
            
            const insights = insightsRes.data.data[0] || {};
            const actions = insights.actions || [];
            
            // Extract lead actions
            const leadAction = actions.find(action => action.action_type === 'lead');
            const leads = leadAction ? parseInt(leadAction.value) : 0;
            
            campaignData.push({
              id: campaign.id,
              name: campaign.name,
              status: campaign.status,
              objective: campaign.objective,
              impressions: parseInt(insights.impressions || 0),
              clicks: parseInt(insights.clicks || 0),
              spend: parseFloat(insights.spend || 0),
              reach: parseInt(insights.reach || 0),
              leads: leads,
              ctr: parseFloat(insights.ctr || 0),
              cpc: parseFloat(insights.cpc || 0),
              roas: insights.spend > 0 ? (leads * 50) / parseFloat(insights.spend || 1) : 0
            });
          } catch (campaignError) {
            console.log(`Could not fetch insights for campaign ${campaign.id}:`, campaignError.message);
            // Add campaign without insights
            campaignData.push({
              id: campaign.id,
              name: campaign.name,
              status: campaign.status,
              objective: campaign.objective,
              impressions: 0,
              clicks: 0,
              spend: 0,
              reach: 0,
              leads: 0,
              ctr: 0,
              cpc: 0,
              roas: 0
            });
          }
        }
        
        console.log(`Successfully fetched ${campaignData.length} real Facebook Ads campaigns`);
        return res.json(campaignData);
      } else {
        console.log('No ad accounts found for this Facebook page, using mock data');
      }
    } catch (adsError) {
      console.log('Could not fetch real Facebook Ads campaigns, using mock data:', adsError.response?.data || adsError.message);
    }
    
    // Fallback to mock data if no ad account access or API fails
    const mockCampaigns = [
      {
        id: '123456789012345',
        name: 'Lead Generation Campaign',
        status: 'ACTIVE',
        objective: 'LEAD_GENERATION',
        impressions: Math.floor(Math.random() * 20000) + 10000,
        clicks: Math.floor(Math.random() * 800) + 200,
        spend: Math.random() * 800 + 200,
        reach: Math.floor(Math.random() * 15000) + 5000,
        leads: Math.floor(Math.random() * 50) + 10,
        ctr: Math.random() * 4 + 2,
        cpc: Math.random() * 3 + 0.5,
        roas: Math.random() * 6 + 3
      },
      {
        id: '123456789012346',
        name: 'Traffic Campaign',
        status: 'ACTIVE',
        objective: 'TRAFFIC',
        impressions: Math.floor(Math.random() * 15000) + 8000,
        clicks: Math.floor(Math.random() * 600) + 150,
        spend: Math.random() * 500 + 100,
        reach: Math.floor(Math.random() * 12000) + 4000,
        leads: Math.floor(Math.random() * 30) + 5,
        ctr: Math.random() * 3 + 1.5,
        cpc: Math.random() * 2 + 0.3,
        roas: Math.random() * 5 + 2
      },
      {
        id: '123456789012347',
        name: 'Brand Awareness Campaign',
        status: 'PAUSED',
        objective: 'BRAND_AWARENESS',
        impressions: Math.floor(Math.random() * 10000) + 5000,
        clicks: Math.floor(Math.random() * 300) + 100,
        spend: Math.random() * 300 + 50,
        reach: Math.floor(Math.random() * 8000) + 3000,
        leads: Math.floor(Math.random() * 15) + 2,
        ctr: Math.random() * 2 + 1,
        cpc: Math.random() * 1.5 + 0.2,
        roas: Math.random() * 4 + 1
      }
    ];
    
    res.json(mockCampaigns);
  } catch (error) {
    console.error('Customer Facebook Ads campaigns error:', error);
    res.status(500).json({ error: 'Failed to fetch Facebook Ads campaigns' });
  }
});

// Get Facebook Ads account info for current customer
router.get('/account/me', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.id;
    
    const user = await User.findById(customerId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.facebookUserAccessToken) {
      return res.status(404).json({ error: 'Facebook not connected. Please contact your administrator to connect your Facebook account first.' });
    }

    // Validate that the saved user access token is valid
    try {
      const meRes = await axios.get(`https://graph.facebook.com/v19.0/me?access_token=${user.facebookUserAccessToken}`);
      console.log('Facebook Ads account user token validation: /me returned user:', meRes.data.name);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid or expired User Access Token. Please reconnect Facebook.' });
    }

    // Try to fetch real Facebook Ads account info
    try {
      // First, try to get ad accounts associated with this user
      const adAccountsRes = await axios.get(`https://graph.facebook.com/v19.0/me/adaccounts?access_token=${user.facebookUserAccessToken}`);
      
      if (adAccountsRes.data.data && adAccountsRes.data.data.length > 0) {
        const adAccountId = adAccountsRes.data.data[0].id;
        console.log(`Fetching account info for ad account ${adAccountId}`);
        
        // Get ad account details
        const accountRes = await axios.get(`https://graph.facebook.com/v19.0/${adAccountId}?fields=id,name,currency,timezone_name&access_token=${user.facebookUserAccessToken}`);
        
        const accountData = accountRes.data;
        const realAccount = {
          id: accountData.id,
          name: accountData.name || `${user.name} - Facebook Ads Account`,
          currency: accountData.currency || 'CAD',
          timeZone: accountData.timezone_name || 'America/Toronto',
          businessName: user.name || 'Business Account'
        };
        
        console.log('Successfully fetched real Facebook Ads account:', realAccount);
        return res.json(realAccount);
      } else {
        console.log('No ad accounts found for this Facebook user, using mock data');
      }
    } catch (adsError) {
      console.log('Could not fetch real Facebook Ads account, using mock data:', adsError.response?.data || adsError.message);
    }
    
    // Fallback to mock data if no ad account access or API fails
    const mockAccount = {
      id: user.facebookPageId || '123456789',
      name: `${user.name} - Facebook Ads Account`,
      currency: 'CAD',
      timeZone: 'America/Toronto',
      businessName: user.name || 'Business Account'
    };
    
    res.json(mockAccount);
  } catch (error) {
    console.error('Customer Facebook Ads account error:', error);
    res.status(500).json({ error: 'Failed to fetch Facebook Ads account' });
  }
});

// Check Facebook Ads permissions
router.get('/check-permissions', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.id;
    const user = await User.findById(customerId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.facebookUserAccessToken) {
      return res.json({
        hasUserToken: false,
        hasAdsPermission: false,
        message: 'No Facebook user token found. Please reconnect Facebook.'
      });
    }

    // Test if the user token has ads_read permission
    let hasAdsPermission = false;
    let errorMessage = null;
    
    try {
      const testResponse = await axios.get(`https://graph.facebook.com/v19.0/me/adaccounts?access_token=${user.facebookUserAccessToken}`);
      hasAdsPermission = true;
      console.log('Facebook user token has ads_read permission');
    } catch (testError) {
      hasAdsPermission = false;
      errorMessage = testError.response?.data?.error?.message || testError.message;
      console.log('Facebook user token does not have ads_read permission:', errorMessage);
    }
    
    res.json({
      hasUserToken: true,
      hasAdsPermission: hasAdsPermission,
      errorMessage: errorMessage,
      message: hasAdsPermission ? 
        'Facebook Ads access is available!' : 
        'Facebook Ads access requires ads_read permission. This needs Facebook App Review.'
    });
  } catch (error) {
    console.error('Permission check error:', error);
    res.status(500).json({ error: 'Failed to check permissions' });
  }
});

// Debug endpoint to check Facebook connection status
router.get('/debug/me', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.id;
    const user = await User.findById(customerId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const debugInfo = {
      customerId: customerId,
      customerName: user.name,
      facebookPageId: user.facebookPageId,
      facebookPageName: user.facebookPageName,
      hasFacebookPageToken: !!user.facebookAccessToken,
      hasFacebookUserToken: !!user.facebookUserAccessToken,
      facebookUserTokenExpiry: user.facebookUserTokenExpiry,
      googleAdsConnected: !!user.googleAdsAccessToken,
      googleAdsCustomerId: user.googleAdsCustomerId
    };
    
    res.json(debugInfo);
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: 'Failed to get debug info' });
  }
});

module.exports = router;
