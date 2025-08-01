import { useState, useEffect, useMemo, ChangeEvent } from "react";
import axios from "axios";

// Example: If you have a CustomerTableRow component
export interface Customer {
  _id: string;
  name: string;
  email: string;
  username?: string;
  location?: string;
  address?: string;
  bookingIntervalMonths?: number;
  customerSettings?: {
    displayName?: string;
  };
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
    <td className="p-6 text-black">{customer.location || '-'}</td>
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
    location: "",
    address: "",
    bookingIntervalMonths: 1,
  });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    _id: "",
    name: "",
    username: "",
    email: "",
    password: "",
    location: "",
    address: "",
    bookingIntervalMonths: 1,
  });

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Fetched customers data:', res.data);
      setCustomers(res.data);
    } catch (err) {
      console.error("❌ Failed to fetch customers", err);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: name === 'bookingIntervalMonths' ? Number(value) : value });
  };

  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.name.trim() || !formData.username.trim() || !formData.email.trim() || !formData.password || !formData.location.trim()) {
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
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/customers`, { ...formData });
      setShowModal(false);
      setFormData({ name: "", username: "", email: "", password: "", location: "", address: "", bookingIntervalMonths: 1 });
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
      const token = localStorage.getItem('adminToken');
      await axios.delete(`${import.meta.env.VITE_API_BASE_URL}/customers/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomers((prev) => prev.filter((cust) => cust._id !== id));
    } catch (err) {
      console.error("❌ Failed to delete customer", err);
    }
  };

  const handleViewCustomer = (customer: Customer) => {
    const details = [
      `Name: ${customer.name}`,
      `Username: ${customer.username || 'N/A'}`,
      `Email: ${customer.email}`,
      `Location: ${customer.location || 'N/A'}`,
      `Address: ${customer.address || 'N/A'}`,
      `Booking Interval: ${customer.bookingIntervalMonths || 1} month(s)`,
      `Customer ID: ${customer._id}`,
    ].join('\n\n');
    
    alert(`Customer Details:\n\n${details}`);
  };

  const handleEditClick = (customer: Customer) => {
    console.log('Editing customer data:', customer);
    setEditFormData({
      _id: customer._id,
      name: customer.name,
      username: customer.username || "",
      email: customer.email,
      password: "",
      location: customer.location || "",
      address: customer.address || "",
      bookingIntervalMonths: customer.bookingIntervalMonths || 1,
    });
    console.log('Set edit form data:', {
      _id: customer._id,
      name: customer.name,
      username: customer.username || "",
      email: customer.email,
      password: "",
      location: customer.location || "",
      address: customer.address || "",
      bookingIntervalMonths: customer.bookingIntervalMonths || 1,
    });
    setEditModalOpen(true);
  };

  const handleEditInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditFormData({ ...editFormData, [name]: name === 'bookingIntervalMonths' ? Number(value) : value });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm("Are you sure you want to save these changes?")) return;
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.put(`${import.meta.env.VITE_API_BASE_URL}/customers/${editFormData._id}`, editFormData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEditModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      console.error('Edit submission error:', err);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filteredCustomers = useMemo(() =>
    customers.filter((cust) =>
      cust.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cust.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cust.location && cust.location.toLowerCase().includes(searchTerm.toLowerCase()))
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
