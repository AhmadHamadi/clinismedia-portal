import React from "react";
import { useEmployeeManagement, EmployeeTableRow } from "./EmployeeManagementLogic";

const EmployeeManagementPage = () => {
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
    departments,
    handleInputChange,
    handleAddEmployee,
    handleDeleteEmployee,
    handleViewEmployee,
    handleEditClick,
    handleEditInputChange,
    handleEditSubmit,
    paginatedEmployees,
    totalPages,
  } = useEmployeeManagement();

  return (
    <div className="min-h-screen flex bg-gray-100 font-sans w-full">
      <div className="flex-1 p-6 max-w-full">
        <div className="max-w-6xl mx-auto bg-white rounded-lg p-6 shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-extrabold text-gray-900">Employee Management</h1>
            <button
              onClick={() => setShowModal(true)}
              className="bg-[#98c6d5] hover:bg-blue-700 text-white px-5 py-2 rounded-lg transition"
            >
              Add Employee
            </button>
          </div>

          <input
            type="text"
            placeholder="Search employees..."
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
                  <th className="p-6 text-left font-semibold text-gray-700">Name</th>
                  <th className="p-6 text-left font-semibold text-black">Username</th>
                  <th className="p-6 text-left font-semibold text-black">Email</th>
                  <th className="p-6 text-left font-semibold text-black">Department</th>
                  <th className="p-6 text-left font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">No employees found.</td>
                  </tr>
                ) : (
                  paginatedEmployees.map((employee) => (
                    <EmployeeTableRow
                      key={employee._id}
                      employee={employee}
                      onView={handleViewEmployee}
                      onEdit={handleEditClick}
                      onDelete={handleDeleteEmployee}
                    />
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
                <h2 className="text-2xl font-semibold mb-4">Add New Employee</h2>
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleAddEmployee();
                  }}
                >
                  <input
                    type="text"
                    name="name"
                    placeholder="Employee Name"
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
                    type="password"
                    name="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
                  />
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
                  >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept.charAt(0).toUpperCase() + dept.slice(1)}
                      </option>
                    ))}
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
                      Add Employee
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {editModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-lg">
                <h2 className="text-2xl font-semibold mb-4">Edit Employee</h2>
                <form onSubmit={handleEditSubmit}>
                  <input
                    type="text"
                    name="name"
                    placeholder="Employee Name"
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
                    type="password"
                    name="password"
                    placeholder="New Password (leave blank to keep current)"
                    value={editFormData.password}
                    onChange={handleEditInputChange}
                    className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black"
                  />
                  <select
                    name="department"
                    value={editFormData.department}
                    onChange={handleEditInputChange}
                    className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black"
                  >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept.charAt(0).toUpperCase() + dept.slice(1)}
                      </option>
                    ))}
                  </select>
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

export default EmployeeManagementPage; 