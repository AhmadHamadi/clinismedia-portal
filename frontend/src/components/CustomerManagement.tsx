// src/components/CustomerManagement.tsx
import SidebarMenu from "./SidebarMenu";

const ManageCustomers = () => {
  return (
    <div className="flex min-h-screen bg-gray-100 font-sans">
      <SidebarMenu />
      <div className="flex-1 p-6">
        <h1 className="text-2xl font-bold text-[#303b45] mb-4">Manage Customers</h1>
        <p>Customer management UI goes here.</p>
      </div>
    </div>
  );
};

export default ManageCustomers;
