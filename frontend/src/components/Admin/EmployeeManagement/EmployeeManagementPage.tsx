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
    <div className="min-h-screen flex bg-gray-100 font-sans w-full overflow-x-hidden">
      <div className="flex-1 p-4 sm:p-6 max-w-full min-w-0">
        <div className="max-w-6xl mx-auto bg-white rounded-lg p-4 sm:p-6 shadow-lg min-w-0">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">Employee Management</h1>
            <button
              onClick={() => setShowModal(true)}
              className="bg-[#98c6d5] hover:bg-blue-700 text-white px-5 min-h-11 rounded-lg transition w-full sm:w-auto"
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

          <div className="lg:hidden space-y-4">
            {paginatedEmployees.length === 0 ? (
              <p className="p-6 text-center text-gray-500 border border-gray-200 rounded-lg">No employees found.</p>
            ) : (
              paginatedEmployees.map((employee) => (
                <div key={employee._id} className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{employee.name}</h3>
                    <p className="text-sm text-gray-600 break-words">{employee.email}</p>
                    <p className="text-sm text-gray-500">Username: {employee.username || '-'}</p>
                    <p className="text-sm text-gray-500">Department: {employee.department || '-'}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button className="min-h-11 inline-flex items-center justify-center text-[#98c6d5] border border-[#98c6d5] rounded-lg px-3" onClick={() => handleViewEmployee(employee)}>
                      View
                    </button>
                    <button className="min-h-11 inline-flex items-center justify-center text-blue-600 border border-blue-200 rounded-lg px-3" onClick={() => handleEditClick(employee)}>
                      Edit
                    </button>
                    <button className="min-h-11 inline-flex items-center justify-center text-red-600 border border-red-200 rounded-lg px-3" onClick={() => handleDeleteEmployee(employee._id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden lg:block overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="min-w-[640px] sm:min-w-full border-collapse table-auto">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-4 sm:p-6 text-left font-semibold text-gray-700">Name</th>
                  <th className="p-4 sm:p-6 text-left font-semibold text-black">Username</th>
                  <th className="p-4 sm:p-6 text-left font-semibold text-black">Email</th>
                  <th className="p-4 sm:p-6 text-left font-semibold text-black">Department</th>
                  <th className="p-4 sm:p-6 text-left font-semibold text-gray-700">Actions</th>
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
