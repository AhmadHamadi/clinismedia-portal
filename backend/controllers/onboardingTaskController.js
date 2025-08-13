const OnboardingTask = require('../models/OnboardingTask');
const AssignedOnboardingTask = require('../models/AssignedOnboardingTask');
const User = require('../models/User');
const OnboardingEmailService = require('../services/onboardingEmailService');
const mongoose = require('mongoose');

// Master Onboarding Tasks CRUD
exports.createTask = async (req, res) => {
  try {
    const { title, description } = req.body;
    const task = new OnboardingTask({ title, description });
    await task.save();
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllTasks = async (req, res) => {
  try {
    const tasks = await OnboardingTask.find();
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    const updated = await OnboardingTask.findByIdAndUpdate(id, { title, description }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Task not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    await OnboardingTask.findByIdAndDelete(id);
    // Optionally, remove all assignments for this task
    await AssignedOnboardingTask.deleteMany({ taskId: id });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Assign/unassign tasks to clinics
exports.assignTasksToClinic = async (req, res) => {
  try {
    const { clinicId, taskIds } = req.body;
    
    if (!clinicId || !taskIds || !Array.isArray(taskIds)) {
      return res.status(400).json({ message: 'Clinic ID and task IDs array are required' });
    }
    
    // Get clinic details
    const clinic = await User.findById(clinicId);
    if (!clinic) {
      return res.status(404).json({ message: 'Clinic not found' });
    }
    
    // Delete existing assignments for this clinic
    await AssignedOnboardingTask.deleteMany({ clinicId });
    
    // Create new assignments
    const assignments = taskIds.map(taskId => ({
      clinicId,
      taskId,
      assignedAt: new Date()
    }));
    
    await AssignedOnboardingTask.insertMany(assignments);
    
    // Automatically increment customer notification count for onboarding
    try {
      const CustomerNotification = require('../models/CustomerNotification');
      let notification = await CustomerNotification.findOne({ customerId: clinicId });
      
      if (!notification) {
        notification = new CustomerNotification({ customerId: clinicId });
      }
      
      notification.onboarding.unreadCount += 1;
      notification.onboarding.lastUpdated = new Date();
      await notification.save();
      
      console.log(`✅ Onboarding notification incremented for customer ${clinicId}`);
    } catch (notificationError) {
      console.error('❌ Failed to increment onboarding notification:', notificationError);
      // Don't fail the main operation if notification fails
    }
    
    // Send email notifications for each assigned task
    for (const taskId of taskIds) {
      const task = await OnboardingTask.findById(taskId);
      if (task) {
        await OnboardingEmailService.sendTaskCreatedEmail(clinic, task);
      }
    }
    
    res.json({ message: 'Tasks assigned successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Mark a task as completed for a clinic
exports.markTaskCompleted = async (req, res) => {
  try {
    const { clinicId, taskId } = req.body;
    const assignment = await AssignedOnboardingTask.findOneAndUpdate(
      { clinicId, taskId },
      { completed: true },
      { new: true }
    );
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    res.json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update status for an assigned onboarding task
exports.updateAssignedTaskStatus = async (req, res) => {
  try {
    const { clinicId, taskId, status } = req.body;
    
    if (!clinicId || !taskId || !status) {
      return res.status(400).json({ message: 'Clinic ID, task ID, and status are required' });
    }
    
    const update = { status };
    if (status === 'completed') {
      update.completedAt = new Date();
    }
    
    const assignment = await AssignedOnboardingTask.findOneAndUpdate(
      { clinicId, taskId },
      update,
      { new: true }
    );
    
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    // Send email notifications based on status
    const clinic = await User.findById(clinicId);
    const task = await OnboardingTask.findById(taskId);
    
    if (clinic && task) {
      if (status === 'pending') {
        await OnboardingEmailService.sendTaskPendingEmail(clinic, task);
      } else if (status === 'completed') {
        await OnboardingEmailService.sendTaskCompletedEmail(clinic, task);
      }
    }
    
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get assigned tasks for a clinic (for customer portal)
exports.getAssignedTasksForClinic = async (req, res) => {
  try {
    const { clinicId } = req.params;
    console.log('Fetching assigned tasks for clinic:', clinicId);
    console.log('User making request:', req.user);
    
    // Get all assigned tasks for this clinic, regardless of status
    const assigned = await AssignedOnboardingTask.find({ clinicId }).populate('taskId');
    console.log('Found assigned tasks:', assigned);
    console.log('Number of assigned tasks:', assigned.length);
    
    res.json(assigned);
  } catch (err) {
    console.error('Error in getAssignedTasksForClinic:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get all clinics and their assigned onboarding tasks (for admin overview)
exports.getAllClinicAssignments = async (req, res) => {
  try {
    const clinics = await User.find({ role: 'customer' });
    const assignments = await AssignedOnboardingTask.find().populate('taskId clinicId');
    res.json({ clinics, assignments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Remove an assigned onboarding task from a clinic
exports.removeAssignedTask = async (req, res) => {
  try {
    const { clinicId, taskId } = req.body;
    await AssignedOnboardingTask.findOneAndDelete({ clinicId, taskId });
    res.json({ message: 'Assignment removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 