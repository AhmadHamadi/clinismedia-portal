// src/components/SidebarMenu.tsx
import { FaBars } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import logo1 from "../../assets/CliniMedia_Logo1.png";

const SidebarMenu = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const currentPath = window.location.pathname;

  // Emit custom event when sidebar state changes
  useEffect(() => {
    const event = new CustomEvent('sidebarToggle', { 
      detail: { isOpen: sidebarOpen } 
    });
    window.dispatchEvent(event);
  }, [sidebarOpen]);

  const navItems = [
    { label: "Dashboard", path: "/admin" },
    { label: "Media Day Calendar", path: "/admin/media" },
    { label: "Onboarding Tasks", path: "/admin/onboarding" },
    { label: "Manage Customers", path: "/admin/customers" },
    { label: "Manage Employees", path: "/admin/employees" },
    { label: "Manage Gallery Edits", path: "/admin/gallery" },
    { label: "Manage Customer Invoices", path: "/admin/invoices" },
    { label: "Notifications", path: "/admin/notifications" },
    { label: "Settings", path: "/admin/settings" },
  ];

  const getButtonClasses = (path: string) => {
    const baseClasses =
      "text-left w-full p-3 rounded-lg transition-all duration-200 hover:bg-[#a0d2eb] text-gray-700 font-medium";
    const activeClasses = "bg-[#98c6d5] text-white shadow-md";
    return currentPath === path ? `${baseClasses} ${activeClasses}` : baseClasses;
  };

  return (
    <div className={`fixed left-0 top-0 h-full bg-white shadow-lg border-r border-gray-200 z-50 transition-all duration-300 ${sidebarOpen ? "w-64" : "w-16"}`} style={{ overflow: 'hidden' }}>
      {/* Top: Logo left, hamburger right */}
      <div className="p-4 flex items-center justify-between border-b border-gray-200">
        {sidebarOpen && (
          <img
            src={logo1}
            alt="CliniMedia Logo"
            className="h-20 object-contain"
          />
        )}
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)} 
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <FaBars className="text-gray-600" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-2 mt-4 overflow-hidden">
        {navItems.map(({ label, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={getButtonClasses(path)}
            title={!sidebarOpen ? label : undefined}
          >
            {sidebarOpen ? label : label.charAt(0)}
          </button>
        ))}
      </nav>

      {/* Logout Button at bottom */}
      <div className="absolute bottom-4 left-4 right-4">
        <button
          onClick={() => {
            localStorage.removeItem("adminToken");
            localStorage.removeItem("adminData");
            localStorage.removeItem("employeeToken");
            localStorage.removeItem("employeeData");
            navigate("/login");
          }}
          className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-lg transition-colors font-medium"
        >
          {sidebarOpen ? "Logout" : "X"}
        </button>
      </div>
    </div>
  );
};

export default SidebarMenu;
