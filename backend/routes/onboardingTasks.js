const express = require('express');
const router = express.Router();
const onboardingTaskController = require('../controllers/onboardingTaskController');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

// Master onboarding tasks (admin only)
router.post('/', authenticateToken, authorizeRole(['admin']), onboardingTaskController.createTask);
router.get('/', onboardingTaskController.getAllTasks);
router.put('/:id', authenticateToken, authorizeRole(['admin']), onboardingTaskController.updateTask);
router.delete('/:id', authenticateToken, authorizeRole(['admin']), onboardingTaskController.deleteTask);

// Assign/unassign tasks to clinics (admin only)
router.post('/assign', authenticateToken, authorizeRole(['admin']), onboardingTaskController.assignTasksToClinic);

// Mark a task as completed for a clinic (admin only)
router.post('/mark-completed', authenticateToken, authorizeRole(['admin']), onboardingTaskController.markTaskCompleted);

// Get assigned tasks for a clinic (customer portal)
router.get('/assigned/:clinicId', authenticateToken, authorizeRole(['admin', 'customer']), onboardingTaskController.getAssignedTasksForClinic);

// Get all clinics and their assignments (admin overview)
router.get('/assignments/all', authenticateToken, authorizeRole(['admin']), onboardingTaskController.getAllClinicAssignments);

// Update status for an assigned onboarding task (admin only)
router.post('/update-status', authenticateToken, authorizeRole(['admin']), onboardingTaskController.updateAssignedTaskStatus);

// Remove an assigned onboarding task from a clinic (admin only)
router.post('/remove-assignment', authenticateToken, authorizeRole(['admin']), onboardingTaskController.removeAssignedTask);

module.exports = router; 