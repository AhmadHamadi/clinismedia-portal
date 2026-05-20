const User = require('../models/User');

const INTEGRATION_FIELDS = {
  googleAds: {
    refreshToken: 'googleAdsRefreshToken',
    needsReauth: 'googleAdsNeedsReauth',
  },
  googleBusiness: {
    refreshToken: 'googleBusinessRefreshToken',
    needsReauth: 'googleBusinessNeedsReauth',
  },
  searchConsole: {
    refreshToken: 'searchConsoleRefreshToken',
    needsReauth: 'searchConsoleNeedsReauth',
  },
};

function getIntegrationFields(integration) {
  const fields = INTEGRATION_FIELDS[integration];

  if (!fields) {
    throw new Error(`Unsupported Google integration: ${integration}`);
  }

  return fields;
}

async function findGoogleIntegrationAdminUser(req, integration, options = {}) {
  const { refreshToken, needsReauth } = getIntegrationFields(integration);
  const { preferCurrentAdmin = false, allowFallbackAdmin = false } = options;
  const currentAdminId = req?.user?._id || req?.user?.id || null;
  let currentAdmin = null;

  if (currentAdminId) {
    currentAdmin = await User.findById(currentAdminId);
    if (preferCurrentAdmin && currentAdmin && currentAdmin.role === 'admin') {
      return currentAdmin;
    }
  }

  const connectedAdmin = await User.findOne({
    role: 'admin',
    [refreshToken]: { $exists: true, $ne: null },
    $or: [
      { [needsReauth]: { $exists: false } },
      { [needsReauth]: { $ne: true } },
    ],
  }).sort({ updatedAt: -1, createdAt: 1, _id: 1 });

  if (connectedAdmin) {
    return connectedAdmin;
  }

  if (allowFallbackAdmin && currentAdmin && currentAdmin.role === 'admin') {
    return currentAdmin;
  }

  if (allowFallbackAdmin) {
    return User.findOne({ role: 'admin' }).sort({ createdAt: 1, _id: 1 });
  }

  return null;
}

module.exports = {
  findGoogleIntegrationAdminUser,
};
