import React, { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { FaBars, FaSignOutAlt, FaHome, FaCalendar, FaTasks, FaGoogle, FaFacebook, FaFileInvoice, FaImages } from 'react-icons/fa';
import logo1 from '../../assets/CliniMedia_Logo1.png';

interface CustomerSidebarProps {
  onLogout: () => void;
}

const CustomerSidebar: React.FC<CustomerSidebarProps> = ({ onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();

  const navItems = [
    { label: "Dashboard", path: "/customer/dashboard", icon: <FaHome /> },
    { label: "Media Day Calendar", path: "/customer/media-day-booking", icon: <FaCalendar /> },
    { label: "Onboarding Tasks", path: "/customer/onboarding-tasks", icon: <FaTasks /> },
    { label: "Google Integration", path: "/customer/google-integration", icon: <FaGoogle /> },
    { label: "Meta Insights", path: "/customer/facebook-insights", icon: <FaFacebook /> },
    { label: "View Your Invoice", path: "/customer/invoices", icon: <FaFileInvoice /> },
    { label: "View Media", path: "/customer/gallery", icon: <FaImages /> },
  ];

  const handleLogout = () => {
    onLogout();
    navigate("/login");
  };

  return (
    <div className={`fixed top-0 left-0 h-screen bg-white shadow-lg transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-16'} flex flex-col z-40`}>
      {/* Top: Logo and Toggle */}
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        {sidebarOpen && (
          <img
            src={logo1}
            alt="CliniMedia Logo"
            className="h-16 object-contain cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate("/customer/dashboard")}
          />
        )}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <FaBars className="w-4 h-4 text-gray-600" />
        </button>
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
                {sidebarOpen && <span className="ml-3">{item.label}</span>}
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
          {sidebarOpen && <span className="ml-3">Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default CustomerSidebar; 