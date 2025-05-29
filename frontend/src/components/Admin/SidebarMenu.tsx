// src/components/SidebarMenu.tsx
import { FaBars } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import logo1 from "../../assets/CliniMedia_Logo1.png";


const SidebarMenu = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const currentPath = window.location.pathname;

  if (currentPath === "/admin") return null;

  const navItems = [
    { label: "Dashboard", path: "/admin" },
    { label: "Media Day", path: "/admin/media" },
    { label: "Onboarding", path: "/admin/onboarding" },
    { label: "Customers", path: "/admin/customers" },
    { label: "Employees", path: "/admin/employees" },
    { label: "Settings", path: "/admin/settings" },
  ];

  const getButtonClasses = (path: string) => {
    const baseClasses =
      "text-left w-full p-2 rounded transition hover:bg-blue-100 text-[#303b45]";
    const activeClasses = "bg-[#98c6d5] text-white";
    return currentPath === path ? `${baseClasses} ${activeClasses}` : baseClasses;
  };

  return (
    <div className={`bg-white shadow-md ${sidebarOpen ? "w-64" : "w-16"} transition-all`}>
      {/* Top: Logo left, hamburger right */}
      <div className="p-4 flex items-center justify-between">
        {sidebarOpen && (
          <img
            src={logo1}
            alt="CliniMedia Logo"
            className="h-20 object-contain"
          />
        )}
        <FaBars onClick={() => setSidebarOpen(!sidebarOpen)} className="cursor-pointer" />
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-3 text-sm">
        {navItems.map(({ label, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={getButtonClasses(path)}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default SidebarMenu;
