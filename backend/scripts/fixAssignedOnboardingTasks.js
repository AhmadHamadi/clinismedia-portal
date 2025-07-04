const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const AssignedOnboardingTask = require('../models/AssignedOnboardingTask');

async function fixAssignedOnboardingTasks() {
  await mongoose.connect(process.env.MONGODB_URI);
  const tasks = await AssignedOnboardingTask.find();
  let updated = 0;
  for (const task of tasks) {
    let needsUpdate = false;
    let update = {};
    if (typeof task.clinicId === 'string') {
      update.clinicId = mongoose.Types.ObjectId(task.clinicId);
      needsUpdate = true;
    }
    if (typeof task.taskId === 'string') {
      update.taskId = mongoose.Types.ObjectId(task.taskId);
      needsUpdate = true;
    }
    if (needsUpdate) {
      await AssignedOnboardingTask.updateOne({ _id: task._id }, { $set: update });
      updated++;
    }
  }
  console.log(`Updated ${updated} assigned onboarding tasks to use ObjectId for clinicId and taskId.`);
  process.exit();
}

fixAssignedOnboardingTasks(); 