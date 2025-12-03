import { useState, useEffect } from 'react';
import axios from 'axios';
import { FaCheckCircle, FaSpinner, FaExclamationTriangle, FaClipboardList } from 'react-icons/fa';

const CustomerOnboardingTasks: React.FC = () => {
  const [assignedTasks, setAssignedTasks] = useState<any[]>([]);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    const fetchAssignedTasks = async () => {
      setLoading(true);
      const token = localStorage.getItem('customerToken');
      const userStr = localStorage.getItem('customerData');
      if (!userStr) {
        console.error('No customer data found in localStorage');
        setLoading(false);
        return;
      }
      const user = JSON.parse(userStr);
      const clinicId = user.id || user._id;
      console.log('Fetching tasks for clinic:', clinicId);
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/onboarding-tasks/assigned/${clinicId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Received assigned tasks:', res.data);
        setAssignedTasks(res.data);
        setCompletedTasks(res.data.filter((a: any) => a.completed).map((a: any) => a.taskId._id));
        setCategories([...new Set(res.data.map((a: any) => a.taskId.category).filter(Boolean))] as string[]);
      } catch (err) {
        console.error('Error fetching assigned tasks:', err);
        setAssignedTasks([]);
        setCompletedTasks([]);
        setCategories([]);
      }
      setLoading(false);
    };
    fetchAssignedTasks();
  }, []);

  const tasksByCategory = categories.map(category => ({
    category,
    tasks: assignedTasks.filter(task => task.taskId.category === category),
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading onboarding tasks...</p>
        </div>
      </div>
    );
  }

  if (assignedTasks.length === 0) {
    return (
      <div className="p-4 sm:p-6 md:p-8 overflow-x-hidden w-full max-w-6xl xl:max-w-7xl 2xl:max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center mb-2">
            <FaClipboardList className="mr-3 text-blue-600" />
            Your Onboarding Checklist
          </h1>
          <p className="text-gray-600">
            Track your onboarding progress and complete assigned tasks
          </p>
        </div>

        {/* Empty State Card */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <FaClipboardList className="text-6xl text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Tasks Assigned</h3>
              <p className="text-gray-600">No onboarding tasks have been assigned to you yet. Please contact your administrator.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 overflow-x-hidden w-full max-w-6xl xl:max-w-7xl 2xl:max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center mb-2">
          <FaClipboardList className="mr-3 text-blue-600" />
          Your Onboarding Checklist
        </h1>
        <p className="text-gray-600">
          Track your onboarding progress and complete assigned tasks
        </p>
      </div>

      {/* Tasks by Category */}
      {tasksByCategory.map(({ category, tasks }) => (
        tasks.length > 0 && (
          <div key={category} className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="bg-blue-100 p-2 rounded-lg mr-3">
                <FaCheckCircle className="text-blue-600" />
              </span>
              {category}
            </h3>
            <ul className="space-y-3">
              {tasks.map((assignment: any) => {
                const task = assignment.taskId;
                if (!task) return null;
                const status = assignment.status || 'not_started';
                let statusColor = 'text-blue-600';
                let statusBgColor = 'bg-blue-100';
                if (status === 'pending') {
                  statusColor = 'text-orange-600';
                  statusBgColor = 'bg-orange-100';
                }
                if (status === 'completed') {
                  statusColor = 'text-green-600';
                  statusBgColor = 'bg-green-100';
                }
                return (
                  <li key={task._id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <input 
                      type="checkbox" 
                      checked={status === 'completed'} 
                      readOnly 
                      className="w-5 h-5 accent-blue-600 cursor-not-allowed" 
                    />
                    <span className={`flex-1 ${status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900 font-medium'}`}>
                      {task.title}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBgColor} ${statusColor}`}>
                      {status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )
      ))}
    </div>
  );
};

export default CustomerOnboardingTasks; 