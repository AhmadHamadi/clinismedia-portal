import { FaBars, FaSignOutAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import logo1 from "../../assets/CliniMedia_Logo1.png";
import { logout } from "../../utils/auth";

interface EmployeeSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const EmployeeSidebar: React.FC<EmployeeSidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const navigate = useNavigate();
  const currentPath = window.location.pathname;

  const navItems = [
    { label: "Dashboard", path: "/employee/dashboard" },
    { label: "Photography Session Booking", path: "/employee/media-day-calendar" },
    { label: "Payment Receipt", path: "/employee/payment-receipt" },
  ];

  const getButtonClasses = (path: string) => {
    const baseClasses =
      "text-left w-full p-2 rounded transition hover:bg-blue-100 text-[#303b45]";
    const activeClasses = "bg-[#98c6d5] text-white";
    return currentPath === path ? `${baseClasses} ${activeClasses}` : baseClasses;
  };

  const handleLogout = async () => {
    const confirmed = window.confirm("Are you sure you want to logout? You will need to login again to access your account.");
    if (confirmed) {
      await logout('employee');
      navigate("/login");
    }
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

      {/* Logout Button */}
      <div className="p-4 border-t border-gray-200 mt-auto">
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <FaSignOutAlt />
          <span className="ml-3">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default EmployeeSidebar; 