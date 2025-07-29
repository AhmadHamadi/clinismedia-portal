import { useState, useEffect, useMemo, ChangeEvent } from "react";
import axios from "axios";

export interface Employee {
  _id: string;
  name: string;
  email: string;
  username?: string;
  department?: string;
}

interface EmployeeTableRowProps {
  employee: Employee;
  onEdit: (employee: Employee) => void;
  onDelete: (id: string) => void;
  onView: (employee: Employee) => void;
}

export const EmployeeTableRow: React.FC<EmployeeTableRowProps> = ({
  employee,
  onEdit,
  onDelete,
  onView,
}) => (
  <tr className="border-b hover:bg-gray-50 transition">
    <td className="p-6 text-black">{employee.name}</td>
    <td className="p-6 text-black">{employee.username || '-'}</td>
    <td className="p-6 text-black">{employee.email}</td>
    <td className="p-6 text-black">{employee.department || '-'}</td>
    <td className="p-6">
      <button className="text-[#98c6d5] hover:underline mr-4" onClick={() => onView(employee)}>
        View
      </button>
      <button className="text-blue-600 hover:underline mr-4" onClick={() => onEdit(employee)}>
        Edit
      </button>
      <button className="text-red-600 hover:underline" onClick={() => onDelete(employee._id)}>
        Delete
      </button>
    </td>
  </tr>
);

export function useEmployeeManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    department: "",
  });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    _id: "",
    name: "",
    username: "",
    email: "",
    password: "",
    department: "",
  });

  const departments = ["photography", "web", "social"];

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmployees(res.data);
    } catch (err) {
      console.error("❌ Failed to fetch employees", err);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.name.trim() || !formData.username.trim() || !formData.email.trim() || !formData.password || !formData.department) {
      alert("All fields are required.");
      return false;
    }
    if (!emailRegex.test(formData.email)) {
      alert("Please enter a valid email address.");
      return false;
    }
    return true;
  };

  const handleAddEmployee = async () => {
    if (!validateForm()) return;
    try {
      const token = localStorage.getItem('adminToken');
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/employees`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowModal(false);
      setFormData({ name: "", username: "", email: "", password: "", department: "" });
      fetchEmployees();
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.error) {
        alert(err.response.data.error);
      } else {
        alert("Failed to add employee.");
      }
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this employee?")) return;
    try {
      const token = localStorage.getItem('adminToken');
      await axios.delete(`${import.meta.env.VITE_API_BASE_URL}/employees/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmployees((prev) => prev.filter((emp) => emp._id !== id));
    } catch (err) {
      console.error("❌ Failed to delete employee", err);
    }
  };

  const handleViewEmployee = (employee: Employee) => {
    alert(`Employee Details:\n\nName: ${employee.name}\nUsername: ${employee.username || 'N/A'}\nEmail: ${employee.email}\nDepartment: ${employee.department || 'N/A'}`);
  };

  const handleEditClick = (employee: Employee) => {
    setEditFormData({
      _id: employee._id,
      name: employee.name,
      username: employee.username || "",
      email: employee.email,
      password: "",
      department: employee.department || "",
    });
    setEditModalOpen(true);
  };

  const handleEditInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm("Are you sure you want to save these changes?")) return;
    try {
      const token = localStorage.getItem('adminToken');
      await axios.put(`${import.meta.env.VITE_API_BASE_URL}/employees/${editFormData._id}`, editFormData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEditModalOpen(false);
      fetchEmployees();
    } catch (err: any) {
      console.error("❌ Failed to update employee", err);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const filteredEmployees = useMemo(() =>
    employees.filter((emp) =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.department && emp.department.toLowerCase().includes(searchTerm.toLowerCase()))
    ),
    [employees, searchTerm]
  );

  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredEmployees.slice(startIndex, startIndex + pageSize);
  }, [filteredEmployees, currentPage]);

  const totalPages = Math.ceil(filteredEmployees.length / pageSize);

  return {
    employees,
    setEmployees,
    showModal,
    setShowModal,
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    pageSize,
    formData,
    setFormData,
    editModalOpen,
    setEditModalOpen,
    editFormData,
    setEditFormData,
    departments,
    fetchEmployees,
    handleInputChange,
    validateForm,
    handleAddEmployee,
    handleDeleteEmployee,
    handleViewEmployee,
    handleEditClick,
    handleEditInputChange,
    handleEditSubmit,
    filteredEmployees,
    paginatedEmployees,
    totalPages,
  };
}