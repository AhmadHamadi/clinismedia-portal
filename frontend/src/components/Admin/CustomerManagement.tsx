""// src/components/Admin/CustomerManagement.tsx
import { useEffect, useState } from "react";
import SidebarMenu from "./SidebarMenu";
import axios from "axios";

const CustomerManagement = () => {
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await axios.get("http://localhost:5050/api/customers");
        console.log("Fetched customers:", res.data);
        setCustomers(res.data); // Change to res.data.customers if needed based on log
      } catch (err) {
        console.error("Failed to fetch customers", err);
      }
    };

    fetchCustomers();
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans">
      <SidebarMenu />
      <div className="flex-1 p-6">
        <h1 className="text-2xl font-bold text-[#303b45] mb-4">Customer Management</h1>

        <table className="min-w-full bg-white rounded shadow-md">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b text-left">Logo</th>
              <th className="py-2 px-4 border-b text-left">Name</th>
              <th className="py-2 px-4 border-b text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer: any, index: number) => (
              <tr key={index} className="border-t">
                <td className="py-2 px-4">
                  {customer.logo ? (
                    <img
                      src={customer.logo}
                      alt="Customer Logo"
                      className="w-12 h-12 object-cover rounded-full"
                    />
                  ) : (
                    <span className="text-gray-400 italic">No logo</span>
                  )}
                </td>
                <td className="py-2 px-4">{customer.name}</td>
                <td className="py-2 px-4 space-x-2">
                  <button className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm">
                    Edit
                  </button>
                  <button className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6">
          <h2 className="text-xl font-semibold text-[#303b45] mb-2">Add New Customer</h2>
          {/* Add form inputs here: name, username, email, password, logo upload */}
          <form className="space-y-4">
            <input
              type="text"
              placeholder="Customer Name"
              className="w-full p-2 border rounded"
            />
            <input
              type="text"
              placeholder="Username"
              className="w-full p-2 border rounded"
            />
            <input
              type="email"
              placeholder="Email"
              className="w-full p-2 border rounded"
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full p-2 border rounded"
            />
            <input
              type="file"
              accept="image/*"
              className="w-full p-2 border rounded"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              Add Customer
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CustomerManagement;
