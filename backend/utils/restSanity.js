// utils/restSanity.js
const axios = require('axios');

async function restListAccessibleCustomers(accessToken, devToken) {
  const url = "https://googleads.googleapis.com/v22/customers:listAccessibleCustomers";
  const response = await axios.get(url, {
    headers: { 
      Authorization: `Bearer ${accessToken}`, 
      "developer-token": devToken 
    }
  });
  console.log("[ADS REST] listAccessibleCustomers OK");
  return response.data;
}

async function restCustomerName(accessToken, devToken, mccId, clientId) {
  const url = `https://googleads.googleapis.com/v22/customers/${clientId}/googleAds:search`;
  const body = {
    query: "SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1"
  };
  const response = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": devToken,
      "login-customer-id": mccId,
      "Content-Type": "application/json"
    }
  });
  console.log("[ADS REST] customer name OK");
  return response.data;
}

module.exports = {
  restListAccessibleCustomers,
  restCustomerName
};