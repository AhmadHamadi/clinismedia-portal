import { useState, useEffect, useMemo, ChangeEvent } from "react";
import axios from "axios";
import { API_BASE_URL } from '../../../utils/api';

// Example: If you have a CustomerTableRow component
export interface Customer {
  _id: string;
  name: string;
  email: string;
  username?: string;
}

interface CustomerTableRowProps {
  customer: Customer;
  onEdit: (customer: Customer) => void;
  onDelete: (id: string) => void;
  onView: (customer: Customer) => void;
}

export const CustomerTableRow: React.FC<CustomerTableRowProps> = ({
  customer,
  onEdit,
  onDelete,
  onView,
}) => (
  <tr className="border-b hover:bg-gray-50 transition">
    <td className="p-6 text-black">{customer.name}</td>
    <td className="p-6 text-black">{customer.username || '-'}</td>
    <td className="p-6 text-black">{customer.email}</td>
    <td className="p-6">
      <button className="text-[#98c6d5] hover:underline mr-4" onClick={() => onView(customer)}>
        View
      </button>
      <button className="text-blue-600 hover:underline mr-4" onClick={() => onEdit(customer)}>
        Edit
      </button>
      <button className="text-red-600 hover:underline" onClick={() => onDelete(customer._id)}>
        Delete
      </button>
    </td>
  </tr>
);

export function useCustomerManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
  });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    _id: "",
    name: "",
    username: "",
    email: "",
    password: "",
  });

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/customers`);
      setCustomers(res.data);
    } catch (err) {
      console.error("❌ Failed to fetch customers", err);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.name.trim() || !formData.username.trim() || !formData.email.trim() || !formData.password) {
      alert("All fields are required.");
      return false;
    }
    if (!emailRegex.test(formData.email)) {
      alert("Please enter a valid email address.");
      return false;
    }
    return true;
  };

  const handleAddCustomer = async () => {
    if (!validateForm()) return;
    try {
      await axios.post(`${API_BASE_URL}/customers`, { ...formData });
      setShowModal(false);
      setFormData({ name: "", username: "", email: "", password: "" });
      fetchCustomers();
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.error) {
        alert(err.response.data.error);
      } else {
        alert("Failed to add customer.");
      }
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this customer?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/customers/${id}`);
      setCustomers((prev) => prev.filter((cust) => cust._id !== id));
    } catch (err) {
      console.error("❌ Failed to delete customer", err);
    }
  };

  const handleViewCustomer = (customer: Customer) => {
    alert(`Customer Details:\n\nName: ${customer.name}\nUsername: ${customer.username || 'N/A'}\nEmail: ${customer.email}`);
  };

  const handleEditClick = (customer: Customer) => {
    setEditFormData({
      _id: customer._id,
      name: customer.name,
      username: customer.username || "",
      email: customer.email,
      password: "",
    });
    setEditModalOpen(true);
  };

  const handleEditInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm("Are you sure you want to save these changes?")) return;
    try {
      await axios.put(`${API_BASE_URL}/customers/${editFormData._id}`, editFormData);
      setEditModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      alert("Failed to update customer.");
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filteredCustomers = useMemo(() =>
    customers.filter((cust) =>
      cust.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cust.email.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [customers, searchTerm]
  );

  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(startIndex, startIndex + pageSize);
  }, [filteredCustomers, currentPage]);

  const totalPages = Math.ceil(filteredCustomers.length / pageSize);

  return {
    customers,
    setCustomers,
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
    fetchCustomers,
    handleInputChange,
    validateForm,
    handleAddCustomer,
    handleDeleteCustomer,
    handleViewCustomer,
    handleEditClick,
    handleEditInputChange,
    handleEditSubmit,
    filteredCustomers,
    paginatedCustomers,
    totalPages,
  };
}
