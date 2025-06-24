// src/components/Admin/OnboardingTasksPage.tsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../utils/api';

interface OnboardingTask {
  _id: string;
  title: string;
  description?: string;
  category: string;
}

interface Clinic {
  _id: string;
  name: string;
  email: string;
}

interface AssignedTask {
  _id: string;
  clinicId: Clinic | string;
  taskId: OnboardingTask | string;
  completed: boolean;
}

const OnboardingTasks: React.FC = () => {
  // Master tasks
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [newTask, setNewTask] = useState({ title: '', description: '', category: '' });
  const [editTask, setEditTask] = useState<OnboardingTask | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Clinics and assignments
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [clinicAssignments, setClinicAssignments] = useState<AssignedTask[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);

  // Add state for selected tasks and modal for clinic selection
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');

  // Fetch tasks from backend and group by category
  const [categories, setCategories] = useState<string[]>([]);

  const fetchTasks = async () => {
    const token = localStorage.getItem('adminToken');
    const res = await axios.get(`${API_BASE_URL}/onboarding-tasks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setTasks(res.data);
    setCategories([...new Set(res.data.map((t: any) => String(t.category)).filter(Boolean))] as string[]);
  };

  // Fetch clinics and assignments
  const fetchClinicsAndAssignments = async () => {
    const token = localStorage.getItem('adminToken');
    // Fetch clinics (customers)
    const clinicsRes = await axios.get(`${API_BASE_URL}/customers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setClinics(clinicsRes.data);
    // Fetch assignments
    const assignmentsRes = await axios.get(`${API_BASE_URL}/onboarding-tasks/assignments/all`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setClinicAssignments(assignmentsRes.data.assignments);
  };

  useEffect(() => {
    fetchTasks();
    fetchClinicsAndAssignments();
  }, []);

  // Add new task
  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    const token = localStorage.getItem('adminToken');
    await axios.post(`${API_BASE_URL}/onboarding-tasks`, newTask, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setNewTask({ title: '', description: '', category: '' });
    setShowTaskModal(false);
    fetchTasks();
  };

  // Edit task
  const handleEditTask = async () => {
    if (!editTask || !editTask.title.trim()) return;
    const token = localStorage.getItem('adminToken');
    await axios.put(`${API_BASE_URL}/onboarding-tasks/${editTask._id}`, editTask, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setShowEditModal(false);
    setEditTask(null);
    fetchTasks();
  };

  // Delete task
  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('Delete this onboarding task?')) return;
    const token = localStorage.getItem('adminToken');
    await axios.delete(`${API_BASE_URL}/onboarding-tasks/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchTasks();
    fetchClinicsAndAssignments();
  };

  // Select a clinic to assign tasks
  const handleSelectClinic = (clinic: Clinic) => {
    setSelectedClinic(clinic);
    // Find assigned tasks for this clinic
    const assigned = clinicAssignments.filter(a => {
      if (typeof a.clinicId === 'string') return a.clinicId === clinic._id;
      return a.clinicId._id === clinic._id;
    });
    setSelectedTasks(assigned.map(a => typeof a.taskId === 'string' ? a.taskId : a.taskId._id));
  };

  // Assign tasks to clinic
  const handleAssignTasks = async () => {
    if (!selectedClinic) return;
    setLoadingAssignments(true);
    const token = localStorage.getItem('adminToken');
    await axios.post(`${API_BASE_URL}/onboarding-tasks/assign`, {
      clinicId: selectedClinic._id,
      taskIds: selectedTasks,
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setLoadingAssignments(false);
    fetchClinicsAndAssignments();
    setSelectedClinic(null);
  };

  // Mark task as completed for a clinic
  const handleMarkCompleted = async (clinicId: string, taskId: string) => {
    const token = localStorage.getItem('adminToken');
    await axios.post(`${API_BASE_URL}/onboarding-tasks/mark-completed`, {
      clinicId, taskId
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchClinicsAndAssignments();
  };

  // Group tasks by category
  const tasksByCategory = categories.map(category => ({
    category,
    tasks: tasks.filter(task => task.category === category),
  }));

  const getAssignmentStatus = (a: any) => a.status || 'not_started';

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-100 font-sans">
      {/* Master Task List */}
      <div className="w-full md:w-1/2 p-6">
        <h1 className="text-2xl font-bold text-[#303b45] mb-4">Onboarding Tasks</h1>
        <div className="bg-white rounded-lg shadow-md p-4">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="py-2"></th>
                <th className="py-2">Title</th>
                <th className="py-2">Category</th>
              </tr>
            </thead>
            <tbody>
              {tasksByCategory.map(({ category, tasks }) => (
                tasks.length > 0 && (
                  <React.Fragment key={category}>
                    <tr><td colSpan={3} className="font-semibold text-[#98c6d5] py-2">{category}</td></tr>
                    {tasks.map(task => (
                      <tr key={task._id} className="border-b hover:bg-gray-50">
                        <td className="py-2">
                          <input
                            type="checkbox"
                            checked={selectedTaskIds.includes(task._id)}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedTaskIds([...selectedTaskIds, task._id]);
                              } else {
                                setSelectedTaskIds(selectedTaskIds.filter(id => id !== task._id));
                              }
                            }}
                          />
                        </td>
                        <td className="py-2 font-medium text-gray-900">{task.title}</td>
                        <td className="py-2 text-gray-700">{task.category}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                )
              ))}
            </tbody>
          </table>
          <button
            className="mt-4 px-4 py-2 bg-[#98c6d5] text-white rounded hover:bg-[#7bb3c7] disabled:opacity-50"
            disabled={selectedTaskIds.length === 0}
            onClick={() => setShowAssignModal(true)}
          >
            Assign to Clinic
          </button>
        </div>
      </div>

      {/* Right-side: Clinic Task Management */}
      <div className="w-full md:w-1/2 p-6 border-l border-gray-200 bg-white">
        <h2 className="text-xl font-bold mb-4 text-[#303b45]">Clinic Onboarding Tasks</h2>
        <div className="mb-4">
          <label className="block mb-2 font-semibold">Select Clinic:</label>
          <select
            className="w-full border p-2 rounded text-black"
            value={selectedClinic ? selectedClinic._id : ''}
            onChange={e => {
              const clinic = clinics.find(c => c._id === e.target.value) || null;
              setSelectedClinic(clinic);
            }}
          >
            <option value="">-- Choose a clinic --</option>
            {clinics.map(clinic => (
              <option key={clinic._id} value={clinic._id}>{clinic.name} ({clinic.email})</option>
            ))}
          </select>
        </div>
        {selectedClinic && (
          <div>
            <h3 className="font-semibold mb-2">Assigned Tasks</h3>
            <ul className="space-y-3">
              {clinicAssignments
                .filter(a => (typeof a.clinicId === 'string' ? a.clinicId === selectedClinic._id : a.clinicId._id === selectedClinic._id))
                .map(a => {
                  const task = typeof a.taskId === 'string' ? tasks.find(t => t._id === a.taskId) : a.taskId;
                  if (!task) return null;
                  // Status and completedAt support
                  const status = getAssignmentStatus(a);
                  const completedAt = (a as any).completedAt ? new Date((a as any).completedAt) : null;
                  let warning = '';
                  if (status === 'completed' && completedAt) {
                    const msLeft = 7 * 24 * 60 * 60 * 1000 - (Date.now() - completedAt.getTime());
                    if (msLeft > 0 && msLeft < 3 * 24 * 60 * 60 * 1000) {
                      warning = `Will disappear in ${Math.ceil(msLeft / (24 * 60 * 60 * 1000))} day(s)`;
                    }
                  }
                  return (
                    <li key={a._id} className="flex flex-col md:flex-row md:items-center gap-2 border-b pb-2">
                      <div className="flex-1">
                        <div className="font-medium text-black">{task.title}</div>
                        <div className="text-xs text-[#98c6d5]">{task.category}</div>
                      </div>
                      <select
                        className="border p-1 rounded text-black"
                        value={getAssignmentStatus(a)}
                        onChange={async e => {
                          const token = localStorage.getItem('adminToken');
                          await axios.post(`${API_BASE_URL}/onboarding-tasks/update-status`, {
                            clinicId: selectedClinic._id,
                            taskId: task._id,
                            status: e.target.value,
                          }, {
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          fetchClinicsAndAssignments();
                        }}
                      >
                        <option value="not_started">Not Started</option>
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                      </select>
                      {warning && <span className="text-xs text-orange-500 ml-2">{warning}</span>}
                      <button
                        className="ml-2 text-red-500 hover:text-red-700"
                        title="Remove from clinic"
                        onClick={async () => {
                          const token = localStorage.getItem('adminToken');
                          await axios.post(`${API_BASE_URL}/onboarding-tasks/remove-assignment`, {
                            clinicId: selectedClinic._id,
                            taskId: task._id,
                          }, {
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          fetchClinicsAndAssignments();
                        }}
                      >
                        🗑️
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}
      </div>

      {/* Modal for selecting a clinic */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Assign Tasks to Clinic</h2>
            <select
              className="w-full border p-2 rounded mb-4 text-black"
              value={selectedClinicId}
              onChange={e => setSelectedClinicId(e.target.value)}
            >
              <option value="">Select a clinic</option>
              {clinics.map(clinic => (
                <option key={clinic._id} value={clinic._id}>{clinic.name} ({clinic.email})</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-[#98c6d5] text-white rounded hover:bg-[#7bb3c7]"
                disabled={!selectedClinicId}
                onClick={async () => {
                  if (!selectedClinicId) return;
                  setShowAssignModal(false);
                  setSelectedClinicId('');
                  const token = localStorage.getItem('adminToken');
                  await axios.post(`${API_BASE_URL}/onboarding-tasks/assign`, {
                    clinicId: selectedClinicId,
                    taskIds: selectedTaskIds,
                  }, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  setSelectedTaskIds([]);
                  fetchClinicsAndAssignments();
                }}
              >Assign</button>
              <button
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                onClick={() => setShowAssignModal(false)}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnboardingTasks;
