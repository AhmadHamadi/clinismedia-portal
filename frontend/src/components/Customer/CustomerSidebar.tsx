import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaHome, FaCalendarAlt, FaTasks, FaFacebook, FaFileInvoice, FaImages, FaSignOutAlt, FaGoogle, FaShare, FaInstagram, FaPhone, FaDollarSign } from 'react-icons/fa';
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
  section?: 'metaInsights' | 'gallery' | 'invoices' | 'onboarding' | 'instagramInsights' | 'metaLeads' | 'quickbooksInvoices' | 'callLogs';
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
    instagramInsights: 0,
    metaLeads: 0,
    callLogs: 0
  });
  const [unpaidInvoicesCount, setUnpaidInvoicesCount] = useState(0);

  // MAIN ACTIONS section items
  const mainActionsItems: NavItem[] = [
    { label: "Dashboard", path: "/customer/dashboard", icon: <FaHome /> },
    { label: "Media Day Calendar", path: "/customer/media-day-booking", icon: <FaCalendarAlt /> },
    { label: "Onboarding Tasks", path: "/customer/onboarding-tasks", icon: <FaTasks />, section: "onboarding" },
    { label: "View Media", path: "/customer/gallery", icon: <FaImages />, section: "gallery" },
    { label: "Share Your Media", path: "/customer/shared-media", icon: <FaShare /> },
    { label: "QuickBooks Invoices", path: "/customer/quickbooks-invoices", icon: <FaDollarSign />, section: "quickbooksInvoices" },
  ];

  // MARKETING & INSIGHTS section items
  const marketingInsightsItems: NavItem[] = [
    { label: "Meta Insights", path: "/customer/facebook-insights", icon: <FaFacebook />, section: "metaInsights" },
    { label: "Google Ads", path: "/customer/google-ads", icon: <FaGoogle /> },
    { label: "Google Business", path: "/customer/google-business-analytics", icon: <FaGoogle /> },
    { label: "Instagram Insights", path: "/customer/instagram-insights", icon: <FaInstagram />, section: "instagramInsights" },
  ];

  // TRACKING section items
  const trackingItems: NavItem[] = [
    { label: "Call Logs", path: "/customer/call-logs", icon: <FaPhone />, group: "tracking", section: "callLogs" },
    { label: "Meta Leads", path: "/customer/meta-leads", icon: <FaFacebook />, group: "tracking", section: "metaLeads" },
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

  // Fetch unpaid QuickBooks invoices count
  useEffect(() => {
    const fetchUnpaidInvoicesCount = async () => {
      try {
        const token = localStorage.getItem('customerToken');
        const userStr = localStorage.getItem('customerData');
        
        if (!token || !userStr) return;

        const user = JSON.parse(userStr);
        const customerId = user._id || user.id;
        
        if (!customerId) return;

        // Check if QuickBooks is connected first
        const statusResponse = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/quickbooks/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!statusResponse.data?.connected) {
          setUnpaidInvoicesCount(0);
          return;
        }

        // Fetch invoices
        const invoicesResponse = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/quickbooks/customer/${customerId}/invoices`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const invoices = invoicesResponse.data.invoices || [];
        
        // Count unpaid invoices (status !== 'paid' and balance > 0)
        const unpaidCount = invoices.filter((inv: any) => {
          if (!inv) return false;
          const status = inv.status || 'unknown';
          const balance = Number(inv.balance || 0);
          return (status !== 'paid' && balance > 0);
        }).length;

        setUnpaidInvoicesCount(unpaidCount);
      } catch (error: any) {
        // Silently fail - don't show error if QuickBooks not connected or not mapped
        console.log('[Sidebar] Could not fetch unpaid invoices count:', error.response?.status);
        setUnpaidInvoicesCount(0);
      }
    };

    fetchUnpaidInvoicesCount();
    // Poll every 30 seconds for updates (less frequent than notifications)
    const interval = setInterval(fetchUnpaidInvoicesCount, 30000);
    
    return () => {
      clearInterval(interval);
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
      <nav className="flex-1 p-3 overflow-y-visible">
        {/* MAIN ACTIONS Section */}
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 px-3">
            MAIN ACTIONS
          </h3>
          <ul className="space-y-1">
            {mainActionsItems.map((item) => (
              <li key={item.path}>
                <button
                  onClick={() => navigate(item.path)}
                  className={`flex items-center w-full px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    window.location.pathname === item.path
                      ? 'bg-[#98c6d5] text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {item.icon}
                  <span className="ml-3">{item.label}</span>
                  {/* QuickBooks unpaid invoices badge */}
                  {item.section === 'quickbooksInvoices' && unpaidInvoicesCount > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                      {unpaidInvoicesCount}
                    </span>
                  )}
                  {/* Notification badge for other sections */}
                  {item.section && item.section !== 'quickbooksInvoices' && unreadCounts[item.section as keyof typeof unreadCounts] > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                      {unreadCounts[item.section as keyof typeof unreadCounts]}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* MARKETING & INSIGHTS Section */}
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 px-3">
            MARKETING & INSIGHTS
          </h3>
          <ul className="space-y-1">
            {marketingInsightsItems.map((item) => (
              <li key={item.path}>
                <button
                  onClick={() => navigate(item.path)}
                  className={`flex items-center w-full px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
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
        </div>

        {/* TRACKING Section */}
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 px-3">
            TRACKING
          </h3>
          <ul className="space-y-1">
            {trackingItems.map((item) => (
              <li key={item.path}>
                <button
                  onClick={() => !item.comingSoon && navigate(item.path)}
                  disabled={item.comingSoon}
                  className={`flex items-center w-full px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
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