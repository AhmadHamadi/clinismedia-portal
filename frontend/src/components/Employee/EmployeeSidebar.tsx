import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaHome, FaCalendarAlt, FaFileInvoice, FaSignOutAlt } from 'react-icons/fa';
import logo1 from "../../assets/CliniMedia_Logo1.png";
import { logout } from "../../utils/auth";
import axios from "axios";

interface EmployeeSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const EmployeeSidebar: React.FC<EmployeeSidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const [availableBookingsCount, setAvailableBookingsCount] = useState(0);
  const navigate = useNavigate();
  const currentPath = window.location.pathname;

  // Fetch available bookings count
  useEffect(() => {
    const fetchAvailableBookingsCount = async () => {
      try {
        const token = localStorage.getItem('employeeToken');
        if (!token) return;
        
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/bookings/employee`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const currentEmployeeId = getCurrentEmployeeId();
        const now = new Date();
        const count = response.data.filter((booking: any) => {
          const isAccepted = booking.status === 'accepted';
          const isInFuture = new Date(booking.date) > now;
          const isUnassigned = !booking.photographer;
          
          return isAccepted && isInFuture && isUnassigned;
        }).length;
        
        console.log('EmployeeSidebar - availableBookingsCount:', count);
        setAvailableBookingsCount(count);
      } catch (err) {
        console.error('Error fetching available bookings count:', err);
      }
    };

    fetchAvailableBookingsCount();
  }, []);

  const getCurrentEmployeeId = (): string | null => {
    try {
      const token = localStorage.getItem('employeeToken');
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId || payload.sub || payload.id || payload._id || payload.user?.id || payload.user?._id || null;
    } catch (err) {
      return null;
    }
  };

  const navItems = [
    { label: "Dashboard", path: "/employee/dashboard", icon: <FaHome /> },
    { label: "Photography Session Booking", path: "/employee/media-day-calendar", icon: <FaCalendarAlt />, hasNotification: true },
    { label: "Payment Receipt", path: "/employee/payment-receipt", icon: <FaFileInvoice /> },
  ];

  const getButtonClasses = (path: string) => {
    const baseClasses =
      "flex items-center w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors";
    const activeClasses = "bg-[#98c6d5] text-white shadow-md";
    const inactiveClasses = "text-gray-700 hover:bg-gray-100";
    return currentPath === path ? `${baseClasses} ${activeClasses}` : `${baseClasses} ${inactiveClasses}`;
  };

  const handleLogout = async () => {
    const confirmed = window.confirm("Are you sure you want to logout? You will need to login again to access your account.");
    if (confirmed) {
      await logout('employee');
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
            onClick={() => navigate("/employee/dashboard")}
          />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
        {navItems.map(({ label, path, icon, hasNotification }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={getButtonClasses(path)}
            title={!sidebarOpen ? label : undefined}
          >
            {sidebarOpen ? (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                  {icon}
                  <span className="ml-3">{label}</span>
                </div>
                {hasNotification && availableBookingsCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] flex items-center justify-center">
                    {availableBookingsCount}
                  </span>
                )}
              </div>
            ) : (
              <div className="relative">
                {icon}
                {hasNotification && availableBookingsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1 py-0.5 rounded-full min-w-[16px] flex items-center justify-center">
                    {availableBookingsCount}
                  </span>
                )}
              </div>
            )}
          </button>
        ))}
      </nav>

      {/* Logout Button at bottom */}
      <div className="p-3 border-t border-gray-200 flex-shrink-0">
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

export default EmployeeSidebar; 