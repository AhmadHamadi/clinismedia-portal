// src/components/Admin/CustomerManagement/CustomerManagementPage.tsx
import React from "react";
import { useCustomerManagement } from "./CustomerManagementLogic";
import { FaPlus, FaEdit, FaTrash, FaUserPlus } from "react-icons/fa";

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
  } = useCustomerManagement();

  return (
    <div className="min-h-screen flex bg-gray-50 font-sans w-full overflow-x-hidden">
      <div className="flex-1 p-4 sm:p-6 max-w-full min-w-0">
        <div className="max-w-6xl mx-auto bg-white rounded-lg p-4 sm:p-6 shadow-lg min-w-0">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">Customer Management</h1>
            <button
              onClick={() => setShowModal(true)}
              className="bg-[#98c6d5] hover:bg-blue-700 text-white px-5 min-h-11 rounded-lg transition w-full sm:w-auto"
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

          <div className="lg:hidden space-y-4">
            {paginatedCustomers.length === 0 ? (
              <p className="p-6 text-center text-gray-500 border border-gray-200 rounded-lg">No customers found.</p>
            ) : (
              paginatedCustomers.map((customer) => (
                <div key={customer._id} className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                    <p className="text-sm text-gray-600 break-words">{customer.email}</p>
                    <p className="text-sm text-gray-500">Username: {customer.username || '-'}</p>
                    <p className="text-sm text-gray-500">Location: {customer.location || '-'}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button className="min-h-11 inline-flex items-center justify-center text-[#98c6d5] border border-[#98c6d5] rounded-lg px-3" onClick={() => handleViewCustomer(customer)}>
                      View
                    </button>
                    <button className="min-h-11 inline-flex items-center justify-center text-blue-600 border border-blue-200 rounded-lg px-3" onClick={() => handleEditClick(customer)}>
                      Edit
                    </button>
                    <button className="min-h-11 inline-flex items-center justify-center text-red-600 border border-red-200 rounded-lg px-3" onClick={() => handleDeleteCustomer(customer._id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden lg:block overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="min-w-[620px] sm:min-w-full border-collapse table-auto">
              <thead className="bg-gray-100">
                <tr className="bg-gray-50">
                  <th className="p-4 sm:p-6 text-left font-semibold text-gray-700">Name</th>
                  <th className="p-4 sm:p-6 text-left font-semibold text-black">Username</th>
                  <th className="p-4 sm:p-6 text-left font-semibold text-black">Email</th>
                  <th className="p-4 sm:p-6 text-left font-semibold text-black">Location</th>
                  <th className="p-4 sm:p-6 text-left font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">No customers found.</td>
                  </tr>
                ) : (
                  paginatedCustomers.map((customer) => (
                    <tr key={customer._id} className="border-b hover:bg-gray-50 transition">
                      <td className="p-4 sm:p-6 text-black">{customer.name}</td>
                      <td className="p-4 sm:p-6 text-black">{customer.username || '-'}</td>
                      <td className="p-4 sm:p-6 text-black">{customer.email}</td>
                      <td className="p-4 sm:p-6 text-black">{customer.location || '-'}</td>
                      <td className="p-4 sm:p-6">
                        <div className="flex flex-wrap gap-2">
                        <button className="min-h-11 inline-flex items-center text-[#98c6d5] hover:underline px-2" onClick={() => handleViewCustomer(customer)}>
                          View
                        </button>
                        <button className="min-h-11 inline-flex items-center text-blue-600 hover:underline px-2" onClick={() => handleEditClick(customer)}>
                          Edit
                        </button>
                        <button className="min-h-11 inline-flex items-center text-red-600 hover:underline px-2" onClick={() => handleDeleteCustomer(customer._id)}>
                          Delete
                        </button>
                        </div>
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
                className="px-4 py-2 rounded-lg border-2 border-gray-400 bg-white text-gray-700 hover:bg-gray-100 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all duration-200"
              >
                ← Prev
              </button>
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-4 py-2 rounded-lg border-2 font-medium transition-all duration-200
                      ${pageNum === currentPage 
                        ? "bg-[#98c6d5] text-white border-[#98c6d5] shadow-md" 
                        : "bg-white text-gray-700 border-gray-400 hover:bg-gray-100 hover:border-gray-500"
                      }
                    `}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-lg border-2 border-gray-400 bg-white text-gray-700 hover:bg-gray-100 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all duration-200"
              >
                Next →
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
                    <option value={1}>Monthly (12 times per year)</option>
                    <option value={2}>2 Times per Year (every 6 months)</option>
                    <option value={3}>3 Times per Year (every 4 months)</option>
                    <option value={4}>4 Times per Year (every 3 months)</option>
                    <option value={6}>6 Times per Year (every 2 months)</option>
                  </select>
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
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-lg max-h-[90vh] overflow-y-auto">
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
                    <option value={1}>Monthly (12 times per year)</option>
                    <option value={2}>2 Times per Year (every 6 months)</option>
                    <option value={3}>3 Times per Year (every 4 months)</option>
                    <option value={4}>4 Times per Year (every 3 months)</option>
                    <option value={6}>6 Times per Year (every 2 months)</option>
                  </select>

                  {/* Receptionists block */}
                  <div className="mb-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-700">Receptionists</h3>
                      <button
                        type="button"
                        onClick={() => { setReceptionistForm({ name: "", username: "", email: "", password: "", canBookMediaDay: false }); setAddReceptionistModal(true); }}
                        className="flex items-center gap-1 text-sm text-[#98c6d5] hover:underline"
                      >
                        <FaUserPlus /> Add Receptionist
                      </button>
                    </div>
                    {receptionists.length === 0 ? (
                      <p className="text-sm text-gray-600">No receptionists. They can log in with customer portal and see Meta Leads (and Media Day if allowed).</p>
                    ) : (
                      <ul className="space-y-2">
                        {receptionists.map((r) => (
                          <li key={r._id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-gray-50">
                            <span className="truncate text-gray-800">{r.name} — {r.username} · {r.canBookMediaDay ? 'Media day' : 'Leads only'}</span>
                            <span className="flex gap-1 shrink-0">
                              <button type="button" onClick={() => handleEditReceptionistClick(r)} className="text-blue-600 hover:underline">Edit</button>
                              <button type="button" onClick={() => handleRemoveReceptionist(r._id)} className="text-red-600 hover:underline">Remove</button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

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

          {/* Add Receptionist modal */}
          {addReceptionistModal && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[60]">
              <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-lg">
                <h3 className="text-lg font-semibold mb-4">Add Receptionist</h3>
                <form onSubmit={handleAddReceptionist}>
                  <input
                    type="text"
                    placeholder="Name"
                    value={receptionistForm.name}
                    onChange={(e) => setReceptionistForm({ ...receptionistForm, name: e.target.value })}
                    className="w-full mb-3 p-3 rounded-lg border border-gray-300 text-black"
                  />
                  <input
                    type="text"
                    placeholder="Username"
                    value={receptionistForm.username}
                    onChange={(e) => setReceptionistForm({ ...receptionistForm, username: e.target.value })}
                    className="w-full mb-3 p-3 rounded-lg border border-gray-300 text-black"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={receptionistForm.email}
                    onChange={(e) => setReceptionistForm({ ...receptionistForm, email: e.target.value })}
                    className="w-full mb-3 p-3 rounded-lg border border-gray-300 text-black"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={receptionistForm.password}
                    onChange={(e) => setReceptionistForm({ ...receptionistForm, password: e.target.value })}
                    className="w-full mb-3 p-3 rounded-lg border border-gray-300 text-black"
                  />
                  <label className="flex items-center gap-2 mb-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={receptionistForm.canBookMediaDay}
                      onChange={(e) => setReceptionistForm({ ...receptionistForm, canBookMediaDay: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Can book Media Day</span>
                  </label>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setAddReceptionistModal(false)} className="px-4 py-2 rounded-lg border border-gray-400 hover:bg-gray-100 text-black">Cancel</button>
                    <button type="submit" className="px-4 py-2 rounded-lg bg-[#98c6d5] text-white hover:bg-blue-700">Add</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Receptionist modal */}
          {editReceptionistModal && editingReceptionist && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[60]">
              <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-lg">
                <h3 className="text-lg font-semibold mb-4">Edit Receptionist</h3>
                <form onSubmit={handleEditReceptionistSubmit}>
                  <input
                    type="text"
                    placeholder="Name"
                    value={editReceptionistForm.name}
                    onChange={(e) => setEditReceptionistForm({ ...editReceptionistForm, name: e.target.value })}
                    className="w-full mb-3 p-3 rounded-lg border border-gray-300 text-black"
                  />
                  <input
                    type="text"
                    placeholder="Username"
                    value={editReceptionistForm.username}
                    onChange={(e) => setEditReceptionistForm({ ...editReceptionistForm, username: e.target.value })}
                    className="w-full mb-3 p-3 rounded-lg border border-gray-300 text-black"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={editReceptionistForm.email}
                    onChange={(e) => setEditReceptionistForm({ ...editReceptionistForm, email: e.target.value })}
                    className="w-full mb-3 p-3 rounded-lg border border-gray-300 text-black"
                  />
                  <input
                    type="password"
                    placeholder="Password (leave blank to keep current)"
                    value={editReceptionistForm.password}
                    onChange={(e) => setEditReceptionistForm({ ...editReceptionistForm, password: e.target.value })}
                    className="w-full mb-3 p-3 rounded-lg border border-gray-300 text-black"
                  />
                  <label className="flex items-center gap-2 mb-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editReceptionistForm.canBookMediaDay}
                      onChange={(e) => setEditReceptionistForm({ ...editReceptionistForm, canBookMediaDay: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Can book Media Day</span>
                  </label>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => { setEditReceptionistModal(false); setEditingReceptionist(null); }} className="px-4 py-2 rounded-lg border border-gray-400 hover:bg-gray-100 text-black">Cancel</button>
                    <button type="submit" className="px-4 py-2 rounded-lg bg-[#98c6d5] text-white hover:bg-blue-700">Save</button>
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
