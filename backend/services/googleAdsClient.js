const { GoogleAdsApi } = require('google-ads-api');

// Enhanced hooks for better debugging
const hooks = {
  onQueryStart: (query, credentials) => {
    console.log('[GAQL START]', { 
      customer_id: credentials?.customer_id, 
      login_customer_id: credentials?.login_customer_id, 
      query: query.substring(0, 100) + '...' 
    });
  },
  onQueryError: (err, query, credentials) => {
    console.error('[GAQL ERROR]', { 
      creds: credentials, 
      query: query.substring(0, 100) + '...', 
      err: err?.message, 
      failure: err?.failure ?? err?.response?.data ?? null 
    });
  },
  onQueryEnd: (ms, query, credentials) => {
    console.log('[GAQL END]', { 
      ms, 
      customer_id: credentials?.customer_id 
    });
  }
};

// Create single instance with hooks
const adsWithHooks = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  hooks,
});

// Helper functions
function dumpAdsError(err) {
  try {
    return {
      message: err?.message,
      code: err?.code,
      failure: err?.failure ?? err?.error ?? err?.response?.data ?? null,
      request: err?.request ?? null,
      stack: err?.stack,
    };
  } catch { 
    return { message: String(err) }; 
  }
}

function serializeError(err) {
  try { 
    return dumpAdsError(err); 
  } catch { 
    return { message: String(err) }; 
  }
}

// Factory functions for proper customer context
function asMccCustomer(adminRefreshToken, mccId) {
  const mcc = String(mccId).replace(/-/g, "");
  return adsWithHooks.Customer({
    customer_id: mcc,                 // operating customer = MCC
    login_customer_id: mcc,          // act via MCC
    refresh_token: adminRefreshToken,
  });
}

function asClientCustomer(adminRefreshToken, mccId, clientId) {
  const mcc = String(mccId).replace(/-/g, "");
  const cid = String(clientId).replace(/-/g, "");
  return adsWithHooks.Customer({
    customer_id: cid,                 // operating customer = client
    login_customer_id: mcc,           // act via MCC
    refresh_token: adminRefreshToken,
  });
}

module.exports = {
  ads: adsWithHooks,
  asMccCustomer,
  asClientCustomer,
  dumpAdsError,
  serializeError
};