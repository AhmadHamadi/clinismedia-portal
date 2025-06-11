import { FaBars } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import logo1 from "../../assets/CliniMedia_Logo1.png";

interface EmployeeSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const EmployeeSidebar: React.FC<EmployeeSidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const navigate = useNavigate();
  const currentPath = window.location.pathname;

  const navItems = [
    { label: "Dashboard", path: "/employee/dashboard" },
    { label: "Notifications", path: "/employee/notifications" },
    { label: "View Media Day Calendar", path: "/employee/media-day-calendar" },
    { label: "Edit Availability", path: "/employee/edit-availability" },
    { label: "Tasks", path: "/employee/tasks" },
    { label: "Messages", path: "/employee/messages" },
    { label: "Payment Receipt", path: "/employee/payment-receipt" },
    { label: "Settings", path: "/employee/settings" },
  ];

  const getButtonClasses = (path: string) => {
    const baseClasses =
      "text-left w-full p-2 rounded transition hover:bg-blue-100 text-[#303b45]";
    const activeClasses = "bg-[#98c6d5] text-white";
    return currentPath === path ? `${baseClasses} ${activeClasses}` : baseClasses;
  };

  return (
    <div className={`fixed top-0 left-0 h-screen bg-white shadow-md ${sidebarOpen ? "w-64" : "w-16"} transition-all z-40`}>
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

export default EmployeeSidebar; 