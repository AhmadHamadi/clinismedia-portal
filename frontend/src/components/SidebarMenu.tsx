// src/components/SidebarMenu.tsx
import { FaBars } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const SidebarMenu = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();

  return (
    <div className={`bg-white shadow-md ${sidebarOpen ? "w-64" : "w-16"} transition-all`}>
      {/* Top Bar: Logo on the left, hamburger on the right */}
      <div className="p-4 flex items-center justify-between">
        {sidebarOpen && (
          <img
            src="/CliniMedia_Logo1.png"
            alt="CliniMedia Logo"
            className="h-20 object-contain"
          />
        )}
        <FaBars onClick={() => setSidebarOpen(!sidebarOpen)} className="cursor-pointer" />
      </div>

      {/* Navigation Links */}
      <nav className="p-4 space-y-3 text-sm">
        <button onClick={() => navigate("/admin")} className="text-left w-full text-[#303b45] hover:bg-blue-100 p-2 rounded">Dashboard</button>
        <button onClick={() => navigate("/admin/media")} className="text-left w-full text-[#303b45] hover:bg-blue-100 p-2 rounded">Media Day</button>
        <button onClick={() => navigate("/admin/onboarding")} className="text-left w-full text-[#303b45] hover:bg-blue-100 p-2 rounded">Onboarding</button>
        <button onClick={() => navigate("/admin/customers")} className="text-left w-full text-[#303b45] hover:bg-blue-100 p-2 rounded">Customers</button>
        <button onClick={() => navigate("/admin/employees")} className="text-left w-full text-[#303b45] hover:bg-blue-100 p-2 rounded">Employees</button>
        <button onClick={() => navigate("/admin/settings")} className="text-left w-full text-[#303b45] hover:bg-blue-100 p-2 rounded">Settings</button>
      </nav>
    </div>
  );
};

export default SidebarMenu;
