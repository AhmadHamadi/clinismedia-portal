import React, { useState, useMemo } from "react";

interface Employee {
  id: number;
  name: string;
  photoUrl: string;
}

const mockEmployees: Employee[] = [
  {
    id: 1,
    name: "John Doe",
    photoUrl: "/CliniMedia_Logo1.png",
  },
  {
    id: 2,
    name: "Jane Smith",
    photoUrl: "/CliniMedia_Logo1.png",
  },
  {
    id: 3,
    name: "Michael Johnson",
    photoUrl: "/CliniMedia_Logo1.png",
  },
];

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState<Employee[]>(mockEmployees);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Filter employees based on search
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [employees, searchTerm]);

  // Pagination slice
  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredEmployees.slice(startIndex, startIndex + pageSize);
  }, [filteredEmployees, currentPage]);

  // Total pages
  const totalPages = Math.ceil(filteredEmployees.length / pageSize);

  // Modal controls for add employee
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhoto, setNewPhoto] = useState<File | null>(null);

  const handleAddEmployee = () => {
    if (!newName.trim()) return alert("Please enter a name.");
    const newEmployee: Employee = {
      id: employees.length + 1,
      name: newName.trim(),
      photoUrl: newPhoto ? URL.createObjectURL(newPhoto) : "/CliniMedia_Logo1.png",
    };
    setEmployees((prev) => [...prev, newEmployee]);
    setShowModal(false);
    setNewName("");
    setNewPhoto(null);
  };

  return (
    // Full viewport height + width, gray background behind content and sidebar
    <div className="min-h-screen flex bg-gray-100 font-sans w-full">
      {/* Content container next to sidebar */}
      <div className="flex-1 p-6 max-w-full">
        <div className="max-w-6xl mx-auto bg-white rounded-lg p-6 shadow-lg">
          {/* Header and Add button */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-extrabold text-gray-900">
              Employee Management
            </h1>
            <button
              onClick={() => setShowModal(true)}
              className="bg-[#98c6d5] hover:bg-blue-700 text-white px-5 py-2 rounded-lg transition"
            >
              + Add Employee
            </button>
          </div>

          {/* Search input */}
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

          {/* Table container with horizontal scroll */}
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse table-auto">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-6 text-left font-semibold text-gray-700">Photo</th>
                  <th className="p-6 text-left font-semibold text-black">Name</th>
                  <th className="p-6 text-left font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-gray-500">
                      No employees found.
                    </td>
                  </tr>
                ) : (
                  paginatedEmployees.map(({ id, name, photoUrl }) => (
                    <tr key={id} className="border-b hover:bg-gray-50 transition">
                      <td className="p-6">
                        <img
                          src={photoUrl}
                          alt={name}
                          className="w-16 h-16 rounded-full object-cover"
                        />
                      </td>
                      <td className="p-6 text-black">{name}</td>
                      <td className="p-6">
                        <button className="text-[#98c6d5] hover:underline mr-6">
                          View
                        </button>
                        <button className="text-red-600 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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

          {/* Add Employee Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-lg">
                <h2 className="text-2xl font-semibold mb-4">Add New Employee</h2>
                <input
                  type="text"
                  placeholder="Employee Name"
                  className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <input
                  type="file"
                  accept="image/*"
                  className="mb-4"
                  onChange={(e) => setNewPhoto(e.target.files ? e.target.files[0] : null)}
                />
                <div className="flex justify-end space-x-4">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2 rounded-lg border border-gray-400 hover:bg-gray-100 text-black"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddEmployee}
                    className="px-6 py-2 rounded-lg bg-[#98c6d5] text-white hover:bg-blue-700"
                  >
                    Add Employee
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeManagement;
