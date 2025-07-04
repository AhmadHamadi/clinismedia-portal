import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../utils/api';

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
        const res = await axios.get(`${API_BASE_URL}/onboarding-tasks/assigned/${clinicId}`, {
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

  if (loading) return <div className="p-6 text-gray-600">Loading onboarding tasks...</div>;
  if (assignedTasks.length === 0) return <div className="p-6 text-gray-600">No onboarding tasks assigned yet.</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#303b45] mb-4">Your Onboarding Checklist</h1>
      {tasksByCategory.map(({ category, tasks }) => (
        tasks.length > 0 && (
          <div key={category} className="mb-6">
            <div className="font-semibold text-gray-700 mb-2">{category}</div>
            <ul className="space-y-2">
              {tasks.map((assignment: any) => {
                const task = assignment.taskId;
                if (!task) return null;
                const status = assignment.status || 'not_started';
                let statusColor = 'text-[#98c6d5]';
                if (status === 'pending') statusColor = 'text-orange-500';
                if (status === 'completed') statusColor = 'text-green-600';
                return (
                  <li key={task._id} className="flex items-center gap-2">
                    <input type="checkbox" checked={status === 'completed'} readOnly className="accent-[#98c6d5]" />
                    <span className={
                      `${status === 'completed' ? 'line-through text-gray-400' : 'text-black'}`
                    }>{task.title}</span>
                    <span className={`ml-2 font-semibold ${statusColor}`}>{status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</span>
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