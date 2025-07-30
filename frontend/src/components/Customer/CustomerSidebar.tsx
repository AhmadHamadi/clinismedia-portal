import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaHome, FaCalendarAlt, FaTasks, FaGoogle, FaFacebook, FaFileInvoice, FaImages, FaSignOutAlt } from 'react-icons/fa';
import logo1 from '../../assets/CliniMedia_Logo1.png';
import { logout } from '../../utils/auth';

interface CustomerSidebarProps {
  onLogout: () => void;
}

const CustomerSidebar: React.FC<CustomerSidebarProps> = ({ onLogout }) => {
  const navigate = useNavigate();

  const navItems = [
    { label: "Dashboard", path: "/customer/dashboard", icon: <FaHome /> },
    { label: "Media Day Calendar", path: "/customer/media-day-booking", icon: <FaCalendarAlt /> },
    { label: "Onboarding Tasks", path: "/customer/onboarding-tasks", icon: <FaTasks /> },
    { label: "Google Integration", path: "/customer/google-integration", icon: <FaGoogle /> },
    { label: "Meta Insights", path: "/customer/facebook-insights", icon: <FaFacebook /> },
    { label: "View Your Invoice", path: "/customer/invoices", icon: <FaFileInvoice /> },
    { label: "View Media", path: "/customer/gallery", icon: <FaImages /> },
  ];

  const handleLogout = async () => {
    const confirmed = window.confirm("Are you sure you want to logout? You will need to login again to access your account.");
    if (confirmed) {
      await logout('customer');
      onLogout();
      navigate("/login");
    }
  };

  return (
    <div className="fixed top-0 left-0 h-screen bg-white shadow-lg w-64 flex flex-col z-40">
      {/* Top: Logo */}
      <div className="p-3 border-b border-gray-200">
        <img
          src={logo1}
          alt="CliniMedia Logo"
          className="h-16 object-contain cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigate("/customer/dashboard")}
        />
      </div>
      {/* Middle: Navigation */}
      <nav className="flex-1 p-3">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <button
                onClick={() => navigate(item.path)}
                className={`flex items-center w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  window.location.pathname === item.path
                    ? 'bg-[#98c6d5] text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {item.icon}
                <span className="ml-3">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {/* Bottom: Logout */}
      <div className="p-3 border-t border-gray-200">
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

export default CustomerSidebar; 