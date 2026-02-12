const MetaLead = require('../models/MetaLead');
const MetaLeadSubjectMapping = require('../models/MetaLeadSubjectMapping');
const User = require('../models/User');

/** Normalize subject the same way as metaLeadsEmailService (collapse whitespace) so stored mappings match incoming Facebook emails */
function normalizeSubjectForMapping(subject) {
  if (!subject || typeof subject !== 'string') return '';
  return subject
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

      lead.appointmentBooked = appointmentBooked !== undefined ? appointmentBooked : null;
      lead.appointmentBookedAt = appointmentBooked === true ? new Date() : null;
      lead.appointmentBookingReason = reason || null;

      await lead.save();

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
   * Manually trigger email check (admin)
   */
  static async triggerEmailCheck(req, res) {
    try {
      const metaLeadsEmailService = require('../services/metaLeadsEmailService');
      
      // Check for emails from the past 7 days (not just today)
      // This ensures we catch any emails that might have been missed
      const checkResult = await metaLeadsEmailService.checkForNewEmails(7);
      
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
}

module.exports = MetaLeadsController;

