const express = require('express');
const InstaUserInsight = require('../models/InstaUserInsight');
const InstaMediaInsight = require('../models/InstaMediaInsight');
const crypto = require('crypto');

const router = express.Router();

// Authentication middleware for Make.com API calls
const auth = (req, res, next) => {
  const key = req.headers.authorization?.replace('Bearer ', '').trim();
  if (!key || key !== process.env.INGEST_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Helper to create idempotency key from payload essentials
const createIdemKey = (str) => crypto.createHash('sha256').update(str).digest('hex');

/**
 * Instagram User Insights endpoint
 * Receives daily Instagram account metrics from Make.com
 */
router.post('/instagram/insights', auth, async (req, res) => {
  try {
    const { account_id, period, metrics, time_window, customer_id } = req.body;

    // Simple validation
    if (!account_id || !Array.isArray(metrics) || !customer_id || !period || !time_window) {
      return res.status(400).json({ 
        error: 'Missing required fields: account_id, metrics, customer_id, period, time_window' 
      });
    }

    // Process each metric
    const docs = metrics.map((metric) => ({
      account_id,
      period,
      metric: metric.name,
      value: Number(metric.value ?? 0),
      end_time: new Date(metric.end_time),
      customer_id,
      source: 'instagram_user',
      idem: createIdemKey(`${account_id}:${metric.name}:${metric.end_time}:${period}`)
    }));

    // Bulk upsert by unique idempotency key
    const bulkOps = docs.map((doc) => ({
      updateOne: {
        filter: { idem: doc.idem },
        update: { $set: doc },
        upsert: true
      }
    }));

    const result = await InstaUserInsight.bulkWrite(bulkOps);

    console.log(`Instagram user insights processed: ${docs.length} metrics for account ${account_id}`);
    
    res.json({ 
      success: true,
      upserted: docs.length,
      modified: result.modifiedCount,
      upsertedCount: result.upsertedCount
    });

  } catch (error) {
    console.error('Error processing Instagram user insights:', error);
    res.status(500).json({ error: 'Failed to process Instagram insights' });
  }
});

/**
 * Instagram Media Insights endpoint
 * Receives individual post metrics from Make.com
 */
router.post('/instagram/media-insights', auth, async (req, res) => {
  try {
    const { 
      account_id, 
      media_id, 
      media_type,
      caption,
      permalink,
      metrics, 
      posted_at, 
      customer_id 
    } = req.body;

    // Simple validation
    if (!account_id || !media_id || !metrics || !customer_id || !posted_at) {
      return res.status(400).json({ 
        error: 'Missing required fields: account_id, media_id, metrics, customer_id, posted_at' 
      });
    }

    const doc = {
      account_id,
      media_id,
      media_type: media_type || 'unknown',
      caption: caption || '',
      permalink: permalink || '',
      posted_at: new Date(posted_at),
      metrics: {
        reach: Number(metrics.reach ?? 0),
        impressions: Number(metrics.impressions ?? 0),
        likes: Number(metrics.likes ?? 0),
        comments: Number(metrics.comments ?? 0),
        saves: Number(metrics.saves ?? 0),
        engagement: Number(metrics.engagement ?? 0),
        plays: Number(metrics.plays ?? 0)
      },
      customer_id,
      source: 'instagram_media',
      idem: createIdemKey(`${account_id}:${media_id}`)
    };

    const result = await InstaMediaInsight.updateOne(
      { idem: doc.idem }, 
      { $set: doc }, 
      { upsert: true }
    );

    console.log(`Instagram media insights processed: ${media_id} for account ${account_id}`);
    
    res.json({ 
      success: true,
      upserted: result.upsertedCount > 0,
      modified: result.modifiedCount > 0
    });

  } catch (error) {
    console.error('Error processing Instagram media insights:', error);
    res.status(500).json({ error: 'Failed to process Instagram media insights' });
  }
});

/**
 * Health check endpoint for Make.com monitoring
 */
router.get('/instagram/health', auth, async (req, res) => {
  try {
    const latestUserInsight = await InstaUserInsight.findOne()
      .sort({ end_time: -1 })
      .select('end_time account_id');
    
    const latestMediaInsight = await InstaMediaInsight.findOne()
      .sort({ posted_at: -1 })
      .select('posted_at account_id');

    res.json({
      status: 'healthy',
      latest_user_insight: latestUserInsight,
      latest_media_insight: latestMediaInsight,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

module.exports = router;