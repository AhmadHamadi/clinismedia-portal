const express = require('express');
const router = express.Router();
const { createTask, getAllTasks, getEmployeeTasks, updateTaskStatus } = require('../controllers/taskController');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole'); // Assuming you have an authorizeRole middleware
const Task = require('../models/Task');

// Admin routes for tasks
router.route('/')
  .post(authenticateToken, authorizeRole(['admin']), createTask) // Create a new task (Admin only)
  .get(authenticateToken, authorizeRole(['admin']), getAllTasks);  // Get all tasks (Admin only)

// Employee specific routes for tasks
router.get('/employee/:employeeId', authenticateToken, authorizeRole(['employee']), getEmployeeTasks); // Get tasks for a specific employee
router.put('/:id/status', authenticateToken, authorizeRole(['employee']), updateTaskStatus); // Update task status (Employee only)

// Get count of new tasks for employee
router.get('/employee/:employeeId/new-count', authenticateToken, authorizeRole(['employee']), async (req, res) => {
  try {
    const employeeId = req.user.id;
    const newTasksCount = await Task.countDocuments({ assignedTo: employeeId, isUnread: true });
    console.log(`Backend: New tasks count for employee ${employeeId}: ${newTasksCount}`);
    res.json({ count: newTasksCount });
  } catch (error) {
    console.error("Backend Error fetching new tasks count:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 