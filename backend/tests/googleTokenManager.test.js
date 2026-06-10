const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Mock axios so no real Google call happens and we can count refreshes.
jest.mock('axios');
const axios = require('axios');

const User = require('../models/User');
const { ensureFreshAccessToken } = require('../utils/googleTokenManager');

jest.setTimeout(120000);

describe('googleTokenManager.ensureFreshAccessToken (race safety)', () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterEach(async () => {
    await User.deleteMany({});
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });

  async function makeAdmin(overrides = {}) {
    return User.create({
      name: 'Admin',
      username: `admin-${Date.now()}-${Math.random()}`,
      email: `admin-${Date.now()}-${Math.random()}@example.com`,
      password: 'password',
      role: 'admin',
      location: 'Toronto',
      googleBusinessRefreshToken: 'refresh-1',
      googleBusinessAccessToken: null,
      googleBusinessTokenExpiry: new Date(Date.now() - 60 * 1000), // expired
      ...overrides,
    });
  }

  test('coalesces concurrent refreshes into ONE Google call (single-flight)', async () => {
    const admin = await makeAdmin();
    axios.post.mockResolvedValue({ data: { access_token: 'fresh-access', expires_in: 3600 } });

    // Fire 8 refreshes at once — the race scenario (services + per-request handlers).
    const results = await Promise.all(
      Array.from({ length: 8 }, () => ensureFreshAccessToken('googleBusiness', admin._id))
    );

    // Exactly one network refresh despite 8 concurrent callers.
    expect(axios.post).toHaveBeenCalledTimes(1);
    // All callers got the same fresh token.
    for (const r of results) {
      expect(r.accessToken).toBe('fresh-access');
    }

    const saved = await User.findById(admin._id);
    expect(saved.googleBusinessAccessToken).toBe('fresh-access');
    expect(saved.googleBusinessNeedsReauth).toBe(false);
  });

  test('does not refresh again when the stored token is still valid (double-checked read)', async () => {
    const admin = await makeAdmin({
      googleBusinessAccessToken: 'still-valid',
      googleBusinessTokenExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1h out
    });

    const { accessToken, refreshed } = await ensureFreshAccessToken('googleBusiness', admin._id);

    expect(refreshed).toBe(false);
    expect(accessToken).toBe('still-valid');
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('persists a rotated refresh token when Google returns a new one', async () => {
    const admin = await makeAdmin();
    axios.post.mockResolvedValue({
      data: { access_token: 'fresh-access', refresh_token: 'rotated-refresh-2', expires_in: 3600 },
    });

    await ensureFreshAccessToken('googleBusiness', admin._id);

    const saved = await User.findById(admin._id);
    expect(saved.googleBusinessRefreshToken).toBe('rotated-refresh-2');
  });
});
