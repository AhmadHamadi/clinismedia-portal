import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

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

const AdminTasksPage = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignedTo: '',
    dueDate: '',
    priority: 'medium',
    status: 'pending',
  });

  useEffect(() => {
    const fetchEmployeesAndTasks = async () => {
      const adminToken = localStorage.getItem('adminToken');
      if (!adminToken) {
        setError("Admin not authenticated. Please log in.");
        setLoading(false);
        navigate('/login');
        return;
      }

      try {
        // Fetch Employees
        const employeesResponse = await axios.get('http://localhost:5000/api/employees', {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        });
        setEmployees(employeesResponse.data);

        // Fetch Tasks
        const tasksResponse = await axios.get('http://localhost:5000/api/tasks', {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        });
        setTasks(tasksResponse.data);

      } catch (err: any) {
        console.error("Failed to fetch data:", err);
        setError(err.response?.data?.message || 'Failed to fetch employees or tasks.');
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeesAndTasks();
  }, [navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewTask(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      setError("Admin not authenticated.");
      navigate('/login');
      return;
    }

    try {
      const response = await axios.post('http://localhost:5000/api/tasks', newTask, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      setTasks(prev => [...prev, response.data]);
      setNewTask({
        title: '',
        description: '',
        assignedTo: '',
        dueDate: '',
        priority: 'medium',
        status: 'pending',
      });
      alert('Task created successfully!');
    } catch (err: any) {
      console.error("Failed to create task:", err);
      setError(err.response?.data?.message || 'Failed to create task.');
    }
  };

  if (loading) {
    return <div className="flex-1 p-8 text-center">Loading tasks and employees...</div>;
  }

  if (error) {
    return <div className="flex-1 p-8 text-red-500 text-center">Error: {error}</div>;
  }

  return (
    <div className="p-8 bg-gray-100 min-h-screen font-sans">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-8 tracking-tight">Manage Tasks</h1>

      {/* Create New Task Form */}
      <div className="bg-white p-8 rounded-xl shadow-lg mb-8 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4 border-gray-100">Create New Task</h2>
        <form onSubmit={handleCreateTask} className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div>
            <label htmlFor="title" className="block text-sm font-semibold text-gray-700 mb-1">Task Title</label>
            <input
              type="text"
              id="title"
              name="title"
              value={newTask.title}
              onChange={handleInputChange}
              required
              className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400 text-base"
              placeholder="Enter task title"
            />
          </div>
          <div>
            <label htmlFor="assignedTo" className="block text-sm font-semibold text-gray-700 mb-1">Assign To</label>
            <select
              id="assignedTo"
              name="assignedTo"
              value={newTask.assignedTo}
              onChange={handleInputChange}
              required
              className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-base"
            >
              <option value="">Select Employee</option>
              {employees.map(employee => (
                <option key={employee._id} value={employee._id}>
                  {employee.name} ({employee.department})
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
            <textarea
              id="description"
              name="description"
              value={newTask.description}
              onChange={handleInputChange}
              rows={4}
              className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400 text-base"
              placeholder="Describe the task"
            ></textarea>
          </div>
          <div>
            <label htmlFor="dueDate" className="block text-sm font-semibold text-gray-700 mb-1">Due Date</label>
            <input
              type="date"
              id="dueDate"
              name="dueDate"
              value={newTask.dueDate}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-base"
            />
          </div>
          <div>
            <label htmlFor="priority" className="block text-sm font-semibold text-gray-700 mb-1">Priority</label>
            <select
              id="priority"
              name="priority"
              value={newTask.priority}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-base"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="status" className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
            <select
              id="status"
              name="status"
              value={newTask.status}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-base"
            >
              <option value="pending">Pending</option>
              <option value="in-progress">In-Progress</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div className="md:col-span-2 text-right">
            <button
              type="submit"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-lg font-semibold transition duration-200 ease-in-out transform hover:scale-105"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>

      {/* Display All Tasks */}
      <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4 border-gray-100">All Tasks</h2>
        {tasks.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No tasks found. Create a new task above!</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Title</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Assigned To</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Due Date</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Priority</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Assigned By</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created At</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tasks.map(task => (
                  <tr key={task._id} className="hover:bg-gray-50 transition duration-150 ease-in-out">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{task.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{task.assignedTo.name} ({task.assignedTo.department})</td>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{task.assignedBy.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{new Date(task.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTasksPage; 