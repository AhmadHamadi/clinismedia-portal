// src/components/Admin/CustomerManagement/CustomerManagementPage.tsx
import React from "react";
import { useCustomerManagement, CustomerTableRow } from "./CustomerManagementLogic";
import { API_BASE_URL, BACKEND_BASE_URL } from '../../../utils/api';

const CustomerManagementPage = () => {
  const {
    showModal,
    setShowModal,
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    formData,
    setFormData,
    editModalOpen,
    setEditModalOpen,
    editFormData,
    setEditFormData,
    handleInputChange,
    handleAddCustomer,
    handleDeleteCustomer,
    handleViewCustomer,
    handleEditClick,
    handleEditInputChange,
    handleEditSubmit,
    paginatedCustomers,
    totalPages,
  } = useCustomerManagement();

  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [editLogoFile, setEditLogoFile] = React.useState<File | null>(null);

  const validateForm = () => {
    if (!formData.name || !formData.username || !formData.email || !formData.password) {
      alert("Please fill in all required fields.");
      return false;
    }
    return true;
  };

  const fetchCustomers = async () => {
    // This function is not directly managed by useCustomerManagement,
    // so we need to call it here or pass it down.
    // For now, we'll assume it's handled by the backend or a separate logic.
    // If it's meant to be part of useCustomerManagement, it should be added there.
    // For now, we'll just re-fetch on modal close/open.
  };

  return (
    <div className="min-h-screen flex bg-gray-100 font-sans w-full">
      <div className="flex-1 p-6 max-w-full">
        <div className="max-w-6xl mx-auto bg-white rounded-lg p-6 shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-extrabold text-gray-900">Customer Management</h1>
            <button
              onClick={() => setShowModal(true)}
              className="bg-[#98c6d5] hover:bg-blue-700 text-white px-5 py-2 rounded-lg transition"
            >
              Add Customer
            </button>
          </div>

          <input
            type="text"
            placeholder="Search customers..."
            className="w-full mb-6 p-4 rounded-lg border border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse table-auto">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-6 text-left font-semibold text-gray-700">Logo</th>
                  <th className="p-6 text-left font-semibold text-gray-700">Name</th>
                  <th className="p-6 text-left font-semibold text-black">Username</th>
                  <th className="p-6 text-left font-semibold text-black">Email</th>
                  <th className="p-6 text-left font-semibold text-black">Location</th>
                  <th className="p-6 text-left font-semibold text-black">Address</th>
                  <th className="p-6 text-left font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">No customers found.</td>
                  </tr>
                ) : (
                  paginatedCustomers.map((customer) => (
                    <tr key={customer._id} className="border-b hover:bg-gray-50 transition">
                      <td className="p-6">
                        {customer.customerSettings?.logoUrl ? (
                          <img src={BACKEND_BASE_URL + customer.customerSettings.logoUrl} alt="Logo" className="w-10 h-10 rounded-full object-cover border" />
                        ) : (
                          <span className="inline-block w-10 h-10 rounded-full bg-gray-200" />
                        )}
                      </td>
                      <td className="p-6 text-black">{customer.name}</td>
                      <td className="p-6 text-black">{customer.username || '-'}</td>
                      <td className="p-6 text-black">{customer.email}</td>
                      <td className="p-6 text-black">{customer.location || '-'}</td>
                      <td className="p-6 text-black">{customer.address || '-'}</td>
                      <td className="p-6">
                        <button className="text-[#98c6d5] hover:underline mr-4" onClick={() => handleViewCustomer(customer)}>
                          View
                        </button>
                        <button className="text-blue-600 hover:underline mr-4" onClick={() => handleEditClick(customer)}>
                          Edit
                        </button>
                        <button className="text-red-600 hover:underline" onClick={() => handleDeleteCustomer(customer._id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center mt-6 space-x-3">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-200 disabled:opacity-50"
              >
                Prev
              </button>
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-4 py-2 rounded border border-gray-300 hover:bg-gray-200
                      ${pageNum === currentPage ? "bg-[#98c6d5] text-white" : ""}
                    `}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-200 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}

          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-lg">
                <h2 className="text-2xl font-semibold mb-4">Add New Customer</h2>
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleAddCustomer();
                  }}
                >
                  <input
                    type="text"
                    name="name"
                    placeholder="Customer Name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
                  />
                  <input
                    type="text"
                    name="username"
                    placeholder="Username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
                  />
                  <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
                  />
                  <input
                    type="text"
                    name="location"
                    placeholder="Location"
                    value={formData.location}
                    onChange={handleInputChange}
                    className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
                  />
                  <input
                    type="text"
                    name="address"
                    placeholder="Exact Address"
                    value={formData.address || ''}
                    onChange={handleInputChange}
                    className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
                  />
                  <input
                    type="password"
                    name="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
                  />
                  <select
                    name="bookingIntervalMonths"
                    value={formData.bookingIntervalMonths || 1}
                    onChange={handleInputChange}
                    className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black"
                  >
                    <option value={1}>Monthly Booking</option>
                    <option value={3}>Quarterly Booking</option>
                  </select>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => setLogoFile(e.target.files?.[0] || null)}
                    className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black"
                  />
                  <div className="flex justify-end space-x-4">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-6 py-2 rounded-lg border border-gray-400 hover:bg-gray-100 text-black"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 rounded-lg bg-[#98c6d5] text-white hover:bg-blue-700"
                    >
                      Add Customer
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {editModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-lg">
                <h2 className="text-2xl font-semibold mb-4">Edit Customer</h2>
                <form onSubmit={handleEditSubmit}>
                  <input
                    type="text"
                    name="name"
                    placeholder="Customer Name"
                    value={editFormData.name}
                    onChange={handleEditInputChange}
                    className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black"
                  />
                  <input
                    type="text"
                    name="username"
                    placeholder="Username"
                    value={editFormData.username}
                    onChange={handleEditInputChange}
                    className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black"
                  />
                  <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={editFormData.email}
                    onChange={handleEditInputChange}
                    className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black"
                  />
                  <input
                    type="text"
                    name="location"
                    placeholder="Location"
                    value={editFormData.location}
                    onChange={handleEditInputChange}
                    className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black"
                  />
                  <input
                    type="text"
                    name="address"
                    placeholder="Exact Address"
                    value={editFormData.address || ''}
                    onChange={handleEditInputChange}
                    className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black"
                  />
                  <input
                    type="password"
                    name="password"
                    placeholder="Password (leave blank to keep current)"
                    value={editFormData.password}
                    onChange={handleEditInputChange}
                    className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black"
                  />
                  <select
                    name="bookingIntervalMonths"
                    value={editFormData.bookingIntervalMonths || 1}
                    onChange={handleEditInputChange}
                    className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black"
                  >
                    <option value={1}>Monthly Booking</option>
                    <option value={3}>Quarterly Booking</option>
                  </select>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => setEditLogoFile(e.target.files?.[0] || null)}
                    className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black"
                  />
                  <div className="flex justify-end space-x-4">
                    <button
                      type="button"
                      onClick={() => setEditModalOpen(false)}
                      className="px-6 py-2 rounded-lg border border-gray-400 hover:bg-gray-100 text-black"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 rounded-lg bg-[#98c6d5] text-white hover:bg-blue-700"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerManagementPage;
