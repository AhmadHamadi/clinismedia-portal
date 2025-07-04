const OnboardingTask = require('../models/OnboardingTask');
const AssignedOnboardingTask = require('../models/AssignedOnboardingTask');
const User = require('../models/User');
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
    const { clinicId, taskIds } = req.body; // taskIds: array of onboarding task _ids
    console.log('Assigning tasks to clinic:', { clinicId, taskIds });
    
    // Find already assigned taskIds for this clinic
    const existingAssignments = await AssignedOnboardingTask.find({ clinicId });
    console.log('Existing assignments for clinic:', existingAssignments);
    
    const alreadyAssignedTaskIds = existingAssignments.map(a => a.taskId.toString());
    console.log('Already assigned task IDs:', alreadyAssignedTaskIds);
    
    // Filter out taskIds that are already assigned
    const newTaskIds = taskIds.filter(taskId => !alreadyAssignedTaskIds.includes(taskId));
    console.log('New task IDs to assign:', newTaskIds);
    
    if (newTaskIds.length === 0) {
      console.log('No new tasks to assign');
      return res.status(200).json({ message: 'All tasks already assigned' });
    }
    
    // Assign only new tasks, ensuring ObjectId type
    const assignments = await AssignedOnboardingTask.insertMany(
      newTaskIds.map(taskId => ({
        clinicId: new mongoose.Types.ObjectId(clinicId),
        taskId: new mongoose.Types.ObjectId(taskId)
      }))
    );
    console.log('Created assignments:', assignments);
    res.status(201).json(assignments);
  } catch (err) {
    console.error('Error in assignTasksToClinic:', err);
    res.status(500).json({ error: err.message });
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
    const update = { status };
    if (status === 'completed') {
      update.completedAt = new Date();
    } else {
      update.completedAt = null;
    }
    console.log('Updating status:', { clinicId, taskId, status, update });
    const assignment = await AssignedOnboardingTask.findOneAndUpdate(
      { clinicId, taskId },
      update,
      { new: true }
    );
    console.log('Updated assignment:', assignment);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    res.json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
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