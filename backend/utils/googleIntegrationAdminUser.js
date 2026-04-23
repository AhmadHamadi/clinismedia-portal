const User = require('../models/User');

const INTEGRATION_FIELDS = {
  googleAds: {
    accessToken: 'googleAdsAccessToken',
    refreshToken: 'googleAdsRefreshToken',
  },
  googleBusiness: {
    accessToken: 'googleBusinessAccessToken',
    refreshToken: 'googleBusinessRefreshToken',
  },
  searchConsole: {
    accessToken: 'searchConsoleAccessToken',
    refreshToken: 'searchConsoleRefreshToken',
  },
};

function getIntegrationFields(integration) {
  const fields = INTEGRATION_FIELDS[integration];

  if (!fields) {
    throw new Error(`Unsupported Google integration: ${integration}`);
  }

  return fields;
}

async function findGoogleIntegrationAdminUser(req, integration) {
  const { accessToken, refreshToken } = getIntegrationFields(integration);
  const currentAdminId = req?.user?._id || req?.user?.id || null;

  if (currentAdminId) {
    const currentAdmin = await User.findById(currentAdminId);
    if (currentAdmin && currentAdmin.role === 'admin') {
      return currentAdmin;
    }
  }

  const connectedAdmin = await User.findOne({
    role: 'admin',
    $or: [
      { [refreshToken]: { $exists: true, $ne: null } },
      { [accessToken]: { $exists: true, $ne: null } },
    ],
  }).sort({ updatedAt: -1, createdAt: 1, _id: 1 });

  if (connectedAdmin) {
    return connectedAdmin;
  }
  return User.findOne({ role: 'admin' }).sort({ createdAt: 1, _id: 1 });
}

module.exports = {
  findGoogleIntegrationAdminUser,
};
