import React, { useState, useMemo } from "react";

interface Customer {
  id: number;
  name: string;
  logoUrl: string;
}

const mockCustomers: Customer[] = [
  {
    id: 1,
    name: "Acme Clinic",
    logoUrl: "/CliniMedia_Logo1.png",
  },
  {
    id: 2,
    name: "HealthPlus",
    logoUrl: "/CliniMedia_Logo1.png",
  },
  {
    id: 3,
    name: "Wellness Center",
    logoUrl: "/CliniMedia_Logo1.png",
  },
];

const CustomerManagement = () => {
  const [customers, setCustomers] = useState<Customer[]>(mockCustomers);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Filter customers based on search
  const filteredCustomers = useMemo(() => {
    return customers.filter((cust) =>
      cust.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [customers, searchTerm]);

  // Pagination slice
  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(startIndex, startIndex + pageSize);
  }, [filteredCustomers, currentPage]);

  // Total pages
  const totalPages = Math.ceil(filteredCustomers.length / pageSize);

  // Modal controls for add customer
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLogo, setNewLogo] = useState<File | null>(null);

  const handleAddCustomer = () => {
    if (!newName.trim()) return alert("Please enter a name.");
    const newCustomer: Customer = {
      id: customers.length + 1,
      name: newName.trim(),
      logoUrl: newLogo ? URL.createObjectURL(newLogo) : "/CliniMedia_Logo1.png",
    };
    setCustomers((prev) => [...prev, newCustomer]);
    setShowModal(false);
    setNewName("");
    setNewLogo(null);
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
              Customer Management
            </h1>
            <button
              onClick={() => setShowModal(true)}
              className="bg-[#98c6d5] hover:bg-blue-700 text-white px-5 py-2 rounded-lg transition"
            >
              + Add Customer
            </button>
          </div>

          {/* Search input */}
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

          {/* Table container with horizontal scroll */}
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse table-auto">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-6 text-left font-semibold text-gray-700">Logo</th>
                  <th className="p-6 text-left font-semibold text-black">Name</th>
                  <th className="p-6 text-left font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-gray-500">
                      No customers found.
                    </td>
                  </tr>
                ) : (
                  paginatedCustomers.map(({ id, name, logoUrl }) => (
                    <tr key={id} className="border-b hover:bg-gray-50 transition">
                      <td className="p-6">
                        <img
                          src={logoUrl}
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

          {/* Add Customer Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-lg">
                <h2 className="text-2xl font-semibold mb-4">Add New Customer</h2>
                <input
                  type="text"
                  placeholder="Customer Name"
                  className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <input
                  type="file"
                  accept="image/*"
                  className="mb-4"
                  onChange={(e) => setNewLogo(e.target.files ? e.target.files[0] : null)}
                />
                <div className="flex justify-end space-x-4">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2 rounded-lg border border-gray-400 hover:bg-gray-100 text-black"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddCustomer}
                    className="px-6 py-2 rounded-lg bg-[#98c6d5] text-white hover:bg-blue-700"
                  >
                    Add Customer
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

export default CustomerManagement;
