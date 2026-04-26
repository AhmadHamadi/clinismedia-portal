const MetaLead = require('../models/MetaLead');
const MetaLeadFolderMapping = require('../models/MetaLeadFolderMapping');
const MetaLeadSubjectMapping = require('../models/MetaLeadSubjectMapping');
const User = require('../models/User');
const metaLeadsEmailService = require('../services/metaLeadsEmailService');
const axios = require('axios');

const META_LEADS_BOOKED_WEBHOOK_URL =
  process.env.META_LEADS_BOOKED_WEBHOOK_URL ||
  'https://hook.us2.make.com/lxo7t9dp07ijv5p6gbk6m2pmed783ruo';

/** Normalize subject the same way as metaLeadsEmailService so stored mappings match incoming emails (bullets, Re:, whitespace) */
function normalizeSubjectForMapping(subject) {
  if (!subject || typeof subject !== 'string') return '';
  let s = subject
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  s = s.replace(/^[\s\u2022\u00B7\u2023\u2043\u2219\-\*]+\s*/i, '').trim();
  s = s.replace(/^(re|fwd|fw):\s*/gi, '').trim();
  return s;
}

function normalizeFolderForMapping(folderName) {
  return metaLeadsEmailService.normalizeFolderName(folderName || '');
}

function normalizePhoneForMeta(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) {
    return `1${digits}`;
  }
  return digits || null;
}

function getLeadField(lead, names = []) {
  const fields = lead?.leadInfo?.fields || {};
  for (const name of names) {
    if (fields[name] !== undefined && fields[name] !== null && String(fields[name]).trim()) {
      return String(fields[name]).trim();
    }
  }

  const normalizedNames = names.map((name) => String(name).toLowerCase().replace(/[\s_-]+/g, ''));
  for (const [key, value] of Object.entries(fields)) {
    const normalizedKey = String(key).toLowerCase().replace(/[\s_-]+/g, '');
    const isMatchingField = normalizedNames.some((normalizedName) =>
      normalizedKey === normalizedName || normalizedKey.startsWith(normalizedName)
    );
    if (isMatchingField && value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return null;
}

function resolveMetaLeadId(lead) {
  const direct = lead?.metaLeadId ? String(lead.metaLeadId).trim() : null;
  const fromFields = getLeadField(lead, [
    'meta_lead_id',
    'metaLeadId',
    'meta lead id',
    'facebook_lead_id',
    'facebook lead id',
    'leadgen_id',
    'leadgen id',
    'lead_id',
    'lead id',
  ]);

  const candidate = direct || fromFields;
  return candidate ? String(candidate).replace(/[^A-Za-z0-9_-]/g, '').trim() || null : null;
}

function getClinicName(customer) {
  return customer?.customerSettings?.displayName || customer?.name || 'Clinic';
}

async function sendBookedAppointmentWebhook(lead, customer) {
  const metaLeadId = resolveMetaLeadId(lead);
  if (!metaLeadId) {
    console.warn(`[Meta Leads] Booked appointment webhook skipped for lead ${lead?._id}: missing original Meta lead ID.`);
    return;
  }

  const payload = {
    meta_lead_id: metaLeadId,
    email: lead?.leadInfo?.email || null,
    phone: normalizePhoneForMeta(lead?.leadInfo?.phone),
    clinic_name: getClinicName(customer),
    campaign_name: lead?.campaignName || getLeadField(lead, ['campaign name', 'campaign_name', 'campaignName']) || null,
    status: 'Appointment Booked',
    booked_at: (lead?.appointmentBookedAt || new Date()).toISOString(),
  };

  try {
    await axios.post(META_LEADS_BOOKED_WEBHOOK_URL, payload, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });
    console.log(`[Meta Leads] Booked appointment webhook sent for Meta lead ${metaLeadId}.`);
  } catch (error) {
    console.error('[Meta Leads] Failed to send booked appointment webhook:', error.response?.data || error.message);
  }
}

class MetaLeadsController {
  /**
   * Get all leads for a customer (customer view)
   */
  static async getCustomerLeads(req, res) {
    try {
      const customerId = req.effectiveCustomerId;
      const { status, month, year, startDate, endDate, limit = 50, page = 1 } = req.query;

      // Build query
      const query = { customerId };

      // Filter by status
      if (status && ['new', 'contacted', 'not_contacted'].includes(status)) {
        query.status = status;
      }

      // Filter by date range (preferred over month/year)
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        // Set start date to start of day (00:00:00)
        start.setHours(0, 0, 0, 0);
        // Set end date to end of day (23:59:59.999)
        end.setHours(23, 59, 59, 999);
        query.emailDate = { $gte: start, $lte: end };
      } else if (month && year) {
        // Filter by month/year (fallback)
        const start = new Date(year, month - 1, 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(year, month, 0, 23, 59, 59, 999);
        query.emailDate = { $gte: start, $lte: end };
      }

      // Get leads
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const leads = await MetaLead.find(query)
        .sort({ emailDate: -1 })
        .limit(parseInt(limit))
        .skip(skip);

      const total = await MetaLead.countDocuments(query);

      res.json({
        leads,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error getting customer leads:', error);
      res.status(500).json({ message: 'Failed to get leads', error: error.message });
    }
  }

  /**
   * Get lead statistics for customer dashboard
   */
  static async getCustomerLeadStats(req, res) {
    try {
      const customerId = req.effectiveCustomerId;
      const { month, year, startDate, endDate } = req.query;

      // Build date filter
      let dateFilter = {};
      if (startDate && endDate) {
        // Filter by date range (preferred over month/year)
        const start = new Date(startDate);
        const end = new Date(endDate);
        // Set start date to start of day (00:00:00)
        start.setHours(0, 0, 0, 0);
        // Set end date to end of day (23:59:59.999)
        end.setHours(23, 59, 59, 999);
        dateFilter.emailDate = { $gte: start, $lte: end };
      } else if (month && year) {
        // Filter by month/year (fallback)
        const start = new Date(year, month - 1, 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(year, month, 0, 23, 59, 59, 999);
        dateFilter.emailDate = { $gte: start, $lte: end };
      }

      // Get statistics
      const totalLeads = await MetaLead.countDocuments({ customerId, ...dateFilter });
      const contactedLeads = await MetaLead.countDocuments({
        customerId,
        status: 'contacted',
        ...dateFilter
      });
      const bookedAppointments = await MetaLead.countDocuments({
        customerId,
        appointmentBooked: true,
        ...dateFilter
      });

      // Get monthly breakdown
      const mongoose = require('mongoose');
      const matchStage = { customerId: new mongoose.Types.ObjectId(customerId) };
      
      // Add date filter to match stage if present
      if (Object.keys(dateFilter).length > 0) {
        Object.assign(matchStage, dateFilter);
      }
      
      const monthlyStats = await MetaLead.aggregate([
        {
          $match: matchStage
        },
        {
          $group: {
            _id: {
              year: { $year: '$emailDate' },
              month: { $month: '$emailDate' }
            },
            total: { $sum: 1 },
            contacted: {
              $sum: { $cond: [{ $eq: ['$status', 'contacted'] }, 1, 0] }
            },
            booked: {
              $sum: { $cond: [{ $eq: ['$appointmentBooked', true] }, 1, 0] }
            }
          }
        },
        {
          $sort: { '_id.year': -1, '_id.month': -1 }
        },
        {
          $limit: 12 // Last 12 months
        }
      ]);

      res.json({
        totalLeads,
        contactedLeads,
        bookedAppointments,
        monthlyStats: monthlyStats.map(stat => ({
          year: stat._id.year,
          month: stat._id.month,
          total: stat.total,
          contacted: stat.contacted,
          booked: stat.booked
        }))
      });
    } catch (error) {
      console.error('Error getting lead stats:', error);
      res.status(500).json({ message: 'Failed to get lead statistics', error: error.message });
    }
  }

  /**
   * Update lead status (contacted/not contacted)
   */
  static async updateLeadStatus(req, res) {
    try {
      const { leadId } = req.params;
      const { status, reason } = req.body;
      const customerId = req.effectiveCustomerId;

      if (!['contacted', 'not_contacted'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status. Must be "contacted" or "not_contacted"' });
      }

      // Require reason if status is 'not_contacted'
      if (status === 'not_contacted' && !reason) {
        return res.status(400).json({ message: 'Reason is required when marking lead as "not contacted"' });
      }

      const lead = await MetaLead.findOne({ _id: leadId, customerId });

      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      lead.status = status;
      
      // Set timestamps
      if (status === 'contacted') {
        lead.contactedAt = new Date();
        lead.notContactedAt = null;
        lead.notContactedReason = null;
      } else if (status === 'not_contacted') {
        lead.notContactedAt = new Date();
        lead.contactedAt = null;
        lead.notContactedReason = reason || null;
        // Clear appointment booking info if not contacted
        lead.appointmentBooked = null;
        lead.appointmentBookedAt = null;
        lead.appointmentBookingReason = null;
      }

      await lead.save();

      res.json({ message: 'Lead status updated', lead });
    } catch (error) {
      console.error('Error updating lead status:', error);
      res.status(500).json({ message: 'Failed to update lead status', error: error.message });
    }
  }

  /**
   * Update appointment booking status
   * Only available if lead status is 'contacted'
   */
  static async updateAppointmentStatus(req, res) {
    try {
      const { leadId } = req.params;
      const { appointmentBooked, reason } = req.body;
      const customerId = req.effectiveCustomerId;

      // Allow boolean or null/undefined
      if (appointmentBooked !== undefined && appointmentBooked !== null && typeof appointmentBooked !== 'boolean') {
        return res.status(400).json({ message: 'appointmentBooked must be a boolean, null, or undefined' });
      }

      // Require reason if appointmentBooked is false
      if (appointmentBooked === false && !reason) {
        return res.status(400).json({ message: 'Reason is required when appointment was not booked' });
      }

      const lead = await MetaLead.findOne({ _id: leadId, customerId });

      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      // Only allow appointment booking if lead was contacted
      if (lead.status !== 'contacted') {
        return res.status(400).json({ message: 'Appointment booking can only be updated for contacted leads' });
      }

      const wasAppointmentBooked = lead.appointmentBooked === true;
      lead.appointmentBooked = appointmentBooked !== undefined ? appointmentBooked : null;
      lead.appointmentBookedAt = appointmentBooked === true ? new Date() : null;
      lead.appointmentBookingReason = reason || null;

      await lead.save();

      if (appointmentBooked === true && !wasAppointmentBooked) {
        const customer = await User.findById(customerId).select('name customerSettings.displayName').lean();
        await sendBookedAppointmentWebhook(lead, customer);
      }

      res.json({ message: 'Appointment status updated', lead });
    } catch (error) {
      console.error('Error updating appointment status:', error);
      res.status(500).json({ message: 'Failed to update appointment status', error: error.message });
    }
  }

  /**
   * Add notes to a lead
   */
  static async updateLeadNotes(req, res) {
    try {
      const { leadId } = req.params;
      const { notes } = req.body;
      const customerId = req.effectiveCustomerId;

      const lead = await MetaLead.findOne({ _id: leadId, customerId });

      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      lead.notes = notes || null;

      await lead.save();

      res.json({ message: 'Lead notes updated', lead });
    } catch (error) {
      console.error('Error updating lead notes:', error);
      res.status(500).json({ message: 'Failed to update lead notes', error: error.message });
    }
  }

  /**
   * Get single lead details
   */
  static async getLeadDetails(req, res) {
    try {
      const { leadId } = req.params;
      const customerId = req.effectiveCustomerId;

      const lead = await MetaLead.findOne({ _id: leadId, customerId })
        .populate('customerId', 'name email');

      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      res.json({ lead });
    } catch (error) {
      console.error('Error getting lead details:', error);
      res.status(500).json({ message: 'Failed to get lead details', error: error.message });
    }
  }

  // ========== ADMIN METHODS ==========

  /**
   * Get all leads (admin view)
   */
  static async getAllLeads(req, res) {
    try {
      const { customerId, status, month, year, limit = 50, page = 1 } = req.query;

      const query = {};

      if (customerId) {
        query.customerId = customerId;
      }

      if (status && ['new', 'contacted', 'not_contacted'].includes(status)) {
        query.status = status;
      }

      if (month && year) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);
        query.emailDate = { $gte: startDate, $lte: endDate };
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const leads = await MetaLead.find(query)
        .populate('customerId', 'name email')
        .sort({ emailDate: -1 })
        .limit(parseInt(limit))
        .skip(skip);

      const total = await MetaLead.countDocuments(query);

      res.json({
        leads,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error getting all leads:', error);
      res.status(500).json({ message: 'Failed to get leads', error: error.message });
    }
  }

  /**
   * Get all subject mappings (admin)
   */
  static async getSubjectMappings(req, res) {
    try {
      const mappings = await MetaLeadSubjectMapping.find()
        .populate('customerId', 'name email')
        .sort({ createdAt: -1 });

      res.json({ mappings });
    } catch (error) {
      console.error('Error getting subject mappings:', error);
      res.status(500).json({ message: 'Failed to get subject mappings', error: error.message });
    }
  }

  /**
   * Get all folder mappings (admin)
   */
  static async getFolderMappings(req, res) {
    try {
      const mappings = await MetaLeadFolderMapping.find()
        .populate('customerId', 'name email')
        .sort({ createdAt: -1 });

      res.json({ mappings });
    } catch (error) {
      console.error('Error getting folder mappings:', error);
      res.status(500).json({ message: 'Failed to get folder mappings', error: error.message });
    }
  }

  /**
   * List available IMAP folders for admin mapping.
   */
  static async getAvailableFolders(req, res) {
    try {
      const folders = await metaLeadsEmailService.getAvailableFolders();
      res.json({ folders });
    } catch (error) {
      console.error('Error getting available folders:', error);
      res.status(500).json({ message: 'Failed to get available folders', error: error.message });
    }
  }

  /**
   * Create subject mapping (admin)
   */
  static async createSubjectMapping(req, res) {
    try {
      const { customerId, emailSubject, notes } = req.body;

      if (!customerId || !emailSubject) {
        return res.status(400).json({ message: 'customerId and emailSubject are required' });
      }

      // Check if customer exists
      const customer = await User.findById(customerId);
      if (!customer || customer.role !== 'customer') {
        return res.status(404).json({ message: 'Customer not found' });
      }

      // Normalize subject same as incoming emails so matching works (Facebook may send different whitespace)
      const normalizedSubject = normalizeSubjectForMapping(emailSubject);
      if (!normalizedSubject) {
        return res.status(400).json({ message: 'Email subject is required and cannot be blank' });
      }
      const subjectLower = normalizedSubject.toLowerCase();

      // Check if mapping already exists (by normalized or lower)
      const existing = await MetaLeadSubjectMapping.findOne({
        $or: [
          { emailSubject: normalizedSubject },
          { emailSubjectLower: subjectLower }
        ]
      });
      if (existing) {
        return res.status(400).json({ message: 'Subject mapping already exists for this subject' });
      }

      const mapping = new MetaLeadSubjectMapping({
        customerId,
        emailSubject: normalizedSubject,
        emailSubjectLower: subjectLower,
        notes: notes || null
      });

      await mapping.save();
      await mapping.populate('customerId', 'name email');

      res.json({ message: 'Subject mapping created', mapping });
    } catch (error) {
      console.error('Error creating subject mapping:', error);
      res.status(500).json({ message: 'Failed to create subject mapping', error: error.message });
    }
  }

  /**
   * Create folder mapping (admin)
   */
  static async createFolderMapping(req, res) {
    try {
      const { customerId, folderName, notes } = req.body;

      if (!customerId || !folderName) {
        return res.status(400).json({ message: 'customerId and folderName are required' });
      }

      const customer = await User.findById(customerId);
      if (!customer || customer.role !== 'customer') {
        return res.status(404).json({ message: 'Customer not found' });
      }

      const normalizedFolder = normalizeFolderForMapping(folderName);
      if (!normalizedFolder) {
        return res.status(400).json({ message: 'Folder name is required and cannot be blank' });
      }

      const existing = await MetaLeadFolderMapping.findOne({ folderNameLower: normalizedFolder });
      if (existing) {
        return res.status(400).json({ message: 'Folder mapping already exists for this folder' });
      }

      const mapping = new MetaLeadFolderMapping({
        customerId,
        folderName: folderName.trim(),
        folderNameLower: normalizedFolder,
        notes: notes || null
      });

      await mapping.save();
      await mapping.populate('customerId', 'name email');

      res.json({ message: 'Folder mapping created', mapping });
    } catch (error) {
      console.error('Error creating folder mapping:', error);
      res.status(500).json({ message: 'Failed to create folder mapping', error: error.message });
    }
  }

  /**
   * Update subject mapping (admin)
   */
  static async updateSubjectMapping(req, res) {
    try {
      const { mappingId } = req.params;
      const { customerId, emailSubject, isActive, notes } = req.body;

      const mapping = await MetaLeadSubjectMapping.findById(mappingId);

      if (!mapping) {
        return res.status(404).json({ message: 'Subject mapping not found' });
      }

      if (customerId) {
        const customer = await User.findById(customerId);
        if (!customer || customer.role !== 'customer') {
          return res.status(404).json({ message: 'Customer not found' });
        }
        mapping.customerId = customerId;
      }

      if (emailSubject !== undefined) {
        const normalizedSubject = normalizeSubjectForMapping(emailSubject);
        if (!normalizedSubject) {
          return res.status(400).json({ message: 'Email subject cannot be blank' });
        }
        const subjectLower = normalizedSubject.toLowerCase();
        // Check if new subject already exists (by normalized or lower)
        if (normalizedSubject !== mapping.emailSubject && subjectLower !== (mapping.emailSubjectLower || '')) {
          const existing = await MetaLeadSubjectMapping.findOne({
            $or: [
              { emailSubject: normalizedSubject },
              { emailSubjectLower: subjectLower }
            ],
            _id: { $ne: mappingId }
          });
          if (existing) {
            return res.status(400).json({ message: 'Subject mapping already exists for this subject' });
          }
        }
        mapping.emailSubject = normalizedSubject;
        mapping.emailSubjectLower = subjectLower;
      }

      if (isActive !== undefined) {
        mapping.isActive = isActive;
      }

      if (notes !== undefined) {
        mapping.notes = notes;
      }

      await mapping.save();
      await mapping.populate('customerId', 'name email');

      res.json({ message: 'Subject mapping updated', mapping });
    } catch (error) {
      console.error('Error updating subject mapping:', error);
      res.status(500).json({ message: 'Failed to update subject mapping', error: error.message });
    }
  }

  /**
   * Update folder mapping (admin)
   */
  static async updateFolderMapping(req, res) {
    try {
      const { mappingId } = req.params;
      const { customerId, folderName, isActive, notes } = req.body;

      const mapping = await MetaLeadFolderMapping.findById(mappingId);

      if (!mapping) {
        return res.status(404).json({ message: 'Folder mapping not found' });
      }

      if (customerId) {
        const customer = await User.findById(customerId);
        if (!customer || customer.role !== 'customer') {
          return res.status(404).json({ message: 'Customer not found' });
        }
        mapping.customerId = customerId;
      }

      if (folderName !== undefined) {
        const normalizedFolder = normalizeFolderForMapping(folderName);
        if (!normalizedFolder) {
          return res.status(400).json({ message: 'Folder name cannot be blank' });
        }

        if (normalizedFolder !== (mapping.folderNameLower || '')) {
          const existing = await MetaLeadFolderMapping.findOne({
            folderNameLower: normalizedFolder,
            _id: { $ne: mappingId }
          });
          if (existing) {
            return res.status(400).json({ message: 'Folder mapping already exists for this folder' });
          }
        }

        mapping.folderName = folderName.trim();
        mapping.folderNameLower = normalizedFolder;
      }

      if (isActive !== undefined) {
        mapping.isActive = isActive;
      }

      if (notes !== undefined) {
        mapping.notes = notes;
      }

      await mapping.save();
      await mapping.populate('customerId', 'name email');

      res.json({ message: 'Folder mapping updated', mapping });
    } catch (error) {
      console.error('Error updating folder mapping:', error);
      res.status(500).json({ message: 'Failed to update folder mapping', error: error.message });
    }
  }

  /**
   * Delete subject mapping (admin)
   */
  static async deleteSubjectMapping(req, res) {
    try {
      const { mappingId } = req.params;

      const mapping = await MetaLeadSubjectMapping.findById(mappingId);

      if (!mapping) {
        return res.status(404).json({ message: 'Subject mapping not found' });
      }

      await mapping.deleteOne();

      res.json({ message: 'Subject mapping deleted' });
    } catch (error) {
      console.error('Error deleting subject mapping:', error);
      res.status(500).json({ message: 'Failed to delete subject mapping', error: error.message });
    }
  }

  /**
   * Delete folder mapping (admin)
   */
  static async deleteFolderMapping(req, res) {
    try {
      const { mappingId } = req.params;

      const mapping = await MetaLeadFolderMapping.findById(mappingId);

      if (!mapping) {
        return res.status(404).json({ message: 'Folder mapping not found' });
      }

      await mapping.deleteOne();

      res.json({ message: 'Folder mapping deleted' });
    } catch (error) {
      console.error('Error deleting folder mapping:', error);
      res.status(500).json({ message: 'Failed to delete folder mapping', error: error.message });
    }
  }

  /**
   * Test which clinic would get a lead for a given subject line (admin debug).
   * GET /admin/test-subject?subject=...
   */
  static async testSubject(req, res) {
    try {
      const { subject } = req.query;
      if (!subject || typeof subject !== 'string') {
        return res.status(400).json({ message: 'Query parameter "subject" is required' });
      }
      const metaLeadsEmailService = require('../services/metaLeadsEmailService');
      const result = await metaLeadsEmailService.testSubjectMatch(subject);
      res.json(result);
    } catch (error) {
      console.error('Error testing subject:', error);
      res.status(500).json({ message: 'Failed to test subject', error: error.message });
    }
  }

  /**
   * Sync leads from email (customer/receptionist): connect to leads@ inbox, process last 7 days,
   * create any missing leads for clinics whose subject mappings match. Then the client can refetch the list.
   */
  static async syncEmailsForCustomer(req, res) {
    try {
      const metaLeadsEmailService = require('../services/metaLeadsEmailService');
      const customerId = req.effectiveCustomerId;
      if (!metaLeadsEmailService.hasCredentials()) {
        return res.status(503).json({
          message: 'Email sync is not configured. Please contact support.',
          result: { emailsFound: 0, leadsCreated: 0, errors: ['Leads email password not set on server.'] }
        });
      }

      // Build a clinic-aware lookback window so refresh can backfill missing leads.
      // Important edge case: if subject mapping was recently updated (e.g. renamed to
      // match cPanel subject), we should deep-backfill to recover previously missed emails.
      const latestLead = await MetaLead.findOne({ customerId }).sort({ emailDate: -1 }).select('emailDate');
      const latestActiveSubjectMapping = await MetaLeadSubjectMapping.findOne({
        customerId,
        isActive: true
      })
        .sort({ updatedAt: -1 })
        .select('updatedAt emailSubject');
      const activeFolderMappings = await MetaLeadFolderMapping.find({
        customerId,
        isActive: true
      })
        .sort({ updatedAt: -1, folderName: 1 })
        .select('updatedAt folderName');

      let daysBack = 30;
      let lookbackReason = 'default_30_days';

      const latestSubjectUpdatedAt = latestActiveSubjectMapping?.updatedAt ? new Date(latestActiveSubjectMapping.updatedAt) : null;
      const latestFolderUpdatedAt = activeFolderMappings[0]?.updatedAt ? new Date(activeFolderMappings[0].updatedAt) : null;
      const latestMappingUpdatedAt = [latestSubjectUpdatedAt, latestFolderUpdatedAt]
        .filter(Boolean)
        .sort((a, b) => b.getTime() - a.getTime())[0] || null;
      const mappingUpdatedRecently = latestMappingUpdatedAt
        ? (Date.now() - latestMappingUpdatedAt.getTime()) <= (30 * 24 * 60 * 60 * 1000)
        : false;

      if (mappingUpdatedRecently) {
        // Mapping changed recently: force deep backfill for missed historical emails.
        daysBack = 365;
        lookbackReason = 'recent_mapping_update_backfill_365_days';
      } else if (latestLead?.emailDate) {
        const msSinceLatest = Date.now() - new Date(latestLead.emailDate).getTime();
        const daysSinceLatest = Math.max(0, Math.ceil(msSinceLatest / (24 * 60 * 60 * 1000)));
        // Include a buffer to catch timezone/date edge cases around midnight.
        daysBack = Math.max(30, Math.min(365, daysSinceLatest + 7));
        lookbackReason = 'based_on_latest_lead_date';
      } else {
        // New clinic or no historic leads yet: do a deeper backfill.
        daysBack = 365;
        lookbackReason = 'no_existing_leads_backfill_365_days';
      }

      const beforeCount = await MetaLead.countDocuments({ customerId });
      const folderNames = activeFolderMappings.map((mapping) => mapping.folderName).filter(Boolean);
      const checkResult = folderNames.length > 0
        ? await metaLeadsEmailService.checkSpecificFolders(folderNames, daysBack)
        : await metaLeadsEmailService.checkForNewEmails(daysBack);
      const afterCount = await MetaLead.countDocuments({ customerId });
      const leadsCreatedForCustomer = Math.max(0, afterCount - beforeCount);

      const result = {
        ...checkResult,
        syncStrategy: folderNames.length > 0 ? 'mapped_folders' : 'global_mailbox_fallback',
        mappedFoldersChecked: folderNames,
        daysBackUsed: daysBack,
        lookbackReason,
        latestLeadAt: latestLead?.emailDate || null,
        latestMappingUpdatedAt: latestMappingUpdatedAt || null,
        latestMappingSubject: latestActiveSubjectMapping?.emailSubject || null,
        leadsCreatedForCustomer
      };

      res.json({
        message: folderNames.length > 0
          ? 'Sync completed using your mapped Meta Leads folder(s).'
          : 'Sync completed. No active folder mapping found, so the mailbox fallback was used.',
        result
      });
    } catch (error) {
      console.error('Error syncing leads from email:', error);
      res.status(500).json({
        message: 'Failed to sync from email',
        error: error.message,
        result: { emailsFound: 0, leadsCreated: 0, errors: [error.message] }
      });
    }
  }

  /**
   * Manually trigger email check (admin)
   */
  static async triggerEmailCheck(req, res) {
    try {
      const metaLeadsEmailService = require('../services/metaLeadsEmailService');
      
      // Check for emails from the past 7 days (not just today)
      // This ensures we catch any emails that might have been missed
      const checkResult = await metaLeadsEmailService.checkForNewEmails(30);
      
      res.json({ 
        message: 'Email check completed',
        result: checkResult
      });
    } catch (error) {
      console.error('Error triggering email check:', error);
      res.status(500).json({ 
        message: 'Failed to trigger email check', 
        error: error.message 
      });
    }
  }

  /**
   * Import leads from a single mapped folder (admin).
   * Reads the folder, creates any missing leads, and customer portal will reflect saved records.
   */
  static async importFolderMapping(req, res) {
    try {
      const { mappingId } = req.params;
      const mapping = await MetaLeadFolderMapping.findById(mappingId).populate('customerId', 'name email');

      if (!mapping) {
        return res.status(404).json({ message: 'Folder mapping not found' });
      }

      if (!mapping.isActive) {
        return res.status(400).json({ message: 'Folder mapping is inactive' });
      }

      const beforeCount = await MetaLead.countDocuments({ customerId: mapping.customerId._id });
      const importResult = await metaLeadsEmailService.checkSpecificFolders([mapping.folderName], null);
      const afterCount = await MetaLead.countDocuments({ customerId: mapping.customerId._id });

      res.json({
        message: `Imported leads from folder "${mapping.folderName}" for ${mapping.customerId.name}.`,
        result: {
          ...importResult,
          folderName: mapping.folderName,
          customerId: mapping.customerId._id,
          customerName: mapping.customerId.name,
          leadsCreatedForCustomer: Math.max(0, afterCount - beforeCount)
        }
      });
    } catch (error) {
      console.error('Error importing folder mapping:', error);
      res.status(500).json({
        message: 'Failed to import leads from folder',
        error: error.message
      });
    }
  }

  /**
   * Get live monitoring status (admin)
   */
  static async getMonitoringStatus(req, res) {
    try {
      const status = metaLeadsEmailService.getMonitoringStatus();
      res.json({ status });
    } catch (error) {
      console.error('Error getting monitoring status:', error);
      res.status(500).json({ message: 'Failed to get monitoring status', error: error.message });
    }
  }

  /**
   * Live IMAP connectivity test (admin)
   */
  static async testImapConnection(req, res) {
    try {
      const result = await metaLeadsEmailService.testImapConnection();
      if (!result.ok) {
        return res.status(503).json({ message: 'IMAP connection test failed', result });
      }
      res.json({ message: 'IMAP connection test passed', result });
    } catch (error) {
      console.error('Error testing IMAP connection:', error);
      res.status(500).json({ message: 'Failed to test IMAP connection', error: error.message });
    }
  }

  /**
   * Ingestion audit by clinic (admin)
   * Shows latest lead date and recent volume to quickly identify stale clinics.
   */
  static async getIngestionAudit(req, res) {
    try {
      const now = new Date();
      const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const activeMappings = await MetaLeadFolderMapping.find({ isActive: true })
        .populate('customerId', 'name email location role');

      const mappedCustomers = new Map();
      for (const mapping of activeMappings) {
        if (!mapping.customerId || mapping.customerId.role !== 'customer') continue;
        const key = String(mapping.customerId._id);
        if (!mappedCustomers.has(key)) {
          mappedCustomers.set(key, {
            customerId: key,
            customerName: mapping.customerId.name || null,
            customerEmail: mapping.customerId.email || null,
            location: mapping.customerId.location || null,
            folders: []
          });
        }
        mappedCustomers.get(key).folders.push(mapping.folderName);
      }

      const leadsAgg = await MetaLead.aggregate([
        {
          $group: {
            _id: '$customerId',
            latestLeadDate: { $max: '$emailDate' },
            totalLeads: { $sum: 1 },
            leadsLast30Days: {
              $sum: {
                $cond: [{ $gte: ['$emailDate', since30] }, 1, 0]
              }
            }
          }
        }
      ]);

      const aggByCustomer = new Map();
      for (const row of leadsAgg) {
        aggByCustomer.set(String(row._id), row);
      }

      const clinics = Array.from(mappedCustomers.values()).map((c) => {
        const agg = aggByCustomer.get(c.customerId);
        const latestLeadDate = agg?.latestLeadDate || null;
        let staleDays = null;
        if (latestLeadDate) {
          staleDays = Math.floor((now.getTime() - new Date(latestLeadDate).getTime()) / (24 * 60 * 60 * 1000));
        }
        return {
          ...c,
          folderCount: c.folders.length,
          latestLeadDate,
          staleDays,
          totalLeads: agg?.totalLeads || 0,
          leadsLast30Days: agg?.leadsLast30Days || 0,
          isStale: latestLeadDate ? staleDays > 7 : true
        };
      });

      clinics.sort((a, b) => {
        if (a.isStale !== b.isStale) return a.isStale ? -1 : 1;
        const aDate = a.latestLeadDate ? new Date(a.latestLeadDate).getTime() : 0;
        const bDate = b.latestLeadDate ? new Date(b.latestLeadDate).getTime() : 0;
        return aDate - bDate;
      });

      res.json({
        generatedAt: now.toISOString(),
        totalMappedClinics: clinics.length,
        staleClinics: clinics.filter((c) => c.isStale).length,
        monitoring: metaLeadsEmailService.getMonitoringStatus(),
        clinics
      });
    } catch (error) {
      console.error('Error getting ingestion audit:', error);
      res.status(500).json({ message: 'Failed to get ingestion audit', error: error.message });
    }
  }
}

module.exports = MetaLeadsController;

