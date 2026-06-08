import { FaBars, FaCalendarAlt, FaFileInvoice, FaHome, FaSignOutAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import axios from "axios";
import logo1 from "../../assets/CliniMedia_Logo1.png";
import { logout } from "../../utils/auth";

interface EmployeeSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const EmployeeSidebar: React.FC<EmployeeSidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const navigate = useNavigate();
  const currentPath = window.location.pathname;
  const [availableSessionsCount, setAvailableSessionsCount] = useState(0);

  // Fetch available photography sessions count
  useEffect(() => {
    const fetchAvailableSessionsCount = async () => {
      try {
        const token = localStorage.getItem('employeeToken');
        if (!token) return;

        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/bookings/employee`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        // Count accepted bookings without photographers (available for claiming)
        const availableCount = response.data.filter((booking: any) => 
          booking.status === 'accepted' && !booking.photographer
        ).length;
        
        setAvailableSessionsCount(availableCount);
      } catch (error) {
        console.error('Failed to fetch available sessions count:', error);
      }
    };

    fetchAvailableSessionsCount();
    // Poll every 5 seconds for real-time updates
    const interval = setInterval(fetchAvailableSessionsCount, 5000);
    
    // Listen for refresh events from media day booking
    const handleRefreshNotifications = () => {
      fetchAvailableSessionsCount();
    };
    window.addEventListener('refreshEmployeeNotifications', handleRefreshNotifications);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('refreshEmployeeNotifications', handleRefreshNotifications);
    };
  }, []);

  const navItems = [
    { label: "Dashboard", path: "/employee/dashboard", icon: <FaHome /> },
    { label: "Photography Session Booking", path: "/employee/media-day-calendar", section: "sessions", icon: <FaCalendarAlt /> },
    { label: "Payment Receipt", path: "/employee/payment-receipt", icon: <FaFileInvoice /> },
  ];

  const getButtonClasses = (path: string) => {
    const baseClasses =
      "text-left w-full p-2 min-h-11 rounded transition hover:bg-blue-100 text-[#303b45]";
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
    <div className={`fixed top-0 left-0 h-screen bg-white shadow-md ${sidebarOpen ? "w-64" : "w-16"} transition-all z-40 flex flex-col`}>
      {/* Top: Logo left, hamburger right */}
      <div className="p-4 flex items-center justify-between">
        {sidebarOpen && (
          <img
            src={logo1}
            alt="CliniMedia Logo"
            className="h-20 object-contain"
          />
        )}
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg hover:bg-gray-100"
          aria-label={sidebarOpen ? "Collapse navigation" : "Expand navigation"}
        >
          <FaBars />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 sm:p-4 space-y-3 text-sm">
        {navItems.map(({ label, path, section, icon }) => (
          <div key={path} className="relative">
            <button
              onClick={() => navigate(path)}
              className={`${getButtonClasses(path)} ${sidebarOpen ? '' : 'flex justify-center px-0'}`}
              title={!sidebarOpen ? label : undefined}
            >
              <div className={`flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'} w-full min-w-0`}>
                <span className="flex-shrink-0">{icon}</span>
                {sidebarOpen && <span className="ml-2 truncate">{label}</span>}
                {/* Notification badge for Photography Session Booking */}
                {sidebarOpen && section === "sessions" && availableSessionsCount > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                    {availableSessionsCount}
                  </span>
                )}
              </div>
            </button>
          </div>
        ))}
      </nav>

      {/* Logout Button */}
      <div className={`${sidebarOpen ? 'p-4' : 'p-2'} border-t border-gray-200 mt-auto`}>
        <button
          onClick={handleLogout}
          className={`flex items-center w-full ${sidebarOpen ? 'justify-start px-3' : 'justify-center px-0'} min-h-11 min-w-11 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors`}
          title={!sidebarOpen ? 'Logout' : undefined}
        >
          <FaSignOutAlt />
          {sidebarOpen && <span className="ml-3">Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default EmployeeSidebar;
