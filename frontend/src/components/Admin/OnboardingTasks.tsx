// src/components/Admin/OnboardingTasksPage.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaPlus, FaEdit, FaTrash, FaCheck, FaTimes, FaEnvelope, FaClipboardList, FaUsers } from 'react-icons/fa';

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

  // Email notification state
  const [selectedEmailClinic, setSelectedEmailClinic] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState('Onboarding Task Update');
  const [emailBody, setEmailBody] = useState('Hi {clinicName},\n\nThis is an update regarding your onboarding tasks.\n\nBest regards,\nCliniMedia Team');
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Fetch tasks from backend and group by category
  const [categories, setCategories] = useState<string[]>([]);

  const fetchTasks = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/onboarding-tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Fetched onboarding tasks:', res.data);
      setTasks(res.data);
      setCategories([...new Set(res.data.map((t: any) => String(t.category)).filter(Boolean))] as string[]);
    } catch (err) {
      console.error("❌ Failed to fetch onboarding tasks", err);
    }
  };

  // Fetch clinics and assignments
  const fetchClinicsAndAssignments = async () => {
    const token = localStorage.getItem('adminToken');
    console.log('Fetching clinics and assignments with token:', token ? 'present' : 'missing');
    
    try {
      // Fetch clinics (customers)
      const clinicsRes = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Fetched clinics:', clinicsRes.data);
      setClinics(clinicsRes.data);
      
      // Fetch assignments
      const assignmentsRes = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/onboarding-tasks/assignments/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Fetched assignments:', assignmentsRes.data);
      setClinicAssignments(assignmentsRes.data.assignments);
    } catch (error) {
      console.error('Error fetching clinics and assignments:', error);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchClinicsAndAssignments();
  }, []);

  // Add new task
  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    const token = localStorage.getItem('adminToken');
    await axios.post(`${import.meta.env.VITE_API_BASE_URL}/onboarding-tasks`, newTask, {
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
    await axios.put(`${import.meta.env.VITE_API_BASE_URL}/onboarding-tasks/${editTask._id}`, editTask, {
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
    await axios.delete(`${import.meta.env.VITE_API_BASE_URL}/onboarding-tasks/${id}`, {
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
    await axios.post(`${import.meta.env.VITE_API_BASE_URL}/onboarding-tasks/assign`, {
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
    await axios.post(`${import.meta.env.VITE_API_BASE_URL}/onboarding-tasks/mark-completed`, {
      clinicId, taskId
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchClinicsAndAssignments();
  };

  // Send email notification
  const handleSendEmail = async () => {
    if (!selectedEmailClinic) {
      alert('Please select a clinic first');
      return;
    }

    const selectedClinicData = clinics.find(c => c._id === selectedEmailClinic);
    if (!selectedClinicData) {
      alert('Selected clinic not found');
      return;
    }

    // Replace clinic name in email body
    const emailBodyWithClinic = emailBody.replace('{clinicName}', selectedClinicData.name);

    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/email-notification-settings/send-custom`, {
        clinicId: selectedEmailClinic,
        subject: emailSubject,
        body: emailBodyWithClinic,
        clinicEmail: selectedClinicData.email
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      alert(`✅ Email sent successfully to ${selectedClinicData.name}`);
      setShowEmailModal(false);
    } catch (error: any) {
      alert(`❌ Failed to send email: ${error.response?.data?.message || 'Unknown error'}`);
    }
  };

  // Group tasks by category
  const tasksByCategory = categories.map(category => ({
    category,
    tasks: tasks.filter(task => task.category === category),
  }));

  const getAssignmentStatus = (a: any) => a.status || 'not_started';

  return (
    <div className="p-4 sm:p-6 md:p-8 overflow-x-hidden w-full max-w-6xl xl:max-w-7xl 2xl:max-w-7xl mx-auto">
      {/* Email Notification Section - At Top */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <FaEnvelope className="mr-3 text-blue-600" />
            Email Notifications
          </h2>
          <button
            onClick={() => setShowEmailModal(true)}
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FaEnvelope className="mr-2" />
            Send Email
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-2">Quick Email</h3>
            <p className="text-sm text-gray-700 mb-2">Send custom emails to clinics</p>
            <div className="text-xs text-gray-600">
              <div>Subject: {emailSubject}</div>
              <div>Template: Custom</div>
            </div>
          </div>
        </div>
      </div>

      {/* Master Task List - Now Below Email Section */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
          <FaClipboardList className="mr-3 text-blue-600" />
          Onboarding Tasks
        </h1>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
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
            className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={selectedTaskIds.length === 0}
            onClick={() => setShowAssignModal(true)}
          >
            Assign to Clinic
          </button>

          {/* New Task Creation Form - moved here */}
          <div className="mt-8 border-t border-gray-200 pt-6">
            <h2 className="text-lg font-bold mb-4 text-gray-900">Create New Task</h2>
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Task Title</label>
                <input
                  type="text"
                  placeholder="Enter task title"
                  value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="md:w-48">
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={newTask.category}
                  onChange={e => setNewTask({ ...newTask, category: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">-- Select Category --</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="__new__">+ New Category</option>
                </select>
              </div>
              {newTask.category === "__new__" && (
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Category Name</label>
                  <input
                    type="text"
                    placeholder="Enter new category name"
                    value={newTask.description || ''}
                    onChange={e => setNewTask({ ...newTask, category: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              )}
              <button
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleAddTask}
                disabled={!newTask.title.trim() || (!newTask.category || newTask.category === "__new__")}
              >
                Add Task
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Clinic Onboarding Tasks - Now Below */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-900 flex items-center">
          <FaUsers className="mr-3 text-blue-600" />
          Clinic Onboarding Tasks
        </h2>
        <div className="mb-6">
          <label className="block mb-2 font-semibold text-gray-700">Select Clinic:</label>
          <select
            className="w-full border border-gray-300 p-3 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
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
            <h3 className="font-semibold mb-4 text-gray-900">Assigned Tasks</h3>
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
                    <li key={a._id} className="flex flex-col md:flex-row md:items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{task.title}</div>
                        <div className="text-xs text-gray-600 mt-1">{task.category}</div>
                      </div>
                      <select
                        className="border border-gray-300 p-2 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        value={getAssignmentStatus(a)}
                        onChange={async e => {
                          const token = localStorage.getItem('adminToken');
                          await axios.post(`${import.meta.env.VITE_API_BASE_URL}/onboarding-tasks/update-status`, {
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
                      {warning && <span className="text-xs text-orange-600 px-2 py-1 bg-orange-50 rounded">{warning}</span>}
                      <button
                        className="px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove from clinic"
                        onClick={async () => {
                          const token = localStorage.getItem('adminToken');
                          await axios.post(`${import.meta.env.VITE_API_BASE_URL}/onboarding-tasks/remove-assignment`, {
                            clinicId: selectedClinic._id,
                            taskId: task._id,
                          }, {
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          fetchClinicsAndAssignments();
                        }}
                      >
                        <FaTrash />
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-black">Send Email Notification</h2>
              <button
                onClick={() => setShowEmailModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-black">Select Clinic:</label>
                <select
                  value={selectedEmailClinic}
                  onChange={(e) => setSelectedEmailClinic(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
                >
                  <option value="">Choose a clinic...</option>
                  {clinics.map(clinic => (
                    <option key={clinic._id} value={clinic._id}>
                      {clinic.name} ({clinic.email})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-black">Email Subject:</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
                  placeholder="Enter email subject..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-black">Email Body:</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={8}
                  className="w-full p-3 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
                  placeholder="Enter email body... Use {clinicName} to insert clinic name"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Available variables: {'{clinicName}'} (will be replaced with selected clinic name)
                </p>
              </div>
              
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={!selectedEmailClinic}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send Email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal for selecting a clinic */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Assign Tasks to Clinic</h2>
            <select
              className="w-full border border-gray-300 p-3 rounded-lg mb-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!selectedClinicId}
                onClick={async () => {
                  if (!selectedClinicId) return;
                  setShowAssignModal(false);
                  setSelectedClinicId('');
                  const token = localStorage.getItem('adminToken');
                  console.log('Assigning tasks:', { clinicId: selectedClinicId, taskIds: selectedTaskIds });
                  try {
                    const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/onboarding-tasks/assign`, {
                      clinicId: selectedClinicId,
                      taskIds: selectedTaskIds,
                    }, {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    console.log('Assignment response:', response.data);
                    setSelectedTaskIds([]);
                    fetchClinicsAndAssignments();
                  } catch (error) {
                    console.error('Error assigning tasks:', error);
                  }
                }}
              >Assign</button>
              <button
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
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
