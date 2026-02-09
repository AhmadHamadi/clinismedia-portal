const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const QRCode = require('qrcode');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');
const ReviewCampaign = require('../models/ReviewCampaign');
const ReviewSession = require('../models/ReviewSession');
const ReviewGeneration = require('../models/ReviewGeneration');
const ConcernSubmission = require('../models/ConcernSubmission');
const ReviewEvent = require('../models/ReviewEvent');
const { generateReview } = require('../services/reviewGenerationService');
const EmailService = require('../services/emailService');

const MAX_GENERATIONS = 6;

// Helper: fire-and-forget event tracking
function trackEvent(campaignId, sessionId, eventType, metadata) {
  ReviewEvent.create({ campaignId, sessionId, eventType, metadata }).catch(err => {
    console.error('[ReviewEvent] Failed to track:', err.message);
  });
}

// ============================================================
// Rate limiters for public endpoints
// ============================================================
const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many review generation requests. Please try again in a minute.' }
});

const concernLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many submissions. Please try again in a minute.' }
});

const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests. Please try again in a minute.' }
});

// ============================================================
// ADMIN ROUTES (authenticated + admin role)
// ============================================================

// GET /campaigns - List all campaigns
router.get('/campaigns', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const campaigns = await ReviewCampaign.find()
      .populate('customerId', 'name email clinicName')
      .sort({ createdAt: -1 });

    const campaignsWithStats = await Promise.all(campaigns.map(async (campaign) => {
      const sessionCount = await ReviewSession.countDocuments({ campaignId: campaign._id });
      const copiedCount = await ReviewSession.countDocuments({ campaignId: campaign._id, status: 'copied' });
      const concernCount = await ConcernSubmission.countDocuments({ campaignId: campaign._id, status: 'new' });
      return {
        ...campaign.toObject(),
        stats: { sessionCount, copiedCount, concernCount }
      };
    }));

    res.json(campaignsWithStats);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// POST /campaigns - Create campaign
router.post('/campaigns', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const {
      customerId, slug, clinicName, googleReviewUrl,
      isActive, experienceHighlights, adminEmail, logoUrl
    } = req.body;

    if (!clinicName || !googleReviewUrl) {
      return res.status(400).json({ error: 'clinicName and googleReviewUrl are required' });
    }

    const campaign = new ReviewCampaign({
      customerId, slug, clinicName, googleReviewUrl,
      isActive, experienceHighlights, adminEmail, logoUrl
    });

    await campaign.save();
    res.status(201).json(campaign);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'A campaign with this slug already exists' });
    }
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// GET /campaigns/:id - Get single campaign
router.get('/campaigns/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const campaign = await ReviewCampaign.findById(req.params.id)
      .populate('customerId', 'name email clinicName');
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json(campaign);
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// PUT /campaigns/:id - Update campaign
router.put('/campaigns/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const {
      customerId, slug, clinicName, googleReviewUrl,
      isActive, experienceHighlights, adminEmail, logoUrl
    } = req.body;

    const campaign = await ReviewCampaign.findByIdAndUpdate(
      req.params.id,
      {
        customerId, slug, clinicName, googleReviewUrl,
        isActive, experienceHighlights, adminEmail, logoUrl
      },
      { new: true, runValidators: true }
    );

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json(campaign);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'A campaign with this slug already exists' });
    }
    console.error('Error updating campaign:', error);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// DELETE /campaigns/:id - Delete campaign and related data
router.delete('/campaigns/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const campaign = await ReviewCampaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    await ReviewEvent.deleteMany({ campaignId: campaign._id });
    await ReviewGeneration.deleteMany({ campaignId: campaign._id });
    await ConcernSubmission.deleteMany({ campaignId: campaign._id });
    await ReviewSession.deleteMany({ campaignId: campaign._id });
    await ReviewCampaign.findByIdAndDelete(campaign._id);

    res.json({ message: 'Campaign and all related data deleted' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

// GET /campaigns/:id/stats - Campaign analytics (full funnel)
router.get('/campaigns/:id/stats', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const campaign = await ReviewCampaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const cid = campaign._id;

    // Event-based counts
    const [
      scans,
      pathGreat,
      pathConcern,
      reviewsGenerated,
      copyClicks,
      googleClicks,
      concernSubmissions
    ] = await Promise.all([
      ReviewEvent.countDocuments({ campaignId: cid, eventType: 'session_started' }),
      ReviewEvent.countDocuments({ campaignId: cid, eventType: 'path_selected', 'metadata.path': 'great' }),
      ReviewEvent.countDocuments({ campaignId: cid, eventType: 'path_selected', 'metadata.path': 'concern' }),
      ReviewEvent.countDocuments({ campaignId: cid, eventType: 'review_generated' }),
      ReviewEvent.countDocuments({ campaignId: cid, eventType: 'review_copied' }),
      ReviewEvent.countDocuments({ campaignId: cid, eventType: 'google_clicked' }),
      ReviewEvent.countDocuments({ campaignId: cid, eventType: 'concern_submitted' }),
    ]);

    // Fallback: if no events yet, use session-based counts
    const totalSessions = scans || await ReviewSession.countDocuments({ campaignId: cid });
    const totalGenerated = reviewsGenerated || await ReviewSession.countDocuments({ campaignId: cid, status: { $in: ['review_generated', 'copied'] } });
    const totalCopied = copyClicks || await ReviewSession.countDocuments({ campaignId: cid, status: 'copied' });
    const totalConcerns = concernSubmissions || await ConcernSubmission.countDocuments({ campaignId: cid });
    const concernsNew = await ConcernSubmission.countDocuments({ campaignId: cid, status: 'new' });

    // Conversion rates
    const scanToGenerate = totalSessions > 0 ? Math.round((totalGenerated / totalSessions) * 100) : 0;
    const generateToCopy = totalGenerated > 0 ? Math.round((totalCopied / totalGenerated) * 100) : 0;
    const copyToGoogle = totalCopied > 0 ? Math.round((googleClicks / totalCopied) * 100) : 0;

    // Recent sessions
    const recentSessions = await ReviewSession.find({ campaignId: cid })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({
      // Funnel metrics
      scans: totalSessions,
      pathGreat,
      pathConcern,
      reviewsGenerated: totalGenerated,
      copyClicks: totalCopied,
      googleClicks,
      concernSubmissions: totalConcerns,
      concernsNew,
      // Conversion rates
      scanToGenerate,
      generateToCopy,
      copyToGoogle,
      // Legacy fields for backwards compat
      totalSessions,
      reviewsCopied: totalCopied,
      conversionRate: scanToGenerate,
      concernsTotal: totalConcerns,
      recentSessions,
    });
  } catch (error) {
    console.error('Error fetching campaign stats:', error);
    res.status(500).json({ error: 'Failed to fetch campaign stats' });
  }
});

// GET /campaigns/:id/concerns - List concerns for a campaign
router.get('/campaigns/:id/concerns', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const concerns = await ConcernSubmission.find({ campaignId: req.params.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(concerns);
  } catch (error) {
    console.error('Error fetching concerns:', error);
    res.status(500).json({ error: 'Failed to fetch concerns' });
  }
});

// PUT /campaigns/:campaignId/concerns/:concernId - Update concern status
router.put('/campaigns/:campaignId/concerns/:concernId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['new', 'reviewed', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const concern = await ConcernSubmission.findOneAndUpdate(
      { _id: req.params.concernId, campaignId: req.params.campaignId },
      {
        status,
        reviewedBy: req.user._id,
        reviewedAt: new Date()
      },
      { new: true }
    );

    if (!concern) {
      return res.status(404).json({ error: 'Concern not found' });
    }
    res.json(concern);
  } catch (error) {
    console.error('Error updating concern:', error);
    res.status(500).json({ error: 'Failed to update concern' });
  }
});

// GET /campaigns/:id/qr-code - Generate QR code
router.get('/campaigns/:id/qr-code', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const campaign = await ReviewCampaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const format = req.query.format || 'png';
    const size = parseInt(req.query.size) || 300;
    const url = `https://www.clinimediaportal.ca/r/${campaign.slug}`;

    if (format === 'svg') {
      const svgString = await QRCode.toString(url, { type: 'svg', width: size });
      res.json({ qrCodeData: svgString, format: 'svg', url });
    } else {
      const dataUrl = await QRCode.toDataURL(url, { width: size, margin: 2 });
      res.json({ qrCodeData: dataUrl, format: 'png', url });
    }
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// ============================================================
// CUSTOMER ROUTES (authenticated customer, filtered to their campaigns)
// ============================================================

// GET /my-campaigns - List campaigns belonging to the logged-in customer
router.get('/my-campaigns', authenticateToken, authorizeRole(['customer']), async (req, res) => {
  try {
    const campaigns = await ReviewCampaign.find({ customerId: req.user._id })
      .sort({ createdAt: -1 });

    const campaignsWithStats = await Promise.all(campaigns.map(async (campaign) => {
      const sessionCount = await ReviewSession.countDocuments({ campaignId: campaign._id });
      const copiedCount = await ReviewSession.countDocuments({ campaignId: campaign._id, status: 'copied' });
      const concernCount = await ConcernSubmission.countDocuments({ campaignId: campaign._id, status: 'new' });
      return {
        ...campaign.toObject(),
        stats: { sessionCount, copiedCount, concernCount }
      };
    }));

    res.json(campaignsWithStats);
  } catch (error) {
    console.error('Error fetching customer campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// GET /my-campaigns/:id/stats - Campaign analytics for customer's own campaign
router.get('/my-campaigns/:id/stats', authenticateToken, authorizeRole(['customer']), async (req, res) => {
  try {
    const campaign = await ReviewCampaign.findOne({
      _id: req.params.id,
      customerId: req.user._id
    });
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const cid = campaign._id;

    const [
      scans,
      pathGreat,
      pathConcern,
      reviewsGenerated,
      copyClicks,
      googleClicks,
      concernSubmissions
    ] = await Promise.all([
      ReviewEvent.countDocuments({ campaignId: cid, eventType: 'session_started' }),
      ReviewEvent.countDocuments({ campaignId: cid, eventType: 'path_selected', 'metadata.path': 'great' }),
      ReviewEvent.countDocuments({ campaignId: cid, eventType: 'path_selected', 'metadata.path': 'concern' }),
      ReviewEvent.countDocuments({ campaignId: cid, eventType: 'review_generated' }),
      ReviewEvent.countDocuments({ campaignId: cid, eventType: 'review_copied' }),
      ReviewEvent.countDocuments({ campaignId: cid, eventType: 'google_clicked' }),
      ReviewEvent.countDocuments({ campaignId: cid, eventType: 'concern_submitted' }),
    ]);

    const totalSessions = scans || await ReviewSession.countDocuments({ campaignId: cid });
    const totalGenerated = reviewsGenerated || await ReviewSession.countDocuments({ campaignId: cid, status: { $in: ['review_generated', 'copied'] } });
    const totalCopied = copyClicks || await ReviewSession.countDocuments({ campaignId: cid, status: 'copied' });
    const totalConcerns = concernSubmissions || await ConcernSubmission.countDocuments({ campaignId: cid });
    const concernsNew = await ConcernSubmission.countDocuments({ campaignId: cid, status: 'new' });

    const scanToGenerate = totalSessions > 0 ? Math.round((totalGenerated / totalSessions) * 100) : 0;
    const generateToCopy = totalGenerated > 0 ? Math.round((totalCopied / totalGenerated) * 100) : 0;
    const copyToGoogle = totalCopied > 0 ? Math.round((googleClicks / totalCopied) * 100) : 0;

    const recentSessions = await ReviewSession.find({ campaignId: cid })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({
      scans: totalSessions,
      pathGreat,
      pathConcern,
      reviewsGenerated: totalGenerated,
      copyClicks: totalCopied,
      googleClicks,
      concernSubmissions: totalConcerns,
      concernsNew,
      scanToGenerate,
      generateToCopy,
      copyToGoogle,
      recentSessions,
    });
  } catch (error) {
    console.error('Error fetching customer campaign stats:', error);
    res.status(500).json({ error: 'Failed to fetch campaign stats' });
  }
});

// GET /my-campaigns/:id/concerns - List concerns for customer's campaign
router.get('/my-campaigns/:id/concerns', authenticateToken, authorizeRole(['customer']), async (req, res) => {
  try {
    const campaign = await ReviewCampaign.findOne({
      _id: req.params.id,
      customerId: req.user._id
    });
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const concerns = await ConcernSubmission.find({ campaignId: campaign._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(concerns);
  } catch (error) {
    console.error('Error fetching customer concerns:', error);
    res.status(500).json({ error: 'Failed to fetch concerns' });
  }
});

// ============================================================
// PUBLIC ROUTES (no auth required)
// ============================================================

// GET /public/:slug - Get campaign public info
router.get('/public/:slug', publicLimiter, async (req, res) => {
  try {
    const campaign = await ReviewCampaign.findOne({
      slug: req.params.slug,
      isActive: true
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const chipLabels = (campaign.experienceHighlights || []).map(h => ({
      label: h.label,
      category: h.category
    }));

    res.json({
      clinicName: campaign.clinicName,
      experienceHighlights: chipLabels,
      isActive: campaign.isActive,
      logoUrl: campaign.logoUrl || null
    });
  } catch (error) {
    console.error('Error fetching public campaign:', error);
    res.status(500).json({ error: 'Failed to load campaign' });
  }
});

// POST /public/:slug/session - Start a review session
router.post('/public/:slug/session', publicLimiter, async (req, res) => {
  try {
    const campaign = await ReviewCampaign.findOne({
      slug: req.params.slug,
      isActive: true
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const { patientName, selectedHighlights, freeText, staffName, reviewLength, pathSelected } = req.body;

    const session = new ReviewSession({
      campaignId: campaign._id,
      patientName,
      selectedHighlights,
      freeText: freeText ? String(freeText).slice(0, 120) : undefined,
      staffName: staffName ? String(staffName).slice(0, 60) : undefined,
      reviewLength: reviewLength === 'short' ? 'short' : 'medium',
      pathSelected,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    await session.save();

    // Track events
    trackEvent(campaign._id, session._id, 'session_started');
    if (pathSelected) {
      trackEvent(campaign._id, session._id, 'path_selected', { path: pathSelected });
    }

    res.status(201).json({
      sessionToken: session.sessionToken,
      sessionId: session._id
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// POST /public/:slug/generate - Generate a review
router.post('/public/:slug/generate', generateLimiter, async (req, res) => {
  try {
    const { sessionToken } = req.body;
    if (!sessionToken) {
      return res.status(400).json({ error: 'Session token is required' });
    }

    const campaign = await ReviewCampaign.findOne({
      slug: req.params.slug,
      isActive: true
    });
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const session = await ReviewSession.findOne({
      sessionToken,
      campaignId: campaign._id
    });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.generationCount >= MAX_GENERATIONS) {
      return res.status(429).json({
        error: 'Maximum review generations reached. Try adjusting your selections.',
        max: MAX_GENERATIONS
      });
    }

    // Resolve selected highlight labels to full chip objects with sentences
    const selectedChips = (session.selectedHighlights || [])
      .map(label => (campaign.experienceHighlights || []).find(h => h.label === label))
      .filter(Boolean);

    const result = await generateReview({
      clinicName: campaign.clinicName,
      selectedChips,
      freeText: session.freeText,
      staffName: session.staffName,
      reviewLength: session.reviewLength
    });

    const generation = new ReviewGeneration({
      sessionId: session._id,
      campaignId: campaign._id,
      reviewText: result.reviewText,
      sentenceBankDraft: result.sentenceBankDraft,
      aiPolished: result.aiPolished,
      wordCount: result.wordCount,
      sentenceCount: result.sentenceCount,
      generationNumber: session.generationCount + 1,
      wasRegenerated: session.generationCount > 0
    });
    await generation.save();

    session.generationCount += 1;
    session.status = 'review_generated';
    await session.save();

    trackEvent(campaign._id, session._id, 'review_generated', { generationNumber: generation.generationNumber });

    res.json({
      reviewText: result.reviewText,
      aiPolished: result.aiPolished,
      generationNumber: generation.generationNumber,
      remainingGenerations: MAX_GENERATIONS - session.generationCount
    });
  } catch (error) {
    console.error('Error generating review:', error);
    res.status(500).json({ error: 'Failed to generate review' });
  }
});

// POST /public/:slug/regenerate - Regenerate a review
router.post('/public/:slug/regenerate', generateLimiter, async (req, res) => {
  try {
    const { sessionToken } = req.body;
    if (!sessionToken) {
      return res.status(400).json({ error: 'Session token is required' });
    }

    const campaign = await ReviewCampaign.findOne({
      slug: req.params.slug,
      isActive: true
    });
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const session = await ReviewSession.findOne({
      sessionToken,
      campaignId: campaign._id
    });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.generationCount >= MAX_GENERATIONS) {
      return res.status(429).json({
        error: 'Maximum review generations reached. Try adjusting your selections.',
        max: MAX_GENERATIONS
      });
    }

    const selectedChips = (session.selectedHighlights || [])
      .map(label => (campaign.experienceHighlights || []).find(h => h.label === label))
      .filter(Boolean);

    const result = await generateReview({
      clinicName: campaign.clinicName,
      selectedChips,
      freeText: session.freeText,
      staffName: session.staffName,
      reviewLength: session.reviewLength
    });

    const generation = new ReviewGeneration({
      sessionId: session._id,
      campaignId: campaign._id,
      reviewText: result.reviewText,
      sentenceBankDraft: result.sentenceBankDraft,
      aiPolished: result.aiPolished,
      wordCount: result.wordCount,
      sentenceCount: result.sentenceCount,
      generationNumber: session.generationCount + 1,
      wasRegenerated: true
    });
    await generation.save();

    session.generationCount += 1;
    session.status = 'review_generated';
    await session.save();

    trackEvent(campaign._id, session._id, 'review_generated', { generationNumber: generation.generationNumber, regenerated: true });

    res.json({
      reviewText: result.reviewText,
      aiPolished: result.aiPolished,
      generationNumber: generation.generationNumber,
      remainingGenerations: MAX_GENERATIONS - session.generationCount
    });
  } catch (error) {
    console.error('Error regenerating review:', error);
    res.status(500).json({ error: 'Failed to regenerate review' });
  }
});

// POST /public/:slug/copied - Mark review as copied
router.post('/public/:slug/copied', publicLimiter, async (req, res) => {
  try {
    const { sessionToken } = req.body;
    if (!sessionToken) {
      return res.status(400).json({ error: 'Session token is required' });
    }

    const campaign = await ReviewCampaign.findOne({ slug: req.params.slug });
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const session = await ReviewSession.findOneAndUpdate(
      { sessionToken, campaignId: campaign._id },
      { status: 'copied' },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    trackEvent(campaign._id, session._id, 'review_copied');

    res.json({
      message: 'Review marked as copied',
      googleReviewUrl: campaign.googleReviewUrl
    });
  } catch (error) {
    console.error('Error marking review as copied:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// POST /public/:slug/google-clicked - Track Google redirect click
router.post('/public/:slug/google-clicked', publicLimiter, async (req, res) => {
  try {
    const { sessionToken } = req.body;
    if (!sessionToken) {
      return res.status(400).json({ error: 'Session token is required' });
    }

    const campaign = await ReviewCampaign.findOne({ slug: req.params.slug });
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const session = await ReviewSession.findOneAndUpdate(
      { sessionToken, campaignId: campaign._id },
      { googleClicked: true },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    trackEvent(campaign._id, session._id, 'google_clicked');

    res.json({ message: 'Google click tracked' });
  } catch (error) {
    console.error('Error tracking google click:', error);
    res.status(500).json({ error: 'Failed to track click' });
  }
});

// POST /public/:slug/concern - Submit a concern
router.post('/public/:slug/concern', concernLimiter, async (req, res) => {
  try {
    const campaign = await ReviewCampaign.findOne({
      slug: req.params.slug,
      isActive: true
    });
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const { sessionToken, patientName, patientContact, concernText } = req.body;

    if (!concernText || concernText.trim().length < 10) {
      return res.status(400).json({ error: 'Please provide more detail about your concern (at least 10 characters)' });
    }

    let session = null;
    if (sessionToken) {
      session = await ReviewSession.findOne({ sessionToken, campaignId: campaign._id });
      if (session) {
        session.status = 'concern_submitted';
        await session.save();
      }
    }

    const concern = new ConcernSubmission({
      campaignId: campaign._id,
      sessionId: session?._id,
      patientName,
      patientContact,
      concernText: concernText.trim()
    });
    await concern.save();

    trackEvent(campaign._id, session?._id, 'concern_submitted');

    // Send email notification to admin
    const adminEmail = campaign.adminEmail || 'notifications@clinimedia.ca';
    try {
      await EmailService.sendConcernNotification(
        campaign.clinicName,
        patientName,
        patientContact,
        concernText.trim(),
        adminEmail
      );
    } catch (emailError) {
      console.error('Failed to send concern email (concern still saved):', emailError);
    }

    res.status(201).json({
      message: 'Your concern has been submitted. The clinic will follow up with you.',
      googleReviewUrl: campaign.googleReviewUrl
    });
  } catch (error) {
    console.error('Error submitting concern:', error);
    res.status(500).json({ error: 'Failed to submit concern' });
  }
});

module.exports = router;
