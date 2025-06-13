const Task = require('../models/Task');
const User = require('../models/User');
const Notification = require('../models/Notification');

// @desc    Create a new task
// @route   POST /api/tasks
// @access  Admin
exports.createTask = async (req, res) => {
  try {
    const { title, description, assignedTo, dueDate, status, priority } = req.body;
    const assignedBy = req.user.id; // Admin ID from authenticated token

    // Basic validation
    if (!title || !assignedTo) {
      return res.status(400).json({ message: 'Please include a title and assigned employee.' });
    }

    // Check if assignedTo is a valid employee
    const employee = await User.findById(assignedTo);
    if (!employee || employee.role !== 'employee') {
      return res.status(400).json({ message: 'Assigned user is not a valid employee.' });
    }

    const task = new Task({
      title,
      description,
      assignedTo,
      assignedBy,
      dueDate,
      status,
      priority,
      isUnread: true,
    });

    await task.save();

    // Create a notification for the assigned employee
    const notification = new Notification({
      userId: assignedTo,
      type: 'task',
      message: `New task assigned: "${title}".`,
      link: `/employee/tasks`, // Link to the employee's tasks page
    });
    await notification.save();

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all tasks (for admin)
// @route   GET /api/tasks
// @access  Admin
exports.getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.find({}).populate('assignedTo', 'name email department').populate('assignedBy', 'name');
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get tasks assigned to a specific employee
// @route   GET /api/tasks/employee/:employeeId
// @access  Employee
exports.getEmployeeTasks = async (req, res) => {
  try {
    const employeeId = req.user.id; // Employee ID from authenticated token
    const tasks = await Task.find({ assignedTo: employeeId }).populate('assignedTo', 'name email department').populate('assignedBy', 'name');

    // Mark tasks as not new when employee views them
    await Task.updateMany(
      { assignedTo: employeeId, isUnread: true },
      { $set: { isUnread: false } }
    );

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a task's status by employee
// @route   PUT /api/tasks/:id/status
// @access  Employee
exports.updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const taskId = req.params.id;
    const employeeId = req.user.id; // Employee ID from authenticated token

    const task = await Task.findOne({ _id: taskId, assignedTo: employeeId });

    if (!task) {
      return res.status(404).json({ message: 'Task not found or not assigned to you.' });
    }

    if (!['pending', 'in-progress', 'completed', 'overdue'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status provided.' });
    }

    task.status = status;
    await task.save();

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to update task status.' });
  }
}; 