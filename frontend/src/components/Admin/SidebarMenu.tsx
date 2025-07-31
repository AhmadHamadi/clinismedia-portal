// src/components/SidebarMenu.tsx
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import logo1 from "../../assets/CliniMedia_Logo1.png";
import { logout } from "../../utils/auth";
import axios from "axios";

const SidebarMenu = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pendingBookingsCount, setPendingBookingsCount] = useState(0);
  const navigate = useNavigate();
  const currentPath = window.location.pathname;

  // Emit custom event when sidebar state changes
  useEffect(() => {
    const event = new CustomEvent('sidebarToggle', { 
      detail: { isOpen: sidebarOpen } 
    });
    window.dispatchEvent(event);
  }, [sidebarOpen]);

  // Fetch pending bookings count
  useEffect(() => {
    const fetchPendingBookingsCount = async () => {
      try {
        const token = localStorage.getItem('adminToken');
        if (!token) return;
        
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/bookings`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const pendingCount = response.data.filter((booking: any) => booking.status === 'pending').length;
        setPendingBookingsCount(pendingCount);
      } catch (err) {
        console.error('Error fetching pending bookings count:', err);
      }
    };

    fetchPendingBookingsCount();
  }, []);

  const navItems = [
    { label: "Dashboard", path: "/admin" },
    { label: "Media Day Calendar", path: "/admin/media", hasNotification: true },
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
      "text-left w-full p-2 rounded-lg transition-all duration-200 hover:bg-[#a0d2eb] text-gray-700 font-medium text-sm relative";
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
        {navItems.map(({ label, path, hasNotification }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={getButtonClasses(path)}
            title={!sidebarOpen ? label : undefined}
          >
            {sidebarOpen ? (
              <div className="flex items-center justify-between">
                <span>{label}</span>
                {hasNotification && pendingBookingsCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] flex items-center justify-center">
                    {pendingBookingsCount}
                  </span>
                )}
              </div>
            ) : (
              <div className="relative">
                <span>{label.charAt(0)}</span>
                {hasNotification && pendingBookingsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1 py-0.5 rounded-full min-w-[16px] flex items-center justify-center">
                    {pendingBookingsCount}
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
          className="w-full bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors font-medium text-sm"
        >
          {sidebarOpen ? "Logout" : "X"}
        </button>
      </div>
    </div>
  );
};

export default SidebarMenu;
