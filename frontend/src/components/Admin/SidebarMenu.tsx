// src/components/SidebarMenu.tsx
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import logo1 from "../../assets/CliniMedia_Logo1.png";
import { logout } from "../../utils/auth";

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
    { label: "Manage Facebook", path: "/admin/facebook" },
    { label: "Manage Instagram Insights", path: "/admin/instagram-insights" },
  ];

  const getButtonClasses = (path: string) => {
    const baseClasses =
      "text-left w-full p-2 rounded-lg transition-all duration-200 hover:bg-[#a0d2eb] text-gray-700 font-medium text-sm";
    const activeClasses = "bg-[#98c6d5] text-white shadow-md";
    return currentPath === path ? `${baseClasses} ${activeClasses}` : baseClasses;
  };

  const handleLogout = async () => {
    const confirmed = window.confirm("Are you sure you want to logout? You will need to login again to access your account.");
    if (confirmed) {
      await logout('admin');
      navigate("/login");
    }
  };

  return (
    <div className={`fixed left-0 top-0 h-full bg-white shadow-lg border-r border-gray-200 z-50 transition-all duration-300 ${sidebarOpen ? "w-64" : "w-16"} flex flex-col`}>
      {/* Top: Logo only */}
      <div className="p-3 border-b border-gray-200 flex-shrink-0">
        {sidebarOpen && (
          <img
            src={logo1}
            alt="CliniMedia Logo"
            className="h-16 object-contain cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate("/admin")}
          />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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
      <div className="p-3 border-t border-gray-200 flex-shrink-0">
        <button
          onClick={handleLogout}
          className="w-full bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors font-medium text-sm"
        >
          {sidebarOpen ? "Logout" : "X"}
        </button>
      </div>
    </div>
  );
};

export default SidebarMenu;
