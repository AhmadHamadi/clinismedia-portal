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

export interface Receptionist {
  _id: string;
  name: string;
  username: string;
  email: string;
  canBookMediaDay?: boolean;
  createdAt?: string;
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
    bookingIntervalMonths: 1, // Default to monthly (12 times per year)
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
  const [receptionists, setReceptionists] = useState<Receptionist[]>([]);
  const [addReceptionistModal, setAddReceptionistModal] = useState(false);
  const [receptionistForm, setReceptionistForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    canBookMediaDay: false,
  });
  const [editReceptionistModal, setEditReceptionistModal] = useState(false);
  const [editingReceptionist, setEditingReceptionist] = useState<Receptionist | null>(null);
  const [editReceptionistForm, setEditReceptionistForm] = useState({
    name: "",
    username: "",
    email: "",
    canBookMediaDay: false,
    password: "",
  });

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomers(res.data);
    } catch (err) {
      console.error("❌ Failed to fetch customers", err);
    }
  };

  const fetchReceptionists = async (customerId: string) => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/customers/${customerId}/receptionists`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReceptionists(res.data || []);
    } catch (err) {
      console.error("❌ Failed to fetch receptionists", err);
      setReceptionists([]);
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
      `Media Days per Year: ${customer.bookingIntervalMonths || 1} (${customer.bookingIntervalMonths === 1 ? 'monthly' : customer.bookingIntervalMonths === 2 ? 'every 6 months' : customer.bookingIntervalMonths === 3 ? 'every 4 months' : customer.bookingIntervalMonths === 4 ? 'every 3 months' : customer.bookingIntervalMonths === 6 ? 'every 2 months' : 'N/A'})`,
      `Customer ID: ${customer._id}`,
    ].join('\n\n');
    
    alert(`Customer Details:\n\n${details}`);
  };

  const handleEditClick = (customer: Customer) => {
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
    setEditModalOpen(true);
    fetchReceptionists(customer._id);
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
      await axios.put(`${import.meta.env.VITE_API_BASE_URL}/customers/${editFormData._id}`, editFormData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEditModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      console.error('Edit submission error:', err);
    }
  };

  const handleAddReceptionist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receptionistForm.name?.trim() || !receptionistForm.username?.trim() || !receptionistForm.email?.trim() || !receptionistForm.password) {
      alert("Name, username, email, and password are required.");
      return;
    }
    try {
      const token = localStorage.getItem('adminToken');
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/customers/${editFormData._id}/receptionists`, {
        name: receptionistForm.name.trim(),
        username: receptionistForm.username.trim(),
        email: receptionistForm.email.trim(),
        password: receptionistForm.password,
        canBookMediaDay: !!receptionistForm.canBookMediaDay,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setAddReceptionistModal(false);
      setReceptionistForm({ name: "", username: "", email: "", password: "", canBookMediaDay: false });
      fetchReceptionists(editFormData._id);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to add receptionist.");
    }
  };

  const handleRemoveReceptionist = async (receptionistId: string) => {
    if (!window.confirm("Remove this receptionist? They will lose access immediately.")) return;
    try {
      const token = localStorage.getItem('adminToken');
      await axios.delete(`${import.meta.env.VITE_API_BASE_URL}/customers/${editFormData._id}/receptionists/${receptionistId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchReceptionists(editFormData._id);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to remove receptionist.");
    }
  };

  const handleEditReceptionistClick = (r: Receptionist) => {
    setEditingReceptionist(r);
    setEditReceptionistForm({ name: r.name, username: r.username, email: r.email, canBookMediaDay: !!r.canBookMediaDay, password: "" });
    setEditReceptionistModal(true);
  };

  const handleEditReceptionistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReceptionist) return;
    try {
      const token = localStorage.getItem('adminToken');
      const body: Record<string, unknown> = {
        name: editReceptionistForm.name,
        username: editReceptionistForm.username,
        email: editReceptionistForm.email,
        canBookMediaDay: !!editReceptionistForm.canBookMediaDay,
      };
      if (editReceptionistForm.password && String(editReceptionistForm.password).trim() !== '') {
        body.password = editReceptionistForm.password;
      }
      await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL}/customers/${editFormData._id}/receptionists/${editingReceptionist._id}`,
        body,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEditReceptionistModal(false);
      setEditingReceptionist(null);
      fetchReceptionists(editFormData._id);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to update receptionist.");
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
    receptionists,
    addReceptionistModal,
    setAddReceptionistModal,
    receptionistForm,
    setReceptionistForm,
    handleAddReceptionist,
    handleRemoveReceptionist,
    editReceptionistModal,
    setEditReceptionistModal,
    editingReceptionist,
    setEditingReceptionist,
    editReceptionistForm,
    setEditReceptionistForm,
    handleEditReceptionistClick,
    handleEditReceptionistSubmit,
  };
}
