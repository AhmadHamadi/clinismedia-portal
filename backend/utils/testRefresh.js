// utils/testRefresh.js
const axios = require('axios');

async function exchangeAccessToken(refreshToken) {
  const response = await axios.post("https://oauth2.googleapis.com/token", {
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  }, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });
  
  const data = response.data;
  console.log("[ADS TOKEN] access_token_len:", (data.access_token||"").length, "expires_in:", data.expires_in);
  return data.access_token;
}

module.exports = {
  exchangeAccessToken
};
