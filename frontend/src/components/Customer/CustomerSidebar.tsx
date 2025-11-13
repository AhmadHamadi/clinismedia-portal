import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaHome, FaCalendarAlt, FaTasks, FaFacebook, FaFileInvoice, FaImages, FaSignOutAlt, FaGoogle, FaShare, FaInstagram, FaPhone } from 'react-icons/fa';
import axios from 'axios';
import logo1 from '../../assets/CliniMedia_Logo1.png';
import { logout } from '../../utils/auth';

interface CustomerSidebarProps {
  onLogout: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  section?: 'metaInsights' | 'gallery' | 'invoices' | 'onboarding' | 'instagramInsights';
  group?: string; // For grouping items (e.g., 'tracking')
  comingSoon?: boolean; // For items that are not yet available
}

const CustomerSidebar: React.FC<CustomerSidebarProps> = ({ onLogout }) => {
  const navigate = useNavigate();
  const [unreadCounts, setUnreadCounts] = useState({
    metaInsights: 0,
    gallery: 0,
    invoices: 0,
    onboarding: 0,
    instagramInsights: 0
  });

  // Regular navigation items (not in a group)
  const regularNavItems: NavItem[] = [
    { label: "Dashboard", path: "/customer/dashboard", icon: <FaHome /> },
    { label: "Media Day Calendar", path: "/customer/media-day-booking", icon: <FaCalendarAlt /> },
    { label: "Onboarding Tasks", path: "/customer/onboarding-tasks", icon: <FaTasks />, section: "onboarding" },
    { label: "Google Ads", path: "/customer/google-ads", icon: <FaGoogle /> },
    { label: "Google Business", path: "/customer/google-business-analytics", icon: <FaGoogle /> },
    { label: "Instagram Insights", path: "/customer/instagram-insights", icon: <FaInstagram />, section: "instagramInsights" },
    { label: "Share Your Media", path: "/customer/shared-media", icon: <FaShare /> },
    { label: "View Media", path: "/customer/gallery", icon: <FaImages />, section: "gallery" },
    { label: "View Your Invoice", path: "/customer/invoices", icon: <FaFileInvoice />, section: "invoices" },
  ];

  // Tracking section items
  const trackingItems: NavItem[] = [
    { label: "Call Logs", path: "/customer/call-logs", icon: <FaPhone />, group: "tracking" },
    { label: "Meta Lead Tracking", path: "/customer/facebook-insights", icon: <FaFacebook />, section: "metaInsights", group: "tracking", comingSoon: true },
  ];

  // Fetch unread counts
  useEffect(() => {
    const fetchUnreadCounts = async () => {
      try {
        const token = localStorage.getItem('customerToken');
        if (!token) return;

        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/customer-notifications/unread-counts`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setUnreadCounts(response.data);
      } catch (error) {
        console.error('Failed to fetch unread counts:', error);
      }
    };

    fetchUnreadCounts();
    // Poll every 5 seconds for updates
    const interval = setInterval(fetchUnreadCounts, 5000);
    
    // Listen for refresh events from portal layout
    const handleRefreshNotifications = () => {
      fetchUnreadCounts();
    };
    window.addEventListener('refreshCustomerNotifications', handleRefreshNotifications);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('refreshCustomerNotifications', handleRefreshNotifications);
    };
  }, []);

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
      <nav className="flex-1 p-3 overflow-y-auto">
        <ul className="space-y-2">
          {/* Regular navigation items */}
          {regularNavItems.map((item) => (
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
                {/* Notification badge */}
                {item.section && unreadCounts[item.section as keyof typeof unreadCounts] > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                    {unreadCounts[item.section as keyof typeof unreadCounts]}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      
      {/* Tracking Section - at the bottom before logout */}
      <div className="px-3 pb-3 border-t border-gray-200 pt-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">
          Tracking
        </h3>
        <ul className="space-y-2">
          {trackingItems.map((item) => (
            <li key={item.path}>
              <button
                onClick={() => !item.comingSoon && navigate(item.path)}
                disabled={item.comingSoon}
                className={`flex items-center w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  item.comingSoon
                    ? 'text-gray-400 cursor-not-allowed opacity-60'
                    : window.location.pathname === item.path
                    ? 'bg-[#98c6d5] text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {item.icon}
                <span className="ml-3">{item.label}</span>
                {/* Coming Soon badge */}
                {item.comingSoon && (
                  <span className="ml-auto text-xs font-medium text-gray-500 italic">
                    Coming Soon
                  </span>
                )}
                {/* Notification badge */}
                {!item.comingSoon && item.section && unreadCounts[item.section as keyof typeof unreadCounts] > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                    {unreadCounts[item.section as keyof typeof unreadCounts]}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
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