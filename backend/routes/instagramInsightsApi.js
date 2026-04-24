const express = require('express');
const InstaUserInsight = require('../models/InstaUserInsight');
const InstaMediaInsight = require('../models/InstaMediaInsight');
const User = require('../models/User');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');
const { syncInstagramInsightsForUser } = require('../utils/instagramInsightsSync');

const router = express.Router();

function getTimeZoneOffsetMillis(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const valueByType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(valueByType.year),
    Number(valueByType.month) - 1,
    Number(valueByType.day),
    Number(valueByType.hour),
    Number(valueByType.minute),
    Number(valueByType.second),
    0
  );

  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function convertClinicLocalDateTimeToUtc(dateString, timeZone, endOfDay = false) {
  const [year, month, day] = String(dateString).split('-').map(Number);
  const hours = endOfDay ? 23 : 0;
  const minutes = endOfDay ? 59 : 0;
  const seconds = endOfDay ? 59 : 0;
  const milliseconds = endOfDay ? 999 : 0;

  const initialGuess = Date.UTC(year, month - 1, day, hours, minutes, seconds, milliseconds);
  const initialOffset = getTimeZoneOffsetMillis(new Date(initialGuess), timeZone);
  const adjustedGuess = initialGuess - initialOffset;
  const refinedOffset = getTimeZoneOffsetMillis(new Date(adjustedGuess), timeZone);

  return new Date(initialGuess - refinedOffset);
}

function getClinicTimezone(customer) {
  return customer?.aiReceptionistSettings?.timezone || 'America/Toronto';
}

function getInsightRange(customer, from, to) {
  const timezone = getClinicTimezone(customer);
  return {
    fromDate: convertClinicLocalDateTimeToUtc(from, timezone, false),
    toDate: convertClinicLocalDateTimeToUtc(to, timezone, true),
    timezone,
  };
}

/**
 * Get Instagram insights for a specific customer (Admin only)
 */
router.get('/customer/:customerId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { customerId } = req.params;
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'From and to dates are required' });
    }

    const customer = await User.findById(customerId).select(
      'instagramAccountId instagramAccountName instagramUsername facebookPageId facebookPageName facebookAccessToken facebookUserAccessToken aiReceptionistSettings.timezone'
    );
    const { fromDate, toDate } = getInsightRange(customer, from, to);

    if (customer) {
      try {
        await syncInstagramInsightsForUser(
          { ...customer.toObject(), _id: customerId },
          { from: fromDate, to: toDate }
        );
      } catch (syncError) {
        console.warn('Instagram direct sync failed for admin customer fetch:', syncError.response?.data || syncError.message);
      }
    }

    // Get user insights for the customer
    const userInsights = await InstaUserInsight.find({
      customer_id: customerId,
      end_time: { $gte: fromDate, $lte: toDate }
    }).sort({ end_time: -1 });

    // Get media insights for the customer
    const mediaInsights = await InstaMediaInsight.find({
      customer_id: customerId,
      posted_at: { $gte: fromDate, $lte: toDate }
    }).sort({ posted_at: -1 });

    // Calculate totals
    const totals = {
      totalReach: 0,
      totalImpressions: 0,
      totalProfileViews: 0,
      totalWebsiteClicks: 0,
      followerCount: 0,
      totalEngagement: 0,
      postCount: mediaInsights.length
    };

    // Process user insights
    userInsights.forEach(insight => {
      switch (insight.metric) {
        case 'impressions':
        case 'views':
          totals.totalImpressions += insight.value;
          break;
        case 'reach':
          totals.totalReach += insight.value;
          break;
        case 'profile_views':
          totals.totalProfileViews += insight.value;
          break;
        case 'website_clicks':
          totals.totalWebsiteClicks += insight.value;
          break;
        case 'follower_count':
        case 'followers_count_snapshot':
          if (totals.followerCount === 0) totals.followerCount = insight.value;
          break;
      }
    });

    // Process media insights
    mediaInsights.forEach(media => {
      totals.totalEngagement += media.metrics.engagement || 0;
    });

    // Calculate average engagement
    const avgEngagement = mediaInsights.length > 0 ? totals.totalEngagement / mediaInsights.length : 0;

    // Get top posts (sorted by engagement)
    const topPosts = mediaInsights
      .map(media => ({
        media_id: media.media_id,
        caption: media.caption,
        permalink: media.permalink,
        posted_at: media.posted_at,
        metrics: media.metrics
      }))
      .sort((a, b) => (b.metrics.engagement || 0) - (a.metrics.engagement || 0))
      .slice(0, 10);

    res.json({
      totalReach: totals.totalReach,
      totalImpressions: totals.totalImpressions,
      totalProfileViews: totals.totalProfileViews,
      totalWebsiteClicks: totals.totalWebsiteClicks,
      followerCount: totals.followerCount,
      avgEngagement: avgEngagement,
      topPosts: topPosts
    });

  } catch (error) {
    console.error('Error fetching Instagram insights for customer:', error);
    res.status(500).json({ error: 'Failed to fetch Instagram insights' });
  }
});

/**
 * Get Instagram insights for the current customer
 */
router.get('/my-insights', authenticateToken, authorizeRole(['customer']), async (req, res) => {
  try {
    const customerId = req.user.id;
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'From and to dates are required' });
    }

    const customer = await User.findById(customerId).select(
      'instagramAccountId instagramAccountName instagramUsername facebookPageId facebookPageName facebookAccessToken facebookUserAccessToken aiReceptionistSettings.timezone'
    );
    const { fromDate, toDate } = getInsightRange(customer, from, to);
    const rangeDurationMs = toDate.getTime() - fromDate.getTime() + 1;
    const previousToDate = new Date(fromDate.getTime() - 1);
    const previousFromDate = new Date(previousToDate.getTime() - rangeDurationMs + 1);

    let syncStatus = {
      synced: false,
      reason: 'Instagram direct sync was skipped.',
    };

    if (customer) {
      try {
        syncStatus = await syncInstagramInsightsForUser(
          { ...customer.toObject(), _id: customerId },
          { from: fromDate, to: toDate },
          { from: previousFromDate, to: previousToDate }
        );
      } catch (syncError) {
        console.warn('Instagram direct sync failed for customer insights:', syncError.response?.data || syncError.message);
        syncStatus = {
          synced: false,
          reason: 'Instagram direct sync failed.',
          error: syncError.response?.data?.error?.message || syncError.message,
        };
      }
    }

    const connection = {
      instagramAccountId: customer?.instagramAccountId || syncStatus?.accountId || null,
      instagramAccountName: customer?.instagramAccountName || syncStatus?.instagramAccountName || null,
      instagramUsername: customer?.instagramUsername || syncStatus?.instagramUsername || null,
      facebookPageName: customer?.facebookPageName || null,
    };

    // Get user insights for the customer
    const userInsights = await InstaUserInsight.find({
      customer_id: customerId,
      end_time: { $gte: fromDate, $lte: toDate }
    }).sort({ end_time: -1 });

    // Get media insights for the customer
    const mediaInsights = await InstaMediaInsight.find({
      customer_id: customerId,
      posted_at: { $gte: fromDate, $lte: toDate }
    }).sort({ posted_at: -1 });

    // Calculate totals for current period
    const currentTotals = {
      totalReach: 0,
      totalImpressions: 0,
      totalProfileViews: 0,
      totalWebsiteClicks: 0,
      followerCount: 0,
      totalEngagement: 0
    };

    // Process user insights
    userInsights.forEach(insight => {
      switch (insight.metric) {
        case 'impressions':
        case 'views':
          currentTotals.totalImpressions += insight.value;
          break;
        case 'reach':
          currentTotals.totalReach += insight.value;
          break;
        case 'profile_views':
          currentTotals.totalProfileViews += insight.value;
          break;
        case 'website_clicks':
          currentTotals.totalWebsiteClicks += insight.value;
          break;
        case 'follower_count':
        case 'followers_count_snapshot':
          if (currentTotals.followerCount === 0) currentTotals.followerCount = insight.value;
          break;
      }
    });

    // Process media insights
    mediaInsights.forEach(media => {
      currentTotals.totalEngagement += media.metrics.engagement || 0;
    });

    const previousUserInsights = await InstaUserInsight.find({
      customer_id: customerId,
      end_time: { $gte: previousFromDate, $lte: previousToDate }
    });

    const previousMediaInsights = await InstaMediaInsight.find({
      customer_id: customerId,
      posted_at: { $gte: previousFromDate, $lte: previousToDate }
    });

    // Calculate previous period totals
    const previousTotals = {
      totalReach: 0,
      totalImpressions: 0,
      totalProfileViews: 0,
      totalWebsiteClicks: 0,
      totalEngagement: 0,
      followerCount: 0
    };

    previousUserInsights.forEach(insight => {
      switch (insight.metric) {
        case 'impressions':
        case 'views':
          previousTotals.totalImpressions += insight.value;
          break;
        case 'reach':
          previousTotals.totalReach += insight.value;
          break;
        case 'profile_views':
          previousTotals.totalProfileViews += insight.value;
          break;
        case 'website_clicks':
          previousTotals.totalWebsiteClicks += insight.value;
          break;
        case 'follower_count':
        case 'followers_count_snapshot':
          previousTotals.followerCount = insight.value;
          break;
      }
    });

    previousMediaInsights.forEach(media => {
      previousTotals.totalEngagement += media.metrics.engagement || 0;
    });

    // Calculate percentage changes
    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const avgEngagement = mediaInsights.length > 0 ? currentTotals.totalEngagement / mediaInsights.length : 0;
    const previousAvgEngagement = previousMediaInsights.length > 0 ? previousTotals.totalEngagement / previousMediaInsights.length : 0;

    // Get top posts
    const topPosts = mediaInsights
      .map(media => ({
        media_id: media.media_id,
        caption: media.caption,
        permalink: media.permalink,
        posted_at: media.posted_at,
        metrics: media.metrics
      }))
      .sort((a, b) => (b.metrics.engagement || 0) - (a.metrics.engagement || 0))
      .slice(0, 10);

    res.json({
      totalReach: currentTotals.totalReach,
      totalImpressions: currentTotals.totalImpressions,
      totalProfileViews: currentTotals.totalProfileViews,
      totalWebsiteClicks: currentTotals.totalWebsiteClicks,
      followerCount: currentTotals.followerCount,
      avgEngagement: avgEngagement,
      topPosts: topPosts,
      periodComparison: {
        reachChange: calculateChange(currentTotals.totalReach, previousTotals.totalReach),
        impressionsChange: calculateChange(currentTotals.totalImpressions, previousTotals.totalImpressions),
        profileViewsChange: calculateChange(currentTotals.totalProfileViews, previousTotals.totalProfileViews),
        engagementChange: calculateChange(avgEngagement, previousAvgEngagement)
      },
      connection,
      syncStatus,
    });

  } catch (error) {
    console.error('Error fetching customer Instagram insights:', error);
    res.status(500).json({ error: 'Failed to fetch Instagram insights' });
  }
});

router.post('/sync', authenticateToken, authorizeRole(['customer']), async (req, res) => {
  try {
    const customer = await User.findById(req.user.id).select(
      'instagramAccountId instagramAccountName instagramUsername facebookPageId facebookPageName facebookAccessToken facebookUserAccessToken aiReceptionistSettings.timezone'
    );

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const timezone = getClinicTimezone(customer);
    const todayParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const valueByType = Object.fromEntries(todayParts.map((part) => [part.type, part.value]));
    const todayString = `${valueByType.year}-${valueByType.month}-${valueByType.day}`;
    const end = convertClinicLocalDateTimeToUtc(todayString, timezone, true);
    const startAnchor = new Date(end);
    startAnchor.setUTCDate(startAnchor.getUTCDate() - 89);
    const startParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(startAnchor);
    const startValueByType = Object.fromEntries(startParts.map((part) => [part.type, part.value]));
    const startString = `${startValueByType.year}-${startValueByType.month}-${startValueByType.day}`;
    const start = convertClinicLocalDateTimeToUtc(startString, timezone, false);

    const result = await syncInstagramInsightsForUser(
      { ...customer.toObject(), _id: req.user.id },
      { from: start, to: end }
    );

    res.json(result);
  } catch (error) {
    console.error('Error syncing Instagram insights:', error);
    res.status(500).json({ error: 'Failed to sync Instagram insights' });
  }
});

/**
 * Get Instagram insights summary for admin dashboard
 */
router.get('/admin/summary', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'From and to dates are required' });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    // Get aggregated insights across all customers
    const pipeline = [
      {
        $match: {
          end_time: { $gte: fromDate, $lte: toDate }
        }
      },
      {
        $group: {
          _id: '$metric',
          totalValue: { $sum: '$value' },
          avgValue: { $avg: '$value' },
          count: { $sum: 1 }
        }
      }
    ];

    const userInsightsSummary = await InstaUserInsight.aggregate(pipeline);

    // Get media insights summary
    const mediaInsightsSummary = await InstaMediaInsight.aggregate([
      {
        $match: {
          posted_at: { $gte: fromDate, $lte: toDate }
        }
      },
      {
        $group: {
          _id: null,
          totalReach: { $sum: '$metrics.reach' },
          totalImpressions: { $sum: '$metrics.impressions' },
          totalLikes: { $sum: '$metrics.likes' },
          totalComments: { $sum: '$metrics.comments' },
          totalSaves: { $sum: '$metrics.saves' },
          avgEngagement: { $avg: '$metrics.engagement' },
          postCount: { $sum: 1 }
        }
      }
    ]);

    res.json({
      userInsights: userInsightsSummary,
      mediaInsights: mediaInsightsSummary[0] || {
        totalReach: 0,
        totalImpressions: 0,
        totalLikes: 0,
        totalComments: 0,
        totalSaves: 0,
        avgEngagement: 0,
        postCount: 0
      }
    });

  } catch (error) {
    console.error('Error fetching Instagram insights summary:', error);
    res.status(500).json({ error: 'Failed to fetch Instagram insights summary' });
  }
});

module.exports = router;
