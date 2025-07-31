import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaHome, FaCalendarAlt, FaTasks, FaGoogle, FaFacebook, FaFileInvoice, FaImages, FaSignOutAlt } from 'react-icons/fa';
import logo1 from '../../assets/CliniMedia_Logo1.png';
import { logout } from '../../utils/auth';
import axios from 'axios';

interface CustomerSidebarProps {
  onLogout: () => void;
}

interface NotificationCounts {
  meta_insights: number;
  invoice: number;
  gallery: number;
}

const CustomerSidebar: React.FC<CustomerSidebarProps> = ({ onLogout }) => {
  const navigate = useNavigate();
  const [notificationCounts, setNotificationCounts] = useState<NotificationCounts>({
    meta_insights: 0,
    invoice: 0,
    gallery: 0
  });

  // Fetch notification counts
  useEffect(() => {
    const fetchNotificationCounts = async () => {
      try {
        const token = localStorage.getItem('customerToken');
        if (!token) return;

        const response = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/customer-notifications/counts`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setNotificationCounts(response.data);
      } catch (err) {
        console.error('Error fetching notification counts:', err);
      }
    };

    fetchNotificationCounts();
  }, []);

  const navItems = [
    { label: "Dashboard", path: "/customer/dashboard", icon: <FaHome /> },
    { label: "Media Day Calendar", path: "/customer/media-day-booking", icon: <FaCalendarAlt /> },
    { label: "Onboarding Tasks", path: "/customer/onboarding-tasks", icon: <FaTasks /> },
    { label: "Google Integration", path: "/customer/google-integration", icon: <FaGoogle /> },
    { label: "Meta Insights", path: "/customer/facebook-insights", icon: <FaFacebook />, notificationType: 'meta_insights' },
    { label: "View Your Invoice", path: "/customer/invoices", icon: <FaFileInvoice />, notificationType: 'invoice' },
    { label: "View Media", path: "/customer/gallery", icon: <FaImages />, notificationType: 'gallery' },
  ];

  const handleNavigation = async (path: string, notificationType?: string) => {
    // Mark notifications as read if navigating to a page with notifications
    if (notificationType && notificationCounts[notificationType as keyof NotificationCounts] > 0) {
      try {
        const token = localStorage.getItem('customerToken');
        if (token) {
          await axios.patch(
            `${import.meta.env.VITE_API_BASE_URL}/customer-notifications/mark-read/${notificationType}`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );

          // Update local state
          setNotificationCounts(prev => ({
            ...prev,
            [notificationType]: 0
          }));
        }
      } catch (err) {
        console.error('Error marking notifications as read:', err);
      }
    }

    navigate(path);
  };

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
          {navItems.map((item) => {
            const notificationCount = item.notificationType 
              ? notificationCounts[item.notificationType as keyof NotificationCounts] 
              : 0;

            return (
              <li key={item.path}>
                <button
                  onClick={() => handleNavigation(item.path, item.notificationType)}
                  className={`flex items-center w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    window.location.pathname === item.path
                      ? 'bg-[#98c6d5] text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center">
                      {item.icon}
                      <span className="ml-3">{item.label}</span>
                    </div>
                    {notificationCount > 0 && (
                      <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] flex items-center justify-center">
                        {notificationCount}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
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