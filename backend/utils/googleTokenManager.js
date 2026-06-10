/**
 * Centralized, race-safe Google OAuth access-token manager.
 *
 * WHY THIS EXISTS
 * Multiple writers used to refresh the SAME Google refresh token at nearly the
 * same time: the 30-second background services, the per-request route handlers
 * (googleAds.js / googleBusiness.js / reports.js), and the daily data-refresh
 * service. If the OAuth client has refresh-token rotation enabled, each call to
 * `grant_type=refresh_token` returns a NEW refresh token and invalidates the
 * previous one. When two writers fire together, the slower one ends up sending
 * a token that was just rotated away → Google replies `invalid_grant` → the
 * integration is flagged for reconnect. That produces the "have to reconnect
 * every couple of days" symptom on a PUBLISHED app (where tokens otherwise
 * never expire on a timer).
 *
 * THE FIX
 * `ensureFreshAccessToken` funnels every refresh for a given (integration,user)
 * through ONE in-process promise (single-flight) AND re-reads the user inside
 * that critical section. Concurrent callers await the same refresh instead of
 * each hitting Google; callers that arrive after a refresh just completed see
 * the freshly-stored token and skip refreshing entirely. One refresh per cycle,
 * no rotation race, no token churn.
 *
 * It deliberately does NOT clear tokens or set needs-reauth flags — callers keep
 * their own failure handling so existing behavior is preserved.
 */
const axios = require('axios');
const User = require('../models/User');

const INTEGRATIONS = {
  googleAds: {
    clientIdEnv: 'GOOGLE_ADS_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_ADS_CLIENT_SECRET',
    accessField: 'googleAdsAccessToken',
    refreshField: 'googleAdsRefreshToken',
    expiryField: 'googleAdsTokenExpiry',
    reauthField: 'googleAdsNeedsReauth',
  },
  googleBusiness: {
    clientIdEnv: 'GOOGLE_BUSINESS_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_BUSINESS_CLIENT_SECRET',
    accessField: 'googleBusinessAccessToken',
    refreshField: 'googleBusinessRefreshToken',
    expiryField: 'googleBusinessTokenExpiry',
    reauthField: 'googleBusinessNeedsReauth',
  },
};

const DEFAULT_BUFFER_MS = 5 * 60 * 1000; // refresh if expiring within 5 minutes

// In-process single-flight registry: key -> in-flight Promise.
const inFlight = new Map();

function singleFlight(key, fn) {
  const existing = inFlight.get(key);
  if (existing) return existing;
  const p = (async () => {
    try {
      return await fn();
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, p);
  return p;
}

function getConfig(integration) {
  const cfg = INTEGRATIONS[integration];
  if (!cfg) throw new Error(`Unknown Google integration: ${integration}`);
  return cfg;
}

/**
 * Low-level refresh against Google. Returns { access_token, refresh_token, expires_in }.
 * Always returns a refresh_token (falls back to the one we sent) so callers never
 * persist undefined.
 */
async function callGoogleRefresh(integration, refreshToken) {
  const cfg = getConfig(integration);
  const response = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: process.env[cfg.clientIdEnv],
    client_secret: process.env[cfg.clientSecretEnv],
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  if (!response?.data?.access_token) {
    throw new Error(`${integration} token refresh returned no access_token`);
  }

  return {
    access_token: response.data.access_token,
    refresh_token: response.data.refresh_token || refreshToken,
    expires_in: response.data.expires_in || 3600,
  };
}

/**
 * Returns a valid access token for the given user+integration, refreshing only
 * if needed, and never racing another refresh of the same token.
 *
 * @param {string} integration  'googleAds' | 'googleBusiness'
 * @param {string|ObjectId} userId
 * @param {object} [opts]
 * @param {boolean} [opts.forceRefresh=false]
 * @param {number} [opts.bufferMs]
 * @returns {Promise<{ accessToken: string, refreshed: boolean, user: object }>}
 */
async function ensureFreshAccessToken(integration, userId, opts = {}) {
  const cfg = getConfig(integration);
  const bufferMs = typeof opts.bufferMs === 'number' ? opts.bufferMs : DEFAULT_BUFFER_MS;
  const forceRefresh = !!opts.forceRefresh;
  const key = `${integration}:${String(userId)}`;

  return singleFlight(key, async () => {
    // Re-read inside the critical section: another writer may have just refreshed.
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found for token refresh');

    const refreshToken = user[cfg.refreshField];
    if (!refreshToken) {
      const err = new Error(`No ${integration} refresh token available`);
      err.code = 'NO_REFRESH_TOKEN';
      throw err;
    }

    const now = Date.now();
    const expiryMs = user[cfg.expiryField] ? new Date(user[cfg.expiryField]).getTime() : 0;
    const stillValid = !!user[cfg.accessField] && expiryMs > now + bufferMs;

    if (!forceRefresh && stillValid) {
      return { accessToken: user[cfg.accessField], refreshed: false, user };
    }

    const tokens = await callGoogleRefresh(integration, refreshToken);

    const update = {
      [cfg.accessField]: tokens.access_token,
      [cfg.expiryField]: new Date(now + tokens.expires_in * 1000),
      [cfg.reauthField]: false,
    };
    // Persist a rotated refresh token if Google sent a new one.
    if (tokens.refresh_token && tokens.refresh_token !== refreshToken) {
      update[cfg.refreshField] = tokens.refresh_token;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, update, { new: true });
    return { accessToken: tokens.access_token, refreshed: true, user: updatedUser || user };
  });
}

module.exports = {
  ensureFreshAccessToken,
  callGoogleRefresh,
  INTEGRATIONS,
};
