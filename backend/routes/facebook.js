const express = require('express');
const axios = require('axios');
const router = express.Router();
const User = require('../models/User');

router.get('/auth/:clinicId', (req, res) => {
  const { clinicId } = req.params;
  const redirectUri = encodeURIComponent(process.env.FB_REDIRECT_URI);
  const clientId = process.env.FB_APP_ID;
  const scope = [
    'pages_show_list'
  ].join(',');
  res.redirect(
    `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${redirectUri}&state=${clinicId}&scope=${scope}`
  );
});

router.get('/callback', async (req, res) => {
  const { code, state: clinicId } = req.query;
  const redirectUri = process.env.FB_REDIRECT_URI;
  const clientId = process.env.FB_APP_ID;
  const clientSecret = process.env.FB_APP_SECRET;

  try {
    // Exchange code for user access token
    const tokenRes = await axios.get(
      `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${clientId}&redirect_uri=${redirectUri}&client_secret=${clientSecret}&code=${code}`
    );
    const userAccessToken = tokenRes.data.access_token;
    const tokenExpiry = tokenRes.data.expires_in
      ? new Date(Date.now() + tokenRes.data.expires_in * 1000)
      : null;

    // Get list of pages
    const pagesRes = await axios.get(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${userAccessToken}`
    );
    const pages = pagesRes.data.data;

    // Instead of saving, return the list of pages and the userAccessToken to the frontend
    // (Frontend will POST the selected page info to a new endpoint)
    res.json({ pages, userAccessToken, tokenExpiry, clinicId });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send('Facebook OAuth failed');
  }
});

// New endpoint: Save selected Facebook Page info to the user (clinic/customer)
router.post('/save-page', async (req, res) => {
  const { clinicId, pageId, pageName, pageAccessToken, tokenExpiry } = req.body;
  if (!clinicId || !pageId || !pageAccessToken) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
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
    res.json({ message: 'Facebook Page connected and saved!', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save Facebook Page info' });
  }
});

module.exports = router; 
