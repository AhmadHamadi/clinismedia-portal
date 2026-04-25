const express = require('express');
const axios = require('axios');
const router = express.Router();

const GRAPH_API_BASE = 'https://graph.facebook.com/v22.0';
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
const { syncInstagramInsightsForUser } = require('../utils/instagramInsightsSync');
const {
  buildSearchConsolePerformance,
  getAuthorizedSearchConsoleClient,
} = require('./searchConsole');
const { fetchBusinessInsightsData } = require('./googleBusiness');
const { google } = require('googleapis');

let OpenAI = null;
try {
  OpenAI = require('openai');
} catch (error) {
  console.log('[Reports] OpenAI package not available, using template email drafts only.');
}

const MCC_CUSTOMER_ID = '4037087680';
const NINETY_MIN_MS = 90 * 60 * 1000;

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

function formatDateOnly(date) {
  return date.toISOString().split('T')[0];
}

function getPresetRange(preset) {
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(end);

  switch (preset) {
    case 'last7Days':
      start.setUTCDate(start.getUTCDate() - 6);
      start.setUTCHours(0, 0, 0, 0);
      return { start, end, label: '7 Day Performance Report' };
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
      return { start, end, label: '30 Day Performance Report' };
    case 'last90Days':
      start.setUTCDate(start.getUTCDate() - 89);
      start.setUTCHours(0, 0, 0, 0);
      return { start, end, label: '90 Day Performance Report' };
    case 'last14Days':
    default:
      start.setUTCDate(start.getUTCDate() - 13);
      start.setUTCHours(0, 0, 0, 0);
      return { start, end, label: 'Biweekly Report' };
  }
}

function getClinicTimezone(customer) {
  return customer?.aiReceptionistSettings?.timezone || 'America/Toronto';
}

function shiftDateString(dateString, days) {
  const base = new Date(`${dateString}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().split('T')[0];
}

function getGoogleBusinessEffectiveRange(start, end) {
  const requestedStart = formatDateOnly(start);
  const requestedEnd = formatDateOnly(end);
  const bufferedEnd = shiftDateString(requestedEnd, -2);

  if (requestedStart > bufferedEnd) {
    return {
      start: requestedStart,
      end: requestedStart,
      requestedStart,
      requestedEnd,
      buffered: false,
    };
  }

  return {
    start: requestedStart,
    end: bufferedEnd,
    requestedStart,
    requestedEnd,
    buffered: bufferedEnd !== requestedEnd,
  };
}

function getRequestedRange(customer, query) {
  const { start, end, preset, label } = query;
  const timezone = getClinicTimezone(customer);
  if (start && end) {
    return {
      start: convertClinicLocalDateTimeToUtc(start, timezone, false),
      end: convertClinicLocalDateTimeToUtc(end, timezone, true),
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

function sanitizeFilePart(value, fallback) {
  const normalized = String(value || fallback || '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return normalized || fallback;
}

function buildReportExportFilename(clinicName, period) {
  const clinicPart = sanitizeFilePart(clinicName, 'clinic');
  const startPart = sanitizeFilePart(period.start, 'start');
  const endPart = sanitizeFilePart(period.end, 'end');
  return `${clinicPart}-marketing-report-${startPart}-to-${endPart}.pdf`;
}

function collectTopHighlights(sections = []) {
  return sections
    .flatMap((section) => (section.highlights || []).map((highlight) => `${section.title}: ${highlight}`))
    .filter(Boolean)
    .slice(0, 4);
}

function buildFallbackMarketingEmailDraft(report) {
  const highlights = collectTopHighlights(report.sections);
  const highlightLines = highlights.length
    ? highlights.map((item) => `- ${item}`).join('\n')
    : '- Strongest opportunities and wins are summarized in the attached report.';

  const recommendationLine = report.recommendations.length
    ? `A few items still need attention: ${report.recommendations.slice(0, 2).join('; ')}.`
    : 'Everything included in this report reflects the integrations currently active for the clinic.';

  return {
    subject: `${report.clinic.name} marketing report | ${report.period.label}`,
    body: [
      `Hi ${report.clinic.name} team,`,
      '',
      `Attached is your CliniMedia marketing report for ${report.period.start} to ${report.period.end}.`,
      '',
      `At a glance, the clinic recorded ${report.overview.totalLeads} total leads, ${report.overview.bookedMetaAppointments} booked Meta leads, ${report.overview.totalCalls} tracked calls, and ${report.overview.aiCalls} AI receptionist calls during this period.`,
      '',
      'A few key notes from this report:',
      highlightLines,
      '',
      recommendationLine,
      '',
      'Please let us know if you would like us to walk through the report live or prioritize any follow-up actions for the next reporting cycle.',
      '',
      'Best,',
      'CliniMedia',
    ].join('\n'),
    source: 'template',
  };
}

async function generateMarketingEmailDraft(report) {
  const fallback = buildFallbackMarketingEmailDraft(report);
  if (!OpenAI || !process.env.OPENAI_API_KEY) {
    return fallback;
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.6,
      max_tokens: 450,
      messages: [
        {
          role: 'system',
          content: `You write short, polished client update emails for a dental marketing agency.

Return JSON with keys "subject" and "body".

Rules:
- Keep the email concise and professional.
- Sound human, confident, and clear.
- Mention the report date range.
- Use the report numbers provided.
- Do not invent metrics.
- Do not use markdown, emojis, or placeholders.
- Body should be plain text with short paragraphs and a brief bullet list when useful.
- End with "Best," on one line and "CliniMedia" on the next line.`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            clinic: report.clinic,
            period: report.period,
            overview: report.overview,
            recommendations: report.recommendations,
            topHighlights: collectTopHighlights(report.sections),
          }),
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    const subject = typeof parsed.subject === 'string' && parsed.subject.trim()
      ? parsed.subject.trim()
      : fallback.subject;
    const body = typeof parsed.body === 'string' && parsed.body.trim()
      ? parsed.body.trim()
      : fallback.body;

    return {
      subject,
      body,
      source: 'openai',
    };
  } catch (error) {
    console.error('[Reports] Failed to generate AI email draft:', error.message);
    return {
      ...fallback,
      error: error.message,
    };
  }
}

async function buildMarketingReportPayload(req, customer, range) {
  const sectionBuilders = [];

  sectionBuilders.push(buildMetaLeadsSection(customer._id, range.start, range.end));

  if (customer.twilioPhoneNumber) {
    sectionBuilders.push(buildCallTrackingSection(customer._id, range.start, range.end));
  }

  if (customer.aiReceptionistSettings?.enabled) {
    sectionBuilders.push(buildAiReceptionSection(customer, range.start, range.end));
  }

  if (customer.googleBusinessProfileId) {
    sectionBuilders.push(buildGoogleBusinessSection(req, customer, range.start, range.end));
  }

  const instagramSyncStatus = await syncInstagramForReport(customer, range.start, range.end);
  sectionBuilders.push(buildInstagramSection(customer, range.start, range.end, instagramSyncStatus));

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

  if (customer.searchConsolePropertyUrl) {
    sectionBuilders.push(buildSearchConsoleSection(req, customer, range.start, range.end));
  }

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

  const recommendations = sections
    .filter((section) => section?.error)
    .map((section) => `${section.title}: ${section.error}`);

  const period = {
    start: formatDateOnly(range.start),
    end: formatDateOnly(range.end),
    label: range.label,
  };

  return {
    generatedAt: new Date().toISOString(),
    reportTitle: `CliniMedia ${range.label}`,
    exportFileName: buildReportExportFilename(customer.customerSettings?.displayName || customer.name, period),
    period,
    clinic: {
      id: customer._id,
      name: customer.customerSettings?.displayName || customer.name,
      email: customer.email,
      location: customer.location,
      website: customer.customerSettings?.website || customer.website || null,
      logoUrl: customer.customerSettings?.logoUrl || null,
    },
    overview,
    sections,
    recommendations,
    availableIntegrations: {
      metaLeads: !!sectionMap.metaLeads,
      googleAds: !!customer.googleAdsCustomerId,
      googleBusiness: !!customer.googleBusinessProfileId,
      facebook: !!(customer.facebookPageId && customer.facebookAccessToken),
      instagram: !!customer.instagramAccountId,
      callTracking: !!customer.twilioPhoneNumber,
      aiReception: !!customer.aiReceptionistSettings?.enabled,
      qrReviews: !!sectionMap.qrReviews,
      searchConsole: !!customer.searchConsolePropertyUrl,
    },
  };
}

function normalizeGoogleStarRating(starRating) {
  if (starRating === null || starRating === undefined) return null;

  if (typeof starRating === 'number') {
    return Number.isFinite(starRating) ? starRating : null;
  }

  const normalized = String(starRating).trim().toUpperCase();
  const ratingMap = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
    STAR_RATING_UNSPECIFIED: null,
  };

  if (Object.prototype.hasOwnProperty.call(ratingMap, normalized)) {
    return ratingMap[normalized];
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

async function refreshGoogleBusinessAccessToken(refreshToken) {
  if (!refreshToken) {
    throw new Error('Google Business refresh token missing.');
  }

  const response = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: process.env.GOOGLE_BUSINESS_CLIENT_ID,
    client_secret: process.env.GOOGLE_BUSINESS_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  return response.data;
}

async function getGoogleBusinessAuthContext(req, customer) {
  const adminUser = await findGoogleIntegrationAdminUser(req, 'googleBusiness');
  const tokenOwner = adminUser?.googleBusinessRefreshToken ? adminUser : customer;

  if (!tokenOwner?.googleBusinessRefreshToken) {
    throw new Error('Google Business is connected, but no refresh token is available for review retrieval.');
  }

  let accessToken = tokenOwner.googleBusinessAccessToken;
  const expiresAt = tokenOwner.googleBusinessTokenExpiry
    ? new Date(tokenOwner.googleBusinessTokenExpiry).getTime()
    : 0;
  const shouldRefresh = !accessToken || !expiresAt || expiresAt <= Date.now() + 5 * 60 * 1000;

  if (shouldRefresh) {
    const refreshed = await refreshGoogleBusinessAccessToken(tokenOwner.googleBusinessRefreshToken);
    accessToken = refreshed.access_token;

    const updateData = {
      googleBusinessAccessToken: refreshed.access_token,
      googleBusinessTokenExpiry: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000),
      googleBusinessNeedsReauth: false,
    };

    if (refreshed.refresh_token) {
      updateData.googleBusinessRefreshToken = refreshed.refresh_token;
      tokenOwner.googleBusinessRefreshToken = refreshed.refresh_token;
    }

    await User.findByIdAndUpdate(tokenOwner._id, updateData);
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_BUSINESS_CLIENT_ID,
    process.env.GOOGLE_BUSINESS_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: tokenOwner.googleBusinessRefreshToken,
  });

  return { accessToken, oauth2Client };
}

async function resolveGoogleBusinessReviewContext(req, customer) {
  const { accessToken, oauth2Client } = await getGoogleBusinessAuthContext(req, customer);

  const storedLocationName = customer.googleBusinessLocationName
    || (customer.googleBusinessProfileId ? `locations/${customer.googleBusinessProfileId}` : null);
  const storedAccountName = customer.googleBusinessAccountName
    || (customer.googleBusinessAccountId ? `accounts/${customer.googleBusinessAccountId}` : null);

  if (storedLocationName && storedAccountName) {
    return {
      accessToken,
      locationName: storedLocationName,
      locationId: storedLocationName.split('/').pop(),
      accountName: storedAccountName,
      accountId: storedAccountName.split('/').pop(),
    };
  }

  const accountManagement = google.mybusinessaccountmanagement({ version: 'v1', auth: oauth2Client });
  const businessInformation = google.mybusinessbusinessinformation({ version: 'v1', auth: oauth2Client });
  const accountsResponse = await accountManagement.accounts.list();
  const accounts = accountsResponse.data.accounts || [];

  for (const account of accounts) {
    try {
      const locationsResponse = await businessInformation.accounts.locations.list({
        parent: account.name,
        pageSize: 100,
        readMask: 'name,title',
      });
      const locations = locationsResponse.data.locations || [];
      const matchedLocation = locations.find((location) => {
        if (customer.googleBusinessLocationName && location.name === customer.googleBusinessLocationName) {
          return true;
        }
        return location.name?.split('/').pop() === customer.googleBusinessProfileId;
      });

      if (matchedLocation) {
        const resolvedContext = {
          accessToken,
          locationName: matchedLocation.name,
          locationId: matchedLocation.name.split('/').pop(),
          accountName: account.name,
          accountId: account.name.split('/').pop(),
        };

        await User.findByIdAndUpdate(customer._id, {
          googleBusinessAccountId: resolvedContext.accountId,
          googleBusinessAccountName: resolvedContext.accountName,
          googleBusinessLocationName: resolvedContext.locationName,
        });

        return resolvedContext;
      }
    } catch (error) {
      continue;
    }
  }

  throw new Error('Could not resolve the Google Business account/location needed for reviews.');
}

async function fetchGoogleBusinessReviewSummary(req, customer, start, end) {
  const context = await resolveGoogleBusinessReviewContext(req, customer);
  const reviews = [];
  let pageToken = null;
  let totalReviewCount = 0;
  let averageRatingOverall = null;

  do {
    const response = await axios.get(
      `https://mybusiness.googleapis.com/v4/${context.accountName}/locations/${context.locationId}/reviews`,
      {
        headers: {
          Authorization: `Bearer ${context.accessToken}`,
        },
        params: {
          pageSize: 50,
          orderBy: 'updateTime desc',
          ...(pageToken ? { pageToken } : {}),
        },
      }
    );

    const payload = response.data || {};
    if (typeof payload.totalReviewCount === 'number') {
      totalReviewCount = payload.totalReviewCount;
    }
    if (payload.averageRating !== undefined && payload.averageRating !== null) {
      averageRatingOverall = Number(payload.averageRating);
    }

    reviews.push(...(payload.reviews || []));
    pageToken = payload.nextPageToken || null;
  } while (pageToken);

  const filteredReviews = reviews.filter((review) => {
    const timestamp = review.createTime || review.updateTime;
    if (!timestamp) return false;
    const reviewDate = new Date(timestamp);
    return reviewDate >= start && reviewDate <= end;
  });

  const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalRating = 0;
  let ratedReviewsCount = 0;

  filteredReviews.forEach((review) => {
    const rating = normalizeGoogleStarRating(review.starRating);
    if (!rating) return;
    ratingBreakdown[rating] += 1;
    totalRating += rating;
    ratedReviewsCount += 1;
  });

  const averageRatingInRange = ratedReviewsCount
    ? Number((totalRating / ratedReviewsCount).toFixed(2))
    : null;

  return {
    totalReviewCount,
    averageRatingOverall: averageRatingOverall !== null ? Number(Number(averageRatingOverall).toFixed(2)) : null,
    reviewsInRange: filteredReviews.length,
    averageRatingInRange,
    fiveStarReviews: ratingBreakdown[5],
    fourStarReviews: ratingBreakdown[4],
    threeStarReviews: ratingBreakdown[3],
    twoStarReviews: ratingBreakdown[2],
    oneStarReviews: ratingBreakdown[1],
    recentReviews: filteredReviews
      .sort((a, b) => new Date(b.createTime || b.updateTime || 0) - new Date(a.createTime || a.updateTime || 0))
      .slice(0, 5)
      .map((review) => ({
        reviewerName: review.reviewer?.displayName || 'Google reviewer',
        starRating: normalizeGoogleStarRating(review.starRating),
        comment: review.comment || '',
        createTime: review.createTime || review.updateTime,
      })),
  };
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
    MetaLead.find(match).sort({ emailDate: -1 }).limit(100).select('leadInfo emailDate campaignName status appointmentBooked').lean(),
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
    recentLeads: recentLeads.map((lead) => {
      const dateValue = lead.emailDate ? new Date(lead.emailDate) : null;
      const dateLabel = dateValue && !Number.isNaN(dateValue.getTime())
        ? dateValue.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '—';
      const status = lead.status ? lead.status.charAt(0).toUpperCase() + lead.status.slice(1) : 'New';
      return {
        name: lead.leadInfo?.name || 'Unknown lead',
        date: dateLabel,
        campaign: lead.campaignName || '—',
        status,
        booked: lead.appointmentBooked ? 'Yes' : 'No',
      };
    }),
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
      completedCalls: answeredCalls,
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
      `${answeredCalls} completed calls`,
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
    return typeof urgency === 'string' && ['urgent', 'high', 'emergency', 'urgent dental'].includes(urgency.toLowerCase());
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

async function buildGoogleBusinessSection(req, customer, start, end) {
  const effectiveRange = getGoogleBusinessEffectiveRange(start, end);
  const startString = effectiveRange.start;
  const endString = effectiveRange.end;
  const insightRecords = await GoogleBusinessInsights.find({
    customerId: customer._id,
    'period.start': { $lte: endString },
    'period.end': { $gte: startString },
  })
    .sort({ lastUpdated: -1, date: -1 })
    .lean();

  const dayMap = new Map();
  insightRecords.forEach((record) => {
    (record.dailyData || []).forEach((item) => {
      if (!item?.date || item.date < startString || item.date > endString || dayMap.has(item.date)) {
        return;
      }

      dayMap.set(item.date, {
        date: item.date,
        searches: Number(item.searches || 0),
        views: Number(item.views || 0),
        calls: Number(item.calls || 0),
        directions: Number(item.directions || 0),
        websiteClicks: Number(item.websiteClicks || 0),
      });
    });
  });

  const dailySource = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const coverageStart = dailySource[0]?.date || null;
  const coverageEnd = dailySource[dailySource.length - 1]?.date || null;
  const latestInsights = insightRecords[0] || null;

  // Mirror live /business-insights endpoint:
  //   totalViews   = SEARCH + MAPS impressions (dailyData.searches + dailyData.views)
  //   totalSearches= SEARCH impressions only (dailyData.searches)
  // dailyData.views holds MAPS-only because of how the refresh service buckets them.
  const dailyTotals = dailySource.reduce(
    (acc, item) => {
      acc.searchOnly += Number(item.searches || 0);
      acc.mapsOnly += Number(item.views || 0);
      acc.calls += Number(item.calls || 0);
      acc.directions += Number(item.directions || 0);
      acc.websiteClicks += Number(item.websiteClicks || 0);
      return acc;
    },
    { searchOnly: 0, mapsOnly: 0, calls: 0, directions: 0, websiteClicks: 0 }
  );
  let totals = {
    totalViews: dailyTotals.searchOnly + dailyTotals.mapsOnly,
    totalSearches: dailyTotals.searchOnly,
    totalCalls: dailyTotals.calls,
    totalDirections: dailyTotals.directions,
    totalWebsiteClicks: dailyTotals.websiteClicks,
  };

  // Fallback to a live Google Business Profile fetch when the stored daily
  // window is empty for this range. Mirrors what /business-insights does on
  // the customer page so report numbers match what the clinic sees there.
  const allTotalsEmpty = totals.totalViews === 0 && totals.totalSearches === 0
    && totals.totalCalls === 0 && totals.totalDirections === 0
    && totals.totalWebsiteClicks === 0;
  if (allTotalsEmpty && customer.googleBusinessProfileId) {
    try {
      const { accessToken, oauth2Client } = await getGoogleBusinessAuthContext(req, customer);
      const locationName = customer.googleBusinessLocationName || `locations/${customer.googleBusinessProfileId}`;
      const insights = await fetchBusinessInsightsData(
        oauth2Client,
        locationName,
        startString,
        endString,
        accessToken
      );
      const groups = Array.isArray(insights?.multiDailyMetricTimeSeries) ? insights.multiDailyMetricTimeSeries : [];
      const flat = groups.flatMap((g) => g?.dailyMetricTimeSeries ?? []);
      const byMetric = {};
      flat.forEach((m) => {
        const metric = m?.dailyMetric;
        if (!metric) return;
        const values = m?.timeSeries?.datedValues || [];
        byMetric[metric] = values.reduce((s, p) => s + Number(p?.value ?? 0), 0);
      });
      const get = (k) => byMetric[k] || 0;
      totals = {
        totalViews:
          get('BUSINESS_IMPRESSIONS_DESKTOP_SEARCH') +
          get('BUSINESS_IMPRESSIONS_MOBILE_SEARCH') +
          get('BUSINESS_IMPRESSIONS_DESKTOP_MAPS') +
          get('BUSINESS_IMPRESSIONS_MOBILE_MAPS'),
        totalSearches:
          get('BUSINESS_IMPRESSIONS_DESKTOP_SEARCH') +
          get('BUSINESS_IMPRESSIONS_MOBILE_SEARCH'),
        totalCalls: get('CALL_CLICKS'),
        totalDirections: get('BUSINESS_DIRECTION_REQUESTS'),
        totalWebsiteClicks: get('WEBSITE_CLICKS'),
      };
    } catch (error) {
      console.warn('GBP fresh-fetch fallback failed during report generation:', error.response?.data || error.message);
    }
  }

  let reviewSummary = null;
  let reviewError = null;
  if (customer.googleBusinessProfileId) {
    try {
      reviewSummary = await fetchGoogleBusinessReviewSummary(
        req,
        customer,
        new Date(`${startString}T00:00:00.000Z`),
        new Date(`${endString}T23:59:59.999Z`)
      );
    } catch (error) {
      reviewError = error.message;
    }
  }

  if (!dailySource.length && !reviewSummary) {
    return null;
  }

  const summary = {
    ...totals,
    ...(reviewSummary ? {
      newReviewsInPeriod: reviewSummary.reviewsInRange,
      ...(reviewSummary.averageRatingInRange !== null && reviewSummary.averageRatingInRange !== undefined
        ? { averageRatingInRange: reviewSummary.averageRatingInRange }
        : {}),
    } : {}),
  };

  const highlights = [
    `${totals.totalSearches} Google Business searches`,
    `${totals.totalViews} total profile impressions`,
    `${totals.totalCalls} calls from profile`,
    `${totals.totalWebsiteClicks} website clicks`,
  ];

  if (reviewSummary) {
    highlights.push(`${reviewSummary.reviewsInRange} new Google reviews in this period`);
    if (reviewSummary.averageRatingInRange !== null) {
      highlights.push(`${reviewSummary.averageRatingInRange} average rating in this period`);
    }
    if (effectiveRange.buffered) {
      highlights.push(`Google data currently reflects ${effectiveRange.start} to ${effectiveRange.end}`);
    }
  } else if (reviewError) {
    highlights.push(`Review data unavailable: ${reviewError}`);
  }

  return {
    id: 'googleBusiness',
    title: 'Google Business Profile',
    summary,
    highlights,
    recentReviews: reviewSummary?.recentReviews || [],
    sourceWindow: {
      periodStart: coverageStart || effectiveRange.start,
      periodEnd: coverageEnd || effectiveRange.end,
      requestedStart: effectiveRange.requestedStart,
      requestedEnd: effectiveRange.requestedEnd,
      lastUpdated: latestInsights?.lastUpdated || latestInsights?.updatedAt || null,
    },
  };
}

async function buildInstagramSection(customer, start, end, syncStatus) {
  const customerId = customer._id;
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

  const syncFailed = syncStatus && syncStatus.synced === false && customer.instagramAccountId;
  if (!userInsights.length && !mediaInsights.length && !syncFailed) {
    return null;
  }
  if (!userInsights.length && !mediaInsights.length && syncFailed) {
    return {
      id: 'instagram',
      title: 'Instagram',
      summary: {},
      highlights: [],
      topPosts: [],
      error: syncStatus.reason || 'Instagram sync did not return any data for this period.',
    };
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

async function syncInstagramForReport(customer, start, end) {
  if (!customer?.instagramAccountId) {
    return { synced: false, reason: 'No Instagram account linked.' };
  }

  // Wipe prior live-sync total_value docs for this customer in the requested
  // window so we never double-count when timeframes change between syncs.
  // Keeps follower snapshots and any non-meta_graph rows untouched.
  try {
    await InstaUserInsight.deleteMany({
      customer_id: String(customer._id),
      source: 'meta_graph',
      metric: { $in: ['reach', 'impressions', 'views', 'profile_views', 'website_clicks'] },
      end_time: { $gte: start, $lte: end },
    });
  } catch (cleanupError) {
    console.warn('Instagram pre-sync cleanup failed:', cleanupError.message);
  }

  try {
    return await syncInstagramInsightsForUser(customer, { from: start, to: end });
  } catch (error) {
    const reason = error.response?.data?.error?.message || error.message;
    console.warn('Instagram direct sync failed during report generation:', error.response?.data || error.message);
    return { synced: false, reason };
  }
}

async function fetchFacebookMetric(user, metric, start, end) {
  const response = await axios.get(
    `${GRAPH_API_BASE}/${user.facebookPageId}/insights`,
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

  // Mirrors live /api/facebook/insights/:customerId metric set.
  // page_impressions / page_impressions_unique were both fully deprecated in
  // 2025 — replaced by page_media_view (total impressions) and
  // page_total_media_view_unique (unique reach). They produce DIFFERENT
  // numbers, as expected for reach vs impressions.
  const metrics = [
    { key: 'impressions', metric: 'page_media_view' },
    { key: 'reach', metric: 'page_total_media_view_unique' },
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

  // Conversion rates the customer dashboard renders.
  summary.scanToGeneratePercent = summary.scans > 0
    ? Number(((summary.reviewsGenerated / summary.scans) * 100).toFixed(1)) : 0;
  summary.generateToCopyPercent = summary.reviewsGenerated > 0
    ? Number(((summary.copyClicks / summary.reviewsGenerated) * 100).toFixed(1)) : 0;
  summary.copyToGooglePercent = summary.copyClicks > 0
    ? Number(((summary.googleClicks / summary.copyClicks) * 100).toFixed(1)) : 0;

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

async function buildSearchConsoleSection(req, customer, start, end) {
  if (!customer.searchConsolePropertyUrl) {
    return null;
  }

  let webmasters;
  try {
    const { oauth2Client } = await getAuthorizedSearchConsoleClient(req);
    webmasters = google.webmasters({ version: 'v3', auth: oauth2Client });
  } catch (error) {
    return {
      id: 'searchConsole',
      title: 'Website & SEO',
      summary: {},
      highlights: [],
      error: `Search Console auth unavailable: ${error.message}`,
    };
  }

  let performance;
  try {
    performance = await buildSearchConsolePerformance(
      webmasters,
      customer.searchConsolePropertyUrl,
      formatDateOnly(start),
      formatDateOnly(end)
    );
  } catch (error) {
    return {
      id: 'searchConsole',
      title: 'Website & SEO',
      summary: {},
      highlights: [],
      error: `Search Console query failed: ${error.message}`,
    };
  }

  const { totalClicks, totalImpressions, avgCtr, avgPosition } = performance.summary;
  // Mirror the customer-side endpoint: avgCtr as a 0-1 fraction, position as
  // a raw float. The PDF formats them visually (CTR -> X.XX%, position .toFixed(2)).
  if (!totalClicks && !totalImpressions) {
    return {
      id: 'searchConsole',
      title: 'Website & SEO',
      summary: { totalClicks: 0, totalImpressions: 0, avgCtr: 0, avgPosition: 0 },
      highlights: ['No Google search activity recorded for this period.'],
      property: customer.searchConsolePropertyUrl,
    };
  }

  const ctrPercentDisplay = (avgCtr * 100).toFixed(2);
  const positionDisplay = avgPosition.toFixed(2);

  return {
    id: 'searchConsole',
    title: 'Website & SEO',
    summary: {
      totalClicks,
      totalImpressions,
      avgCtr,
      avgPosition,
    },
    highlights: [
      `${totalClicks.toLocaleString()} organic clicks from Google`,
      `${totalImpressions.toLocaleString()} search impressions`,
      `${ctrPercentDisplay}% average click-through rate`,
      `${positionDisplay} average position in results`,
    ],
    topQueries: performance.topQueries.slice(0, 5).map((row) => ({
      query: row.query,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    })),
    topPages: performance.topPages.slice(0, 5).map((row) => ({
      page: row.page,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
    })),
    property: customer.searchConsolePropertyUrl,
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

    const range = getRequestedRange(customer, req.query);
    const payload = await buildMarketingReportPayload(req, customer, range);
    res.json(payload);
  } catch (error) {
    console.error('Error generating marketing report:', error);
    res.status(500).json({ error: 'Failed to generate marketing report', details: error.message });
  }
});

router.get('/marketing/email-draft', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { customerId } = req.query;
    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const customer = await User.findOne({ _id: customerId, role: 'customer' }).lean();
    if (!customer) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    const range = getRequestedRange(customer, req.query);
    const report = await buildMarketingReportPayload(req, customer, range);
    const draft = await generateMarketingEmailDraft(report);

    res.json({
      generatedAt: new Date().toISOString(),
      subject: draft.subject,
      body: draft.body,
      source: draft.source,
      error: draft.error || null,
      exportFileName: report.exportFileName,
      clinic: report.clinic,
      period: report.period,
    });
  } catch (error) {
    console.error('Error generating marketing email draft:', error);
    res.status(500).json({ error: 'Failed to generate marketing email draft', details: error.message });
  }
});

module.exports = router;
