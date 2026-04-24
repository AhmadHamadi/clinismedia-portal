const axios = require('axios');
const crypto = require('crypto');
const InstaUserInsight = require('../models/InstaUserInsight');
const InstaMediaInsight = require('../models/InstaMediaInsight');
const User = require('../models/User');

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

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

function normalizeInsightValues(metric, payload, customerId, accountId, period) {
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

  const totalValue = payload?.total_value;
  const periodEnd = payload?.end_time ? new Date(payload.end_time) : null;
  if (
    docs.length === 0
    && typeof totalValue !== 'undefined'
    && periodEnd
    && !Number.isNaN(periodEnd.getTime())
  ) {
    docs.push({
      account_id: accountId,
      customer_id: customerId,
      period,
      metric,
      value: Number(totalValue ?? 0),
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

async function syncUserInsights({ instagramAccountId, customerId, accessTokens, from, to }) {
  const metrics = ['reach', 'impressions', 'profile_views', 'website_clicks'];
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
          metric_type: 'time_series',
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

  try {
    const profile = await fetchInstagramProfile(instagramAccountId, accessTokens);
    if (typeof profile.followers_count !== 'undefined') {
      const snapshotTime = new Date(to);
      docs.push({
        account_id: instagramAccountId,
        customer_id: customerId,
        period: 'snapshot',
        metric: 'followers_count_snapshot',
        value: Number(profile.followers_count ?? 0),
        end_time: snapshotTime,
        source: 'meta_graph_profile',
        idem: createIdemKey(`${instagramAccountId}:followers_count_snapshot:${snapshotTime.toISOString()}:snapshot`),
      });
    }
  } catch (error) {
    console.warn('Instagram profile snapshot unavailable:', error.response?.data || error.message);
  }

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
  const customerId = String(hydratedUser._id);

  const [userResult, mediaResult] = await Promise.all([
    syncUserInsights({
      instagramAccountId: hydratedUser.instagramAccountId,
      customerId,
      accessTokens,
      from,
      to,
    }),
    syncMediaInsights({
      instagramAccountId: hydratedUser.instagramAccountId,
      customerId,
      accessTokens,
      from,
      to,
    }),
  ]);

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
