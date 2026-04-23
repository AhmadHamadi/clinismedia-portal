const express = require('express');
const axios = require('axios');
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');
const User = require('../models/User');
const MetaLead = require('../models/MetaLead');
const CallLog = require('../models/CallLog');
const RetellCall = require('../models/RetellCall');
const GoogleBusinessInsights = require('../models/GoogleBusinessInsights');
const InstaUserInsight = require('../models/InstaUserInsight');
const InstaMediaInsight = require('../models/InstaMediaInsight');
const ReviewCampaign = require('../models/ReviewCampaign');
const ReviewSession = require('../models/ReviewSession');
const ConcernSubmission = require('../models/ConcernSubmission');
const ReviewEvent = require('../models/ReviewEvent');
const { findGoogleIntegrationAdminUser } = require('../utils/googleIntegrationAdminUser');

const MCC_CUSTOMER_ID = '4037087680';
const NINETY_MIN_MS = 90 * 60 * 1000;

function parseUtcStart(dateString) {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function parseUtcEnd(dateString) {
  return new Date(`${dateString}T23:59:59.999Z`);
}

function formatDateOnly(date) {
  return date.toISOString().split('T')[0];
}

function getPresetRange(preset) {
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(end);

  switch (preset) {
    case 'thisMonth':
      start.setUTCDate(1);
      start.setUTCHours(0, 0, 0, 0);
      return { start, end, label: 'Monthly Report' };
    case 'lastMonth': {
      const lastMonthEnd = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 0, 23, 59, 59, 999));
      const lastMonthStart = new Date(Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth(), 1, 0, 0, 0, 0));
      return { start: lastMonthStart, end: lastMonthEnd, label: 'Last Month Report' };
    }
    case 'last30Days':
      start.setUTCDate(start.getUTCDate() - 29);
      start.setUTCHours(0, 0, 0, 0);
      return { start, end, label: '30 Day Report' };
    case 'last14Days':
    default:
      start.setUTCDate(start.getUTCDate() - 13);
      start.setUTCHours(0, 0, 0, 0);
      return { start, end, label: 'Biweekly Report' };
  }
}

function getRequestedRange(query) {
  const { start, end, preset, label } = query;
  if (start && end) {
    return {
      start: parseUtcStart(start),
      end: parseUtcEnd(end),
      label: label || 'Custom Report',
    };
  }

  const presetRange = getPresetRange(preset);
  if (label) {
    presetRange.label = label;
  }
  return presetRange;
}

function countBookedClusters90Min(docs) {
  if (!docs || docs.length === 0) return 0;

  const byFrom = {};
  for (const doc of docs) {
    const key = doc.from || 'unknown';
    if (!byFrom[key]) byFrom[key] = [];
    const timestamp = doc.startedAt instanceof Date ? doc.startedAt.getTime() : new Date(doc.startedAt).getTime();
    if (Number.isFinite(timestamp)) byFrom[key].push(timestamp);
  }

  let total = 0;
  for (const times of Object.values(byFrom)) {
    times.sort((a, b) => a - b);
    if (times.length === 0) continue;
    let clusters = 1;
    for (let i = 1; i < times.length; i += 1) {
      if (times[i] - times[i - 1] > NINETY_MIN_MS) {
        clusters += 1;
      }
    }
    total += clusters;
  }

  return total;
}

function sumMetricValues(values = []) {
  return values.reduce((sum, item) => sum + Number(item?.value || 0), 0);
}

function formatDuration(seconds) {
  if (!seconds) return '0s';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function calculatePercentageChange(previous, current) {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function extractCallAnalysisField(callAnalysis, ...keys) {
  if (!callAnalysis || typeof callAnalysis !== 'object') return null;

  const candidates = [
    callAnalysis,
    callAnalysis.raw,
    callAnalysis.custom_analysis_data,
    callAnalysis.custom_analysis,
    callAnalysis.analysis_data,
    callAnalysis.extracted_data,
  ].filter((value) => value && typeof value === 'object');

  for (const key of keys) {
    for (const candidate of candidates) {
      const value = candidate[key];
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
  }

  return null;
}

async function getGoogleAdsAccessToken(req) {
  const adminUser = await findGoogleIntegrationAdminUser(req, 'googleAds');
  if (!adminUser?.googleAdsRefreshToken) {
    throw new Error('Admin Google Ads is not connected');
  }

  const now = Date.now();
  const expiresAt = adminUser.googleAdsTokenExpiry ? new Date(adminUser.googleAdsTokenExpiry).getTime() : 0;
  const refreshThreshold = 5 * 60 * 1000;

  if (adminUser.googleAdsAccessToken && expiresAt > now + refreshThreshold) {
    return adminUser.googleAdsAccessToken;
  }

  const response = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    refresh_token: adminUser.googleAdsRefreshToken,
    grant_type: 'refresh_token',
  });

  const { access_token, refresh_token, expires_in } = response.data;
  await User.findByIdAndUpdate(adminUser._id, {
    googleAdsAccessToken: access_token,
    googleAdsRefreshToken: refresh_token || adminUser.googleAdsRefreshToken,
    googleAdsTokenExpiry: new Date(Date.now() + (expires_in || 3600) * 1000),
  });

  return access_token;
}

async function executeGoogleAdsQuery(accessToken, customerId, query) {
  const url = `https://googleads.googleapis.com/v22/customers/${customerId}/googleAds:search`;
  const response = await axios.post(
    url,
    { query },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        'login-customer-id': MCC_CUSTOMER_ID,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data.results || [];
}

async function buildMetaLeadsSection(customerId, start, end) {
  const match = {
    customerId,
    emailDate: { $gte: start, $lte: end },
  };

  const [totalLeads, contactedLeads, bookedAppointments, recentLeads, campaigns] = await Promise.all([
    MetaLead.countDocuments(match),
    MetaLead.countDocuments({ ...match, status: 'contacted' }),
    MetaLead.countDocuments({ ...match, appointmentBooked: true }),
    MetaLead.find(match).sort({ emailDate: -1 }).limit(5).select('leadInfo emailDate campaignName status appointmentBooked').lean(),
    MetaLead.aggregate([
      { $match: match },
      { $group: { _id: '$campaignName', leads: { $sum: 1 } } },
      { $match: { _id: { $nin: [null, ''] } } },
      { $sort: { leads: -1, _id: 1 } },
      { $limit: 5 },
    ]),
  ]);

  if (!totalLeads && campaigns.length === 0 && recentLeads.length === 0) {
    return null;
  }

  return {
    id: 'metaLeads',
    title: 'Meta Leads',
    summary: {
      totalLeads,
      contactedLeads,
      bookedAppointments,
    },
    highlights: [
      `${totalLeads} leads received`,
      `${contactedLeads} marked contacted`,
      `${bookedAppointments} appointments marked booked`,
    ],
    campaigns: campaigns.map((item) => ({
      campaignName: item._id,
      leads: item.leads,
    })),
    recentLeads: recentLeads.map((lead) => ({
      name: lead.leadInfo?.name || 'Unknown lead',
      emailDate: lead.emailDate,
      campaignName: lead.campaignName || null,
      status: lead.status,
      appointmentBooked: lead.appointmentBooked,
    })),
  };
}

async function buildCallTrackingSection(customerId, start, end) {
  const query = {
    customerId,
    startedAt: { $gte: start, $lte: end },
  };

  const [totalCalls, answeredCalls, missedCalls, newPatientCalls, existingPatientCalls, bookedLogs, newPatientBookedLogs, durationResult] = await Promise.all([
    CallLog.countDocuments(query),
    CallLog.countDocuments({ ...query, dialCallStatus: 'answered' }),
    CallLog.countDocuments({ ...query, dialCallStatus: { $exists: true, $ne: null, $ne: 'answered' } }),
    CallLog.countDocuments({ ...query, menuChoice: '1' }),
    CallLog.countDocuments({ ...query, menuChoice: '2' }),
    CallLog.find({ ...query, appointmentBooked: true }).select('from startedAt').sort({ from: 1, startedAt: 1 }).lean(),
    CallLog.find({ ...query, menuChoice: '1', appointmentBooked: true }).select('from startedAt').sort({ from: 1, startedAt: 1 }).lean(),
    CallLog.aggregate([
      { $match: { ...query, dialCallStatus: 'answered' } },
      { $group: { _id: null, totalDuration: { $sum: '$duration' } } },
    ]),
  ]);

  if (!totalCalls) {
    return null;
  }

  const appointmentsBooked = countBookedClusters90Min(bookedLogs);
  const newPatientAppointmentsBooked = countBookedClusters90Min(newPatientBookedLogs);
  const totalDuration = durationResult[0]?.totalDuration || 0;
  const avgDuration = answeredCalls > 0 ? Math.round(totalDuration / answeredCalls) : 0;

  return {
    id: 'callTracking',
    title: 'Call Tracking',
    summary: {
      totalCalls,
      answeredCalls,
      missedCalls,
      newPatientCalls,
      existingPatientCalls,
      appointmentsBooked,
      newPatientAppointmentsBooked,
      totalDuration,
      avgDuration,
      totalDurationFormatted: formatDuration(totalDuration),
      avgDurationFormatted: formatDuration(avgDuration),
    },
    highlights: [
      `${totalCalls} total tracked calls`,
      `${answeredCalls} answered calls`,
      `${newPatientCalls} new patient calls`,
      `${appointmentsBooked} booked appointment clusters`,
    ],
  };
}

async function buildAiReceptionSection(customer, start, end) {
  const calls = await RetellCall.find({
    customerId: customer._id,
    startTimestamp: { $gte: start, $lte: end },
  })
    .sort({ startTimestamp: -1 })
    .lean();

  if (!calls.length) {
    return null;
  }

  const appointmentIntentCount = calls.filter((call) => extractCallAnalysisField(call.callAnalysis, 'appointmentIntent', 'appointment_intent') === true).length;
  const urgentCount = calls.filter((call) => {
    const urgency = extractCallAnalysisField(call.callAnalysis, 'urgencyLevel', 'urgency_level');
    return typeof urgency === 'string' && ['urgent', 'high', 'emergency'].includes(urgency.toLowerCase());
  }).length;
  const callbackRequested = calls.filter((call) => !!extractCallAnalysisField(call.callAnalysis, 'callbackNumber', 'callback_number', 'phone_number')).length;
  const afterHoursCalls = calls.filter((call) => {
    const callTime = call.startTimestamp ? new Date(call.startTimestamp) : null;
    if (!callTime) return false;
    const timezone = customer.aiReceptionistSettings?.timezone || 'America/Toronto';
    const businessHours = customer.aiReceptionistSettings?.businessHours || {};
    const weekday = callTime.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone }).toLowerCase();
    const hours = businessHours[weekday];
    if (!hours?.enabled) return true;
    const localTime = callTime.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    });
    return localTime < hours.start || localTime > hours.end;
  }).length;

  const reasonCounts = {};
  calls.forEach((call) => {
    const reason = extractCallAnalysisField(call.callAnalysis, 'reasonForCall', 'reason_for_call');
    if (typeof reason === 'string' && reason.trim()) {
      reasonCounts[reason.trim()] = (reasonCounts[reason.trim()] || 0) + 1;
    }
  });

  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));

  return {
    id: 'aiReception',
    title: 'AI Reception',
    summary: {
      totalCalls: calls.length,
      appointmentIntentCount,
      urgentCount,
      callbackRequested,
      afterHoursCalls,
    },
    highlights: [
      `${calls.length} AI-reception calls`,
      `${appointmentIntentCount} calls showed appointment intent`,
      `${urgentCount} calls flagged urgent`,
      `${callbackRequested} calls captured a callback number`,
    ],
    topReasons,
  };
}

async function buildGoogleBusinessSection(customerId, start, end) {
  const latestInsights = await GoogleBusinessInsights.findOne({ customerId }).sort({ date: -1, lastUpdated: -1 }).lean();
  if (!latestInsights) {
    return null;
  }

  const startString = formatDateOnly(start);
  const endString = formatDateOnly(end);
  const filteredDailyData = (latestInsights.dailyData || []).filter((item) => item.date >= startString && item.date <= endString);
  const dailySource = filteredDailyData.length > 0 ? filteredDailyData : latestInsights.dailyData || [];

  const totals = dailySource.reduce(
    (acc, item) => {
      acc.searches += Number(item.searches || 0);
      acc.views += Number(item.views || 0);
      acc.calls += Number(item.calls || 0);
      acc.directions += Number(item.directions || 0);
      acc.websiteClicks += Number(item.websiteClicks || 0);
      return acc;
    },
    { searches: 0, views: 0, calls: 0, directions: 0, websiteClicks: 0 }
  );

  return {
    id: 'googleBusiness',
    title: 'Google Business Profile',
    summary: totals,
    highlights: [
      `${totals.searches} Google Business searches`,
      `${totals.views} profile views`,
      `${totals.calls} calls from profile`,
      `${totals.websiteClicks} website clicks`,
    ],
    sourceWindow: {
      periodStart: latestInsights.period?.start || null,
      periodEnd: latestInsights.period?.end || null,
      lastUpdated: latestInsights.lastUpdated || latestInsights.updatedAt,
    },
  };
}

async function buildInstagramSection(customerId, start, end) {
  const [userInsights, mediaInsights] = await Promise.all([
    InstaUserInsight.find({
      customer_id: String(customerId),
      end_time: { $gte: start, $lte: end },
    }).sort({ end_time: -1 }).lean(),
    InstaMediaInsight.find({
      customer_id: String(customerId),
      posted_at: { $gte: start, $lte: end },
    }).sort({ posted_at: -1 }).lean(),
  ]);

  if (!userInsights.length && !mediaInsights.length) {
    return null;
  }

  const totals = {
    totalReach: 0,
    totalImpressions: 0,
    totalProfileViews: 0,
    totalWebsiteClicks: 0,
    followerCount: 0,
    totalEngagement: 0,
    totalPlays: 0,
    postCount: mediaInsights.length,
  };

  userInsights.forEach((insight) => {
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
        totals.followerCount = insight.value;
        break;
      default:
        break;
    }
  });

  mediaInsights.forEach((media) => {
    totals.totalEngagement += Number(media.metrics?.engagement || 0);
    totals.totalPlays += Number(media.metrics?.plays || 0);
  });

  const avgEngagement = mediaInsights.length ? Math.round(totals.totalEngagement / mediaInsights.length) : 0;
  const topPosts = mediaInsights
    .map((media) => ({
      caption: media.caption || '',
      permalink: media.permalink || '',
      postedAt: media.posted_at,
      reach: Number(media.metrics?.reach || 0),
      impressions: Number(media.metrics?.impressions || 0),
      engagement: Number(media.metrics?.engagement || 0),
      plays: Number(media.metrics?.plays || 0),
    }))
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 5);

  return {
    id: 'instagram',
    title: 'Instagram',
    summary: {
      ...totals,
      avgEngagement,
    },
    highlights: [
      `${totals.totalReach} reach`,
      `${totals.totalImpressions} impressions`,
      `${totals.totalProfileViews} profile views`,
      `${totals.totalPlays} plays/views`,
    ],
    topPosts,
  };
}

async function fetchFacebookMetric(user, metric, start, end) {
  const response = await axios.get(
    `https://graph.facebook.com/v19.0/${user.facebookPageId}/insights`,
    {
      params: {
        metric,
        period: 'day',
        since: formatDateOnly(start),
        until: formatDateOnly(end),
        access_token: user.facebookAccessToken,
      },
    }
  );

  if (Array.isArray(response.data?.data) && response.data.data.length > 0) {
    return response.data.data[0].values || [];
  }

  return [];
}

async function buildFacebookSection(customer, start, end) {
  if (!customer.facebookPageId || !customer.facebookAccessToken) {
    return null;
  }

  const metrics = [
    { key: 'impressions', metric: 'page_impressions_unique' },
    { key: 'reach', metric: 'page_impressions_unique' },
    { key: 'engagements', metric: 'page_post_engagements' },
    { key: 'followers', metric: 'page_follows' },
    { key: 'pageViews', metric: 'page_views_total' },
    { key: 'videoViews', metric: 'page_video_views' },
  ];

  const results = await Promise.all(
    metrics.map(async ({ key, metric }) => {
      const values = await fetchFacebookMetric(customer, metric, start, end).catch(() => []);
      return [key, values];
    })
  );

  const metricMap = Object.fromEntries(results);
  const currentFollowers = Array.isArray(metricMap.followers) && metricMap.followers.length
    ? Number(metricMap.followers[metricMap.followers.length - 1]?.value || 0)
    : 0;

  return {
    id: 'facebook',
    title: 'Facebook',
    summary: {
      totalImpressions: sumMetricValues(metricMap.impressions),
      totalReach: sumMetricValues(metricMap.reach),
      totalEngagements: sumMetricValues(metricMap.engagements),
      currentFollowers,
      totalPageViews: sumMetricValues(metricMap.pageViews),
      totalVideoViews: sumMetricValues(metricMap.videoViews),
    },
    highlights: [
      `${sumMetricValues(metricMap.reach)} reach`,
      `${sumMetricValues(metricMap.engagements)} engagements`,
      `${currentFollowers} followers`,
      `${sumMetricValues(metricMap.videoViews)} video views`,
    ],
    pageInfo: {
      id: customer.facebookPageId,
      name: customer.facebookPageName || 'Facebook Page',
    },
  };
}

async function buildGoogleAdsSection(req, customer, start, end) {
  if (!customer.googleAdsCustomerId) {
    return null;
  }

  const accessToken = await getGoogleAdsAccessToken(req);
  const from = formatDateOnly(start);
  const to = formatDateOnly(end);

  const kpiQuery = `
    SELECT
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions
    FROM customer
    WHERE segments.date BETWEEN '${from}' AND '${to}'
  `;

  const campaignQuery = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions,
      metrics.ctr
    FROM campaign
    WHERE segments.date BETWEEN '${from}' AND '${to}'
      AND campaign.status = 'ENABLED'
  `;

  const [kpiResults, campaignResults] = await Promise.all([
    executeGoogleAdsQuery(accessToken, customer.googleAdsCustomerId, kpiQuery),
    executeGoogleAdsQuery(accessToken, customer.googleAdsCustomerId, campaignQuery),
  ]);

  const totals = kpiResults.reduce(
    (acc, row) => {
      const metrics = row.metrics || {};
      acc.spend += Number(metrics.costMicros || metrics.cost_micros || 0) / 1_000_000;
      acc.clicks += Number(metrics.clicks || 0);
      acc.impressions += Number(metrics.impressions || 0);
      acc.conversions += Number(metrics.conversions || 0);
      return acc;
    },
    { spend: 0, clicks: 0, impressions: 0, conversions: 0 }
  );

  const ctr = totals.impressions > 0 ? Number(((totals.clicks / totals.impressions) * 100).toFixed(2)) : 0;
  const campaigns = campaignResults
    .map((row) => {
      const campaign = row.campaign || {};
      const metrics = row.metrics || {};
      return {
        id: String(campaign.id || ''),
        name: campaign.name || '',
        status: campaign.status || '',
        channel: campaign.advertisingChannelType || campaign.advertising_channel_type || '',
        spend: Number(metrics.costMicros || metrics.cost_micros || 0) / 1_000_000,
        clicks: Number(metrics.clicks || 0),
        impressions: Number(metrics.impressions || 0),
        conversions: Number(metrics.conversions || 0),
        ctr: Number(metrics.ctr || 0),
      };
    })
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 8);

  return {
    id: 'googleAds',
    title: 'Google Ads',
    summary: {
      spend: Number(totals.spend.toFixed(2)),
      clicks: totals.clicks,
      impressions: totals.impressions,
      conversions: totals.conversions,
      ctr,
    },
    highlights: [
      `${totals.impressions} impressions`,
      `${totals.clicks} clicks`,
      `${totals.conversions} conversions`,
      `$${totals.spend.toFixed(2)} spend`,
    ],
    campaigns,
  };
}

async function buildQrReviewsSection(customerId, start, end) {
  const campaigns = await ReviewCampaign.find({ customerId, isActive: true }).lean();
  if (!campaigns.length) {
    return null;
  }

  const campaignSummaries = await Promise.all(
    campaigns.map(async (campaign) => {
      const campaignId = campaign._id;
      const eventDateFilter = { createdAt: { $gte: start, $lte: end } };
      const [scans, reviewsGenerated, copyClicks, googleClicks, concernSubmissions] = await Promise.all([
        ReviewEvent.countDocuments({ campaignId, eventType: 'session_started', ...eventDateFilter }),
        ReviewEvent.countDocuments({ campaignId, eventType: 'review_generated', ...eventDateFilter }),
        ReviewEvent.countDocuments({ campaignId, eventType: 'review_copied', ...eventDateFilter }),
        ReviewEvent.countDocuments({ campaignId, eventType: 'google_clicked', ...eventDateFilter }),
        ReviewEvent.countDocuments({ campaignId, eventType: 'concern_submitted', ...eventDateFilter }),
      ]);

      const sessionDateFilter = { createdAt: { $gte: start, $lte: end } };
      const fallbackScans = scans || await ReviewSession.countDocuments({ campaignId, ...sessionDateFilter });
      const fallbackGenerated = reviewsGenerated || await ReviewSession.countDocuments({
        campaignId,
        ...sessionDateFilter,
        status: { $in: ['review_generated', 'copied'] },
      });
      const fallbackCopied = copyClicks || await ReviewSession.countDocuments({ campaignId, ...sessionDateFilter, status: 'copied' });
      const fallbackConcerns = concernSubmissions || await ConcernSubmission.countDocuments({ campaignId, createdAt: { $gte: start, $lte: end } });

      return {
        clinicName: campaign.clinicName,
        slug: campaign.slug,
        scans: fallbackScans,
        reviewsGenerated: fallbackGenerated,
        copyClicks: fallbackCopied,
        googleClicks,
        concernSubmissions: fallbackConcerns,
      };
    })
  );

  const summary = campaignSummaries.reduce(
    (acc, campaign) => {
      acc.scans += campaign.scans;
      acc.reviewsGenerated += campaign.reviewsGenerated;
      acc.copyClicks += campaign.copyClicks;
      acc.googleClicks += campaign.googleClicks;
      acc.concernSubmissions += campaign.concernSubmissions;
      return acc;
    },
    { scans: 0, reviewsGenerated: 0, copyClicks: 0, googleClicks: 0, concernSubmissions: 0 }
  );

  return {
    id: 'qrReviews',
    title: 'QR Reviews',
    summary,
    highlights: [
      `${summary.scans} QR review sessions`,
      `${summary.reviewsGenerated} reviews generated`,
      `${summary.googleClicks} Google review clicks`,
      `${summary.concernSubmissions} concern submissions`,
    ],
    campaigns: campaignSummaries,
  };
}

router.get('/marketing', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { customerId } = req.query;
    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const customer = await User.findOne({ _id: customerId, role: 'customer' }).lean();
    if (!customer) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    const range = getRequestedRange(req.query);
    const sectionBuilders = [];

    sectionBuilders.push(buildMetaLeadsSection(customer._id, range.start, range.end));

    if (customer.twilioPhoneNumber) {
      sectionBuilders.push(buildCallTrackingSection(customer._id, range.start, range.end));
    }

    if (customer.aiReceptionistSettings?.enabled) {
      sectionBuilders.push(buildAiReceptionSection(customer, range.start, range.end));
    }

    if (customer.googleBusinessProfileId) {
      sectionBuilders.push(buildGoogleBusinessSection(customer._id, range.start, range.end));
    }

    sectionBuilders.push(buildInstagramSection(customer._id, range.start, range.end));

    if (customer.facebookPageId && customer.facebookAccessToken) {
      sectionBuilders.push(buildFacebookSection(customer, range.start, range.end));
    }

    if (customer.googleAdsCustomerId) {
      sectionBuilders.push(buildGoogleAdsSection(req, customer, range.start, range.end).catch((error) => ({
        id: 'googleAds',
        title: 'Google Ads',
        error: error.message,
      })));
    }

    sectionBuilders.push(buildQrReviewsSection(customer._id, range.start, range.end));

    const sections = (await Promise.all(sectionBuilders)).filter(Boolean);
    const sectionMap = Object.fromEntries(sections.map((section) => [section.id, section]));

    const overview = {
      totalLeads: sectionMap.metaLeads?.summary?.totalLeads || 0,
      bookedMetaAppointments: sectionMap.metaLeads?.summary?.bookedAppointments || 0,
      totalCalls: sectionMap.callTracking?.summary?.totalCalls || 0,
      newPatientCalls: sectionMap.callTracking?.summary?.newPatientCalls || 0,
      callAppointmentsBooked: sectionMap.callTracking?.summary?.appointmentsBooked || 0,
      aiCalls: sectionMap.aiReception?.summary?.totalCalls || 0,
    };

    const recommendations = [];
    if (!customer.googleAdsCustomerId) recommendations.push('Google Ads is not assigned for this clinic.');
    if (!customer.googleBusinessProfileId) recommendations.push('Google Business Profile is not connected for this clinic.');
    if (!customer.facebookPageId) recommendations.push('Facebook Page is not connected for this clinic.');
    if (!customer.twilioPhoneNumber) recommendations.push('Call tracking is not configured for this clinic.');
    if (!customer.aiReceptionistSettings?.enabled) recommendations.push('AI Reception is not enabled for this clinic.');

    res.json({
      generatedAt: new Date().toISOString(),
      reportTitle: `CliniMedia ${range.label}`,
      period: {
        start: formatDateOnly(range.start),
        end: formatDateOnly(range.end),
        label: range.label,
      },
      clinic: {
        id: customer._id,
        name: customer.customerSettings?.displayName || customer.name,
        email: customer.email,
        location: customer.location,
        logoUrl: customer.customerSettings?.logoUrl || null,
      },
      overview,
      sections,
      recommendations,
      availableIntegrations: {
        metaLeads: true,
        googleAds: !!customer.googleAdsCustomerId,
        googleBusiness: !!customer.googleBusinessProfileId,
        facebook: !!customer.facebookPageId,
        instagram: !!sectionMap.instagram,
        callTracking: !!customer.twilioPhoneNumber,
        aiReception: !!customer.aiReceptionistSettings?.enabled,
        qrReviews: !!sectionMap.qrReviews,
      },
    });
  } catch (error) {
    console.error('Error generating marketing report:', error);
    res.status(500).json({ error: 'Failed to generate marketing report', details: error.message });
  }
});

module.exports = router;
