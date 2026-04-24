const express = require('express');
const InstaUserInsight = require('../models/InstaUserInsight');
const InstaMediaInsight = require('../models/InstaMediaInsight');
const User = require('../models/User');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');
const { syncInstagramInsightsForUser } = require('../utils/instagramInsightsSync');

const router = express.Router();

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

    const fromDate = new Date(from);
    const toDate = new Date(to);
    const customer = await User.findById(customerId).select('instagramAccountId instagramUsername facebookAccessToken facebookUserAccessToken');

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
          totals.followerCount = insight.value; // Latest follower count
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

    const fromDate = new Date(from);
    const toDate = new Date(to);
    const periodLength = toDate.getTime() - fromDate.getTime();
    const previousFromDate = new Date(fromDate.getTime() - periodLength);
    const customer = await User.findById(customerId).select(
      'instagramAccountId instagramAccountName instagramUsername facebookAccessToken facebookUserAccessToken facebookPageName'
    );

    let syncStatus = {
      synced: false,
      reason: 'Instagram direct sync was skipped.',
    };

    if (customer) {
      try {
        syncStatus = await syncInstagramInsightsForUser(
          { ...customer.toObject(), _id: customerId },
          { from: previousFromDate, to: toDate }
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
          currentTotals.followerCount = insight.value;
          break;
      }
    });

    // Process media insights
    mediaInsights.forEach(media => {
      currentTotals.totalEngagement += media.metrics.engagement || 0;
    });

    const previousToDate = new Date(fromDate.getTime());

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
      totalEngagement: 0
    };

    previousUserInsights.forEach(insight => {
      switch (insight.metric) {
        case 'impressions':
          previousTotals.totalImpressions += insight.value;
          break;
        case 'reach':
          previousTotals.totalReach += insight.value;
          break;
        case 'profile_views':
          previousTotals.totalProfileViews += insight.value;
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
      connection: {
        instagramAccountId: customer?.instagramAccountId || null,
        instagramAccountName: customer?.instagramAccountName || null,
        instagramUsername: customer?.instagramUsername || null,
        facebookPageName: customer?.facebookPageName || null,
      },
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
      'instagramAccountId instagramUsername facebookAccessToken facebookUserAccessToken'
    );

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 90);

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
