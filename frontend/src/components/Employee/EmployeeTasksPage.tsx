import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../utils/api';

interface Employee {
  _id: string;
  name: string;
  email: string;
  department: string;
}

interface Task {
  _id: string;
  title: string;
  description?: string;
  assignedTo: Employee;
  assignedBy: { _id: string; name: string };
  dueDate?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

const EmployeeTasksPage = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEmployeeTasks = async () => {
      const employeeToken = localStorage.getItem('employeeToken');
      const employeeData = localStorage.getItem('employeeData');

      if (!employeeToken || !employeeData) {
        setError("Employee not authenticated. Please log in.");
        setLoading(false);
        navigate('/login');
        return;
      }

      try {
        const parsedEmployeeData = JSON.parse(employeeData);
        const employeeId = parsedEmployeeData._id;

        const tasksResponse = await axios.get(`${API_BASE_URL}/tasks/employee/${employeeId}`, {
          headers: {
            Authorization: `Bearer ${employeeToken}`,
          },
        });
        setTasks(tasksResponse.data);

      } catch (err: any) {
        console.error("Failed to fetch employee tasks:", err);
        setError(err.response?.data?.message || 'Failed to fetch tasks.');
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeeTasks();
  }, [navigate]);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    const employeeToken = localStorage.getItem('employeeToken');
    if (!employeeToken) {
      setError("Employee not authenticated.");
      navigate('/login');
      return;
    }

    try {
      const response = await axios.put(`${API_BASE_URL}/tasks/${taskId}/status`, { status: newStatus }, {
        headers: {
          Authorization: `Bearer ${employeeToken}`,
        },
      });

      // Update the task in the local state
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task._id === taskId ? { ...task, status: response.data.status } : task
        )
      );
      alert('Task status updated successfully!');
    } catch (err: any) {
      console.error("Failed to update task status:", err);
      setError(err.response?.data?.message || 'Failed to update task status.');
    }
  };

  if (loading) {
    return <div className="flex-1 p-8 text-center">Loading tasks...</div>;
  }

  if (error) {
    return <div className="flex-1 p-8 text-red-500 text-center">Error: {error}</div>;
  }

  return (
    <div className="flex-1 p-8 bg-gray-100 min-h-screen font-sans">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-8 tracking-tight">My Assigned Tasks</h1>

      {tasks.length === 0 ? (
        <p className="text-gray-600 text-center py-8">No tasks assigned to you. Keep up the great work!</p>
      ) : (
        <div className="overflow-x-auto rounded-lg shadow-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 bg-white">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Title</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Assigned By</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Due Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Priority</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tasks.map(task => (
                <tr key={task._id} className="hover:bg-gray-50 transition duration-150 ease-in-out">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{task.title}</td>
                  <td className="px-6 py-4 whitespace-normal text-sm text-gray-700">{task.description || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{task.assignedBy.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      task.status === 'completed' ? 'bg-green-100 text-green-800' :
                      task.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                      task.status === 'overdue' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      task.priority === 'high' ? 'bg-red-100 text-red-800' :
                      task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task._id, e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm"
                    >
                      <option value="pending">Pending</option>
                      <option value="in-progress">In-Progress</option>
                      <option value="completed">Completed</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EmployeeTasksPage; 