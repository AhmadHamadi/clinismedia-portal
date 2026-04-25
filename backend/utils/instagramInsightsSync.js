const axios = require('axios');
const crypto = require('crypto');
const InstaUserInsight = require('../models/InstaUserInsight');
const InstaMediaInsight = require('../models/InstaMediaInsight');
const User = require('../models/User');

const GRAPH_API_BASE = 'https://graph.facebook.com/v22.0';

function createIdemKey(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function toUnixTimestamp(date) {
  return Math.floor(new Date(date).getTime() / 1000);
}

function uniqueTokens(tokens = []) {
  return [...new Set(tokens.filter(Boolean))];
}

// Meta returns OAuthException (error.code === 190) when a token is expired,
// revoked, or invalid. Subcodes 460/463/467 narrow it down to expired session,
// expired token, or session-blocked respectively. Treat all of these as
// permanent — the user must reconnect their Facebook page.
function isMetaTokenError(error) {
  const data = error?.response?.data;
  const inner = data?.error;
  if (!inner) return false;
  if (Number(inner.code) === 190) return true;
  if (Number(error?.response?.status) === 401) return true;
  const type = String(inner.type || '').toLowerCase();
  if (type === 'oauthexception') return true;
  return false;
}

async function graphGet(path, accessToken, params = {}) {
  const response = await axios.get(`${GRAPH_API_BASE}${path}`, {
    params: {
      access_token: accessToken,
      ...params,
    },
  });

  return response.data;
}

async function graphGetWithFallback(path, accessTokens, params = {}) {
  const tokens = uniqueTokens(accessTokens);
  let lastError = null;

  for (const token of tokens) {
    try {
      const data = await graphGet(path, token, params);
      return { data, accessToken: token };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('No access token available for Instagram sync.');
}

async function resolveLinkedInstagramAccount(pageId, accessTokens) {
  const tokens = uniqueTokens(accessTokens);
  const candidateFields = [
    'instagram_business_account{id,name,username}',
    'connected_instagram_account{id,name,username}',
  ];

  let lastError = null;

  for (const token of tokens) {
    for (const field of candidateFields) {
      try {
        const data = await graphGet(`/${pageId}`, token, { fields: field });
        const fieldName = field.split('{')[0];
        const instagramAccount = data?.[fieldName];
        if (instagramAccount?.id) {
          return {
            instagramAccountId: instagramAccount.id,
            instagramAccountName: instagramAccount.name || null,
            instagramUsername: instagramAccount.username || null,
          };
        }
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (lastError) {
    console.warn(
      `Unable to resolve linked Instagram account for page ${pageId}:`,
      lastError.response?.data || lastError.message
    );
  }

  return null;
}

function extractTotalValueNumber(totalValuePayload) {
  if (totalValuePayload === null || typeof totalValuePayload === 'undefined') {
    return null;
  }
  if (typeof totalValuePayload === 'number') {
    return totalValuePayload;
  }
  if (typeof totalValuePayload === 'object' && 'value' in totalValuePayload) {
    return Number(totalValuePayload.value ?? 0);
  }
  return null;
}

function normalizeInsightValues(metric, payload, customerId, accountId, period, endTimeFallback) {
  const values = Array.isArray(payload?.values) ? payload.values : [];
  const docs = [];

  if (values.length) {
    docs.push(
      ...values
        .map((entry) => {
          const value = Number(entry?.value ?? 0);
          const endTime = entry?.end_time ? new Date(entry.end_time) : null;
          if (!endTime || Number.isNaN(endTime.getTime())) {
            return null;
          }

          return {
            account_id: accountId,
            customer_id: customerId,
            period,
            metric,
            value,
            end_time: endTime,
            source: 'meta_graph',
            idem: createIdemKey(`${accountId}:${metric}:${endTime.toISOString()}:${period}`),
          };
        })
        .filter(Boolean)
    );
  }

  const totalNumeric = extractTotalValueNumber(payload?.total_value);
  const payloadEnd = payload?.end_time ? new Date(payload.end_time) : null;
  const periodEnd = payloadEnd && !Number.isNaN(payloadEnd.getTime())
    ? payloadEnd
    : (endTimeFallback || null);

  if (
    docs.length === 0
    && totalNumeric !== null
    && periodEnd
    && !Number.isNaN(periodEnd.getTime())
  ) {
    docs.push({
      account_id: accountId,
      customer_id: customerId,
      period,
      metric,
      value: totalNumeric,
      end_time: periodEnd,
      source: 'meta_graph',
      idem: createIdemKey(`${accountId}:${metric}:${periodEnd.toISOString()}:${period}`),
    });
  }

  return docs;
}

async function fetchInstagramProfile(instagramAccountId, accessTokens) {
  const { data } = await graphGetWithFallback(
    `/${instagramAccountId}`,
    accessTokens,
    {
      fields: 'id,username,name,followers_count,media_count',
    }
  );

  return data || {};
}

const TOTAL_VALUE_USER_METRICS = ['reach', 'views', 'profile_views', 'website_clicks'];

async function fetchUserMetric({ instagramAccountId, accessTokens, metric, metricType, since, until }) {
  const { data } = await graphGetWithFallback(
    `/${instagramAccountId}/insights`,
    accessTokens,
    {
      metric,
      period: 'day',
      since,
      until,
      metric_type: metricType,
    }
  );
  return Array.isArray(data?.data) ? data.data[0] : null;
}

async function bulkUpsertUserDocs(docs) {
  if (!docs.length) return 0;
  const operations = docs.map((doc) => ({
    updateOne: {
      filter: { idem: doc.idem },
      update: { $set: doc },
      upsert: true,
    },
  }));
  await InstaUserInsight.bulkWrite(operations, { ordered: false });
  return docs.length;
}

async function syncUserTotalValueMetrics({ instagramAccountId, customerId, accessTokens, from, to }) {
  const since = toUnixTimestamp(from);
  const until = toUnixTimestamp(to);
  const endTimeFallback = new Date(to);
  const docs = [];

  await Promise.all(TOTAL_VALUE_USER_METRICS.map(async (metric) => {
    try {
      const insight = await fetchUserMetric({
        instagramAccountId, accessTokens, metric, metricType: 'total_value', since, until,
      });
      if (insight) {
        docs.push(...normalizeInsightValues(metric, insight, customerId, instagramAccountId, 'day', endTimeFallback));
      } else {
        console.warn(`Instagram total_value metric "${metric}" returned no data.`);
      }
    } catch (error) {
      console.warn(`Instagram total_value metric "${metric}" failed:`, error.response?.data || error.message);
    }
  }));

  return bulkUpsertUserDocs(docs);
}

async function syncFollowerSnapshot({ instagramAccountId, customerId, accessTokens, to }) {
  try {
    const profile = await fetchInstagramProfile(instagramAccountId, accessTokens);
    if (typeof profile.followers_count === 'undefined') return 0;
    const snapshotTime = new Date(to);
    const doc = {
      account_id: instagramAccountId,
      customer_id: customerId,
      period: 'snapshot',
      metric: 'followers_count_snapshot',
      value: Number(profile.followers_count ?? 0),
      end_time: snapshotTime,
      source: 'meta_graph_profile',
      idem: createIdemKey(`${instagramAccountId}:followers_count_snapshot:${snapshotTime.toISOString()}:snapshot`),
    };
    return bulkUpsertUserDocs([doc]);
  } catch (error) {
    console.warn('Instagram profile snapshot unavailable:', error.response?.data || error.message);
    return 0;
  }
}

function getMediaMetricCandidates(media) {
  const mediaType = String(media?.media_type || '').toUpperCase();
  const productType = String(media?.media_product_type || '').toUpperCase();

  if (mediaType === 'VIDEO' || mediaType === 'REEL' || productType === 'REELS') {
    return ['reach', 'likes', 'comments', 'saved', 'shares', 'plays', 'views'];
  }

  return ['reach', 'views', 'likes', 'comments', 'saved', 'shares'];
}

async function fetchMediaInsights(media, accessTokens) {
  const metrics = {};
  const candidates = getMediaMetricCandidates(media);

  await Promise.all(candidates.map(async (metric) => {
    try {
      const { data } = await graphGetWithFallback(
        `/${media.id}/insights`,
        accessTokens,
        { metric }
      );

      const insight = Array.isArray(data?.data) ? data.data[0] : null;
      if (!insight) return;

      const valueEntry = Array.isArray(insight.values) ? insight.values[0] : null;
      if (valueEntry && typeof valueEntry.value !== 'undefined') {
        metrics[metric] = Number(valueEntry.value ?? 0);
        return;
      }

      const totalNumeric = extractTotalValueNumber(insight.total_value);
      if (totalNumeric !== null) {
        metrics[metric] = totalNumeric;
      }
    } catch (error) {
      console.warn(`Instagram media metric "${metric}" unavailable for media ${media.id}:`, error.response?.data || error.message);
    }
  }));

  return {
    reach: Number(metrics.reach || 0),
    impressions: Number(metrics.views || metrics.impressions || 0),
    likes: Number(metrics.likes || 0),
    comments: Number(metrics.comments || 0),
    saves: Number(metrics.saved || 0),
    engagement: Number(
      (metrics.likes || 0)
      + (metrics.comments || 0)
      + (metrics.saved || 0)
      + (metrics.shares || 0)
    ),
    plays: Number(metrics.plays || metrics.views || 0),
  };
}

async function fetchMediaForRange(instagramAccountId, accessTokens, from, to) {
  const selectedMedia = [];
  const seenIds = new Set();
  let after = null;
  const since = toUnixTimestamp(from);
  const until = toUnixTimestamp(to);

  while (true) {
    const { data } = await graphGetWithFallback(
      `/${instagramAccountId}/media`,
      accessTokens,
      {
        fields: 'id,caption,media_type,media_product_type,permalink,timestamp',
        limit: 100,
        since,
        until,
        ...(after ? { after } : {}),
      }
    );

    const items = Array.isArray(data?.data) ? data.data : [];
    for (const item of items) {
      if (!item?.id || seenIds.has(item.id)) continue;
      seenIds.add(item.id);

      const postedAt = item?.timestamp ? new Date(item.timestamp) : null;
      if (!postedAt || Number.isNaN(postedAt.getTime())) continue;
      if (postedAt < from || postedAt > to) continue;

      selectedMedia.push(item);
    }

    after = data?.paging?.cursors?.after;
    if (!after || !items.length) {
      break;
    }
  }

  return selectedMedia;
}

async function syncMediaInsights({ instagramAccountId, customerId, accessTokens, from, to }) {
  const mediaItems = await fetchMediaForRange(instagramAccountId, accessTokens, from, to);
  if (!mediaItems.length) {
    return { upserted: 0 };
  }

  const docs = await Promise.all(mediaItems.map(async (media) => {
    const metrics = await fetchMediaInsights(media, accessTokens);
    const postedAt = new Date(media.timestamp);

    return {
      account_id: instagramAccountId,
      media_id: media.id,
      media_type: media.media_type || 'unknown',
      caption: media.caption || '',
      permalink: media.permalink || '',
      posted_at: postedAt,
      metrics,
      customer_id: customerId,
      source: 'meta_graph',
      idem: createIdemKey(`${instagramAccountId}:${media.id}`),
    };
  }));

  const operations = docs.map((doc) => ({
    updateOne: {
      filter: { idem: doc.idem },
      update: { $set: doc },
      upsert: true,
    },
  }));

  await InstaMediaInsight.bulkWrite(operations, { ordered: false });
  return { upserted: docs.length };
}

async function syncInstagramInsightsForUser(user, range, compareRange = null) {
  const accessTokens = uniqueTokens([
    user.facebookAccessToken,
    user.facebookUserAccessToken,
  ]);

  if (!accessTokens.length) {
    return {
      synced: false,
      reason: 'No Facebook access token available for Instagram sync.',
    };
  }

  // Probe the Facebook access token before doing any of the expensive work.
  // If Meta says the token is dead (OAuthException / 401), flag the user so
  // the admin dashboard can prompt a Facebook reconnect, and bail out early
  // instead of grinding through 10+ failing Graph API calls.
  let probeError = null;
  for (const token of accessTokens) {
    try {
      await graphGet('/me', token, { fields: 'id' });
      probeError = null;
      break;
    } catch (error) {
      probeError = error;
    }
  }
  if (probeError && isMetaTokenError(probeError)) {
    if (user._id) {
      await User.findByIdAndUpdate(user._id, { facebookNeedsReauth: true }).catch((err) => {
        console.warn(`Failed flagging user ${user._id} as facebookNeedsReauth:`, err.message);
      });
    }
    const reason = probeError.response?.data?.error?.message
      || 'Facebook access token is invalid or expired — please reconnect.';
    console.warn(`[InstagramSync] Facebook token failed probe for user ${user._id || 'unknown'}: ${reason}`);
    return {
      synced: false,
      reason,
      facebookNeedsReauth: true,
    };
  }

  let hydratedUser = user;
  if (!hydratedUser?.instagramAccountId && hydratedUser?.facebookPageId) {
    const resolvedInstagramAccount = await resolveLinkedInstagramAccount(
      hydratedUser.facebookPageId,
      accessTokens
    );

    if (resolvedInstagramAccount?.instagramAccountId) {
      hydratedUser = {
        ...hydratedUser,
        ...resolvedInstagramAccount,
      };

      if (hydratedUser._id) {
        await User.findByIdAndUpdate(hydratedUser._id, resolvedInstagramAccount).catch((error) => {
          console.warn(
            `Failed to persist resolved Instagram account for user ${hydratedUser._id}:`,
            error.message
          );
        });
      }
    }
  }

  if (!hydratedUser?.instagramAccountId) {
    return {
      synced: false,
      reason: 'No linked Instagram professional account saved.',
    };
  }

  const from = new Date(range.from);
  const to = new Date(range.to);
  const compareFrom = compareRange ? new Date(compareRange.from) : null;
  const compareTo = compareRange ? new Date(compareRange.to) : null;
  const mediaFrom = compareFrom && compareFrom < from ? compareFrom : from;
  const mediaTo = compareTo && compareTo > to ? compareTo : to;
  const customerId = String(hydratedUser._id);
  const common = {
    instagramAccountId: hydratedUser.instagramAccountId,
    customerId,
    accessTokens,
  };

  const totalValueTasks = [syncUserTotalValueMetrics({ ...common, from, to })];
  if (compareRange) {
    totalValueTasks.push(
      syncUserTotalValueMetrics({ ...common, from: compareFrom, to: compareTo })
    );
  }

  const [
    snapshotUpserts,
    mediaResult,
    ...totalValueUpserts
  ] = await Promise.all([
    syncFollowerSnapshot({ ...common, to }),
    syncMediaInsights({ ...common, from: mediaFrom, to: mediaTo }),
    ...totalValueTasks,
  ]);

  const userResult = {
    upserted: snapshotUpserts + totalValueUpserts.reduce((sum, n) => sum + n, 0),
  };

  // Successful sync — clear any prior facebookNeedsReauth flag.
  if (user.facebookNeedsReauth && user._id) {
    await User.findByIdAndUpdate(user._id, { facebookNeedsReauth: false }).catch((err) => {
      console.warn(`Failed clearing facebookNeedsReauth for user ${user._id}:`, err.message);
    });
  }

  return {
    synced: true,
    accountId: hydratedUser.instagramAccountId,
    instagramAccountName: hydratedUser.instagramAccountName || null,
    instagramUsername: hydratedUser.instagramUsername || null,
    userMetricsUpserted: userResult.upserted,
    mediaUpserted: mediaResult.upserted,
    reason:
      userResult.upserted || mediaResult.upserted
        ? 'Meta sync completed.'
        : 'Meta sync completed, but no metrics were returned for this period.',
  };
}

module.exports = {
  syncInstagramInsightsForUser,
};
