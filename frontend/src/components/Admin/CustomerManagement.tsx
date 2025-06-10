import React, { useState, useMemo, useEffect } from "react";
import axios from "axios";

interface Customer {
  id: string;
  name: string;
  username: string;
  email: string;
}

const CustomerManagement = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");

  useEffect(() => {
    async function fetchCustomers() {
      try {
        const res = await axios.get("http://localhost:5000/api/users?role=customer");
        const customersWithId = res.data.map((c: any) => ({
          ...c,
          id: c._id,
        }));
        setCustomers(customersWithId);
      } catch (err) {
        console.error("Failed to fetch customers:", err);
      }
    }
    fetchCustomers();
  }, []);

  const filteredCustomers = useMemo(() =>
    customers.filter((cust) => cust.name.toLowerCase().includes(searchTerm.toLowerCase())),
  [customers, searchTerm]);

  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(startIndex, startIndex + pageSize);
  }, [filteredCustomers, currentPage]);

  const totalPages = Math.ceil(filteredCustomers.length / pageSize);

  const closeModal = () => {
    setShowModal(false);
    setNewName("");
    setNewUsername("");
    setNewPassword("");
    setNewEmail("");
  };

  const handleAddCustomer = async () => {
    if (!newName.trim() || !newUsername.trim() || !newPassword || !newEmail.trim()) {
      alert("Please fill all required fields.");
      return;
    }

    try {
      const res = await axios.post("http://localhost:5000/api/auth/register", {
        name: newName.trim(),
        username: newUsername.trim(),
        password: newPassword,
        role: "customer",
        email: newEmail.trim(),
      });

      const addedCustomer = { ...res.data, id: res.data._id };
      setCustomers((prev) => [...prev, addedCustomer]);
      closeModal();
    } catch (error: any) {
      if (error.response) {
        console.error("Backend error:", error.response.data);
        alert("Failed to add customer: " + (error.response.data.message || JSON.stringify(error.response.data)));
      } else {
        console.error("Error:", error.message);
        alert("Failed to add customer: " + error.message);
      }
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this customer?")) return;

    try {
      await axios.delete(`http://localhost:5000/api/users/${id}`);
      setCustomers((prev) => prev.filter((cust) => cust.id !== id));
    } catch (error) {
      console.error("Failed to delete customer:", error);
      alert("Failed to delete customer. Please try again.");
    }
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
              + Add Customer
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
                  <th className="p-6 text-left font-semibold text-gray-700">Name</th>
                  <th className="p-6 text-left font-semibold text-black">Username</th>
                  <th className="p-6 text-left font-semibold text-black">Email</th>
                  <th className="p-6 text-left font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">No customers found.</td>
                  </tr>
                ) : (
                  paginatedCustomers.map(({ id, name, username, email }) => (
                    <tr key={id} className="border-b hover:bg-gray-50 transition">
                      <td className="p-6 text-black">{name}</td>
                      <td className="p-6 text-black">{username}</td>
                      <td className="p-6 text-black">{email}</td>
                      <td className="p-6">
                        <button className="text-[#98c6d5] hover:underline mr-6">View</button>
                        <button
                          onClick={() => handleDeleteCustomer(id)}
                          className="text-red-600 hover:underline"
                        >
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
                <input
                  type="text"
                  placeholder="Customer Name"
                  className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Username"
                  className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="Password"
                  className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full mb-4 p-4 rounded-lg border border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
                <div className="flex justify-end space-x-4">
                  <button
                    onClick={closeModal}
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

