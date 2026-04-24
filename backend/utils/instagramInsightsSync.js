const axios = require('axios');
const crypto = require('crypto');
const InstaUserInsight = require('../models/InstaUserInsight');
const InstaMediaInsight = require('../models/InstaMediaInsight');

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

function createIdemKey(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function toUnixTimestamp(date) {
  return Math.floor(new Date(date).getTime() / 1000);
}

function uniqueTokens(tokens = []) {
  return [...new Set(tokens.filter(Boolean))];
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

function normalizeInsightValues(metric, payload, customerId, accountId, period) {
  const values = Array.isArray(payload?.values) ? payload.values : [];
  if (!values.length) {
    return [];
  }

  return values
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
    .filter(Boolean);
}

async function syncUserInsights({ instagramAccountId, customerId, accessTokens, from, to }) {
  const metrics = ['reach', 'impressions', 'profile_views', 'website_clicks', 'follower_count'];
  const docs = [];

  const since = toUnixTimestamp(from);
  const until = toUnixTimestamp(to);

  await Promise.all(metrics.map(async (metric) => {
    try {
      const { data } = await graphGetWithFallback(
        `/${instagramAccountId}/insights`,
        accessTokens,
        {
          metric,
          period: 'day',
          since,
          until,
        }
      );

      const insight = Array.isArray(data?.data) ? data.data[0] : null;
      if (insight) {
        docs.push(...normalizeInsightValues(metric, insight, customerId, instagramAccountId, 'day'));
      }
    } catch (error) {
      console.warn(`Instagram user insight metric "${metric}" unavailable:`, error.response?.data || error.message);
    }
  }));

  if (!docs.length) {
    return { upserted: 0 };
  }

  const operations = docs.map((doc) => ({
    updateOne: {
      filter: { idem: doc.idem },
      update: { $set: doc },
      upsert: true,
    },
  }));

  await InstaUserInsight.bulkWrite(operations, { ordered: false });
  return { upserted: docs.length };
}

function getMediaMetricCandidates(media) {
  const mediaType = String(media?.media_type || '').toUpperCase();
  const productType = String(media?.media_product_type || '').toUpperCase();

  if (mediaType === 'VIDEO' || mediaType === 'REEL' || productType === 'REELS') {
    return ['reach', 'impressions', 'likes', 'comments', 'saved', 'shares', 'plays', 'views'];
  }

  return ['reach', 'impressions', 'likes', 'comments', 'saved', 'shares'];
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
      const valueEntry = Array.isArray(insight?.values) ? insight.values[0] : null;
      if (valueEntry && typeof valueEntry.value !== 'undefined') {
        metrics[metric] = Number(valueEntry.value ?? 0);
      }
    } catch (error) {
      console.warn(`Instagram media metric "${metric}" unavailable for media ${media.id}:`, error.response?.data || error.message);
    }
  }));

  return {
    reach: Number(metrics.reach || 0),
    impressions: Number(metrics.impressions || 0),
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

async function syncInstagramInsightsForUser(user, range) {
  if (!user?.instagramAccountId) {
    return {
      synced: false,
      reason: 'No linked Instagram professional account saved.',
    };
  }

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

  const from = new Date(range.from);
  const to = new Date(range.to);
  const customerId = String(user._id);

  const [userResult, mediaResult] = await Promise.all([
    syncUserInsights({
      instagramAccountId: user.instagramAccountId,
      customerId,
      accessTokens,
      from,
      to,
    }),
    syncMediaInsights({
      instagramAccountId: user.instagramAccountId,
      customerId,
      accessTokens,
      from,
      to,
    }),
  ]);

  return {
    synced: true,
    accountId: user.instagramAccountId,
    instagramUsername: user.instagramUsername || null,
    userMetricsUpserted: userResult.upserted,
    mediaUpserted: mediaResult.upserted,
  };
}

module.exports = {
  syncInstagramInsightsForUser,
};
