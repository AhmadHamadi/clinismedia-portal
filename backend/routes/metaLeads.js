const express = require('express');
const router = express.Router();
const MetaLeadsController = require('../controllers/metaLeadsController');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');
const resolveEffectiveCustomerId = require('../middleware/resolveEffectiveCustomerId');

// ========== CUSTOMER ROUTES ==========

// Get customer leads
router.get('/customer/leads', authenticateToken, authorizeRole(['customer', 'receptionist']), resolveEffectiveCustomerId, MetaLeadsController.getCustomerLeads);

// Get customer lead statistics
router.get('/customer/stats', authenticateToken, authorizeRole(['customer', 'receptionist']), resolveEffectiveCustomerId, MetaLeadsController.getCustomerLeadStats);

// Get single lead details
router.get('/customer/leads/:leadId', authenticateToken, authorizeRole(['customer', 'receptionist']), resolveEffectiveCustomerId, MetaLeadsController.getLeadDetails);

// Update lead status (contacted/not contacted)
router.patch('/customer/leads/:leadId/status', authenticateToken, authorizeRole(['customer', 'receptionist']), resolveEffectiveCustomerId, MetaLeadsController.updateLeadStatus);

// Update appointment booking status
router.patch('/customer/leads/:leadId/appointment', authenticateToken, authorizeRole(['customer', 'receptionist']), resolveEffectiveCustomerId, MetaLeadsController.updateAppointmentStatus);

// Update lead notes
router.patch('/customer/leads/:leadId/notes', authenticateToken, authorizeRole(['customer', 'receptionist']), resolveEffectiveCustomerId, MetaLeadsController.updateLeadNotes);

// ========== ADMIN ROUTES ==========

// Get all leads (admin)
router.get('/admin/leads', authenticateToken, authorizeRole(['admin']), MetaLeadsController.getAllLeads);

// Get all subject mappings (admin)
router.get('/admin/subject-mappings', authenticateToken, authorizeRole(['admin']), MetaLeadsController.getSubjectMappings);

// Create subject mapping (admin)
router.post('/admin/subject-mappings', authenticateToken, authorizeRole(['admin']), MetaLeadsController.createSubjectMapping);

// Update subject mapping (admin)
router.patch('/admin/subject-mappings/:mappingId', authenticateToken, authorizeRole(['admin']), MetaLeadsController.updateSubjectMapping);

// Delete subject mapping (admin)
router.delete('/admin/subject-mappings/:mappingId', authenticateToken, authorizeRole(['admin']), MetaLeadsController.deleteSubjectMapping);

// Manually trigger email check (admin)
router.post('/admin/check-emails', authenticateToken, authorizeRole(['admin']), MetaLeadsController.triggerEmailCheck);

module.exports = router;

