import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaHome, FaCalendarAlt, FaTasks, FaFacebook, FaFileInvoice, FaImages, FaSignOutAlt, FaGoogle, FaShare, FaInstagram, FaPhone, FaDollarSign, FaRobot, FaSearch, FaBars } from 'react-icons/fa';
import axios from 'axios';
import logo1 from '../../assets/CliniMedia_Logo1.png';
import { logout } from '../../utils/auth';

interface CustomerSidebarProps {
  onLogout: () => void;
  /** If set, only show nav items whose pageKey is in this list. Omit for full access (customer). */
  allowedPages?: string[] | null;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  pageKey: string;
  section?: 'metaInsights' | 'gallery' | 'invoices' | 'onboarding' | 'instagramInsights' | 'metaLeads' | 'quickbooksInvoices' | 'callLogs' | 'aiReception';
  group?: string;
  comingSoon?: boolean;
}

const CustomerSidebar: React.FC<CustomerSidebarProps> = ({ onLogout, allowedPages }) => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(() => (
    typeof window === 'undefined' ? true : window.innerWidth >= 768
  ));
  const [unreadCounts, setUnreadCounts] = useState({
    metaInsights: 0,
    gallery: 0,
    invoices: 0,
    onboarding: 0,
    instagramInsights: 0,
    metaLeads: 0,
    aiReception: 0,
    callLogs: 0
  });
  const [unpaidInvoicesCount, setUnpaidInvoicesCount] = useState(0);

  const filterItems = (items: NavItem[]) =>
    allowedPages ? items.filter((i) => allowedPages.includes(i.pageKey)) : items;
  const showLabels = sidebarOpen;

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('customerSidebarToggle', {
      detail: { isOpen: sidebarOpen }
    }));
  }, [sidebarOpen]);

  // MAIN ACTIONS section items
  const mainActionsItems: NavItem[] = [
    { label: "Dashboard", path: "/customer/dashboard", icon: <FaHome />, pageKey: "dashboard" },
    { label: "Media Day Calendar", path: "/customer/media-day-booking", icon: <FaCalendarAlt />, pageKey: "media-day-booking" },
    { label: "Onboarding Tasks", path: "/customer/onboarding-tasks", icon: <FaTasks />, pageKey: "onboarding-tasks", section: "onboarding" },
    { label: "View Media", path: "/customer/gallery", icon: <FaImages />, pageKey: "gallery", section: "gallery" },
    { label: "Share Your Media", path: "/customer/shared-media", icon: <FaShare />, pageKey: "shared-media" },
    { label: "QuickBooks Invoices", path: "/customer/quickbooks-invoices", icon: <FaDollarSign />, pageKey: "quickbooks-invoices", section: "quickbooksInvoices" },
  ];

  // MARKETING & INSIGHTS section items
  const marketingInsightsItems: NavItem[] = [
    { label: "Meta Insights", path: "/customer/facebook-insights", icon: <FaFacebook />, pageKey: "facebook-insights", section: "metaInsights" },
    { label: "Google Ads", path: "/customer/google-ads", icon: <FaGoogle />, pageKey: "google-ads" },
    { label: "Google Business", path: "/customer/google-business-analytics", icon: <FaGoogle />, pageKey: "google-business-analytics" },
    { label: "Search Console", path: "/customer/search-console", icon: <FaSearch />, pageKey: "search-console" },
    { label: "Instagram Insights", path: "/customer/instagram-insights", icon: <FaInstagram />, pageKey: "instagram-insights", section: "instagramInsights" },
  ];

  // TRACKING section items
  const trackingItems: NavItem[] = [
    { label: "Call Logs", path: "/customer/call-logs", icon: <FaPhone />, pageKey: "call-logs", group: "tracking", section: "callLogs" },
    { label: "AI Reception", path: "/customer/ai-reception", icon: <FaRobot />, pageKey: "ai-reception", group: "tracking", section: "aiReception" },
    { label: "Meta Leads", path: "/customer/meta-leads", icon: <FaFacebook />, pageKey: "meta-leads", group: "tracking", section: "metaLeads" },
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
        const customerId = (user.role === 'receptionist' && user.parentCustomerId) ? user.parentCustomerId : (user._id || user.id);
        
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
    <div className={`portal-sidebar-shell fixed top-0 left-0 h-screen bg-[#1e293b] shadow-xl ${sidebarOpen ? 'w-64' : 'w-16'} flex flex-col z-40 transition-all duration-300 overflow-hidden`}>
      {/* Top: Logo */}
      <div className={`portal-sidebar-header ${showLabels ? 'p-3' : 'p-1.5'} border-b border-gray-700 flex items-center justify-between gap-2`}>
        {showLabels && (
          <img
            src={logo1}
            alt="CliniMedia Logo"
            className="portal-sidebar-logo h-10 object-contain cursor-pointer hover:opacity-90 transition-opacity min-w-0"
            onClick={() => navigate(allowedPages?.length ? `/customer/${allowedPages[0]}` : "/customer/dashboard")}
          />
        )}
        <button
          type="button"
          onClick={() => setSidebarOpen((open) => !open)}
          className={`${showLabels ? 'min-w-11' : 'min-w-9'} portal-sidebar-toggle text-gray-400 hover:text-white transition-colors inline-flex items-center justify-center flex-shrink-0`}
          aria-label={sidebarOpen ? 'Collapse navigation' : 'Expand navigation'}
        >
          <FaBars className="text-sm" />
        </button>
      </div>
      {/* Middle: Navigation */}
      <nav className="portal-sidebar-nav flex-1 min-h-0 p-1.5">
        {/* MAIN ACTIONS Section */}
        {filterItems(mainActionsItems).length > 0 && (
        <div className={`portal-sidebar-section ${showLabels ? "mb-3" : "mb-1"}`}>
          {showLabels && <h3 className="portal-sidebar-heading text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-2">
            MAIN ACTIONS
          </h3>}
          <ul className="portal-sidebar-list space-y-0.5">
            {filterItems(mainActionsItems).map((item) => (
              <li key={item.path}>
                <button
                  onClick={() => navigate(item.path)}
                  className={`portal-sidebar-row flex items-center w-full ${showLabels ? 'justify-start px-2' : 'justify-center px-0'} rounded-md text-xs font-medium transition-all ${
                    window.location.pathname === item.path
                      ? 'bg-[#334155] text-white shadow-sm border-l-2 border-blue-500'
                      : 'text-gray-300 hover:bg-[#334155] hover:text-white'
                  }`}
                  title={!showLabels ? item.label : undefined}
                >
                  <span className={`${window.location.pathname === item.path ? 'text-blue-400' : 'text-gray-400'} text-sm`}>
                    {item.icon}
                  </span>
                  {showLabels && <span className="ml-2 flex-1 text-left">{item.label}</span>}
                  {/* QuickBooks unpaid invoices badge */}
                  {showLabels && item.section === 'quickbooksInvoices' && unpaidInvoicesCount > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-semibold leading-none text-white bg-red-500 rounded-full">
                      {unpaidInvoicesCount}
                    </span>
                  )}
                  {/* Notification badge for other sections */}
                  {showLabels && item.section && item.section !== 'quickbooksInvoices' && unreadCounts[item.section as keyof typeof unreadCounts] > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-semibold leading-none text-white bg-red-500 rounded-full">
                      {unreadCounts[item.section as keyof typeof unreadCounts]}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
        )}

        {/* MARKETING & INSIGHTS Section */}
        {filterItems(marketingInsightsItems).length > 0 && (
        <div className={`portal-sidebar-section ${showLabels ? "mb-3" : "mb-1"}`}>
          {showLabels && <h3 className="portal-sidebar-heading text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-2">
            MARKETING & INSIGHTS
          </h3>}
          <ul className="portal-sidebar-list space-y-0.5">
            {filterItems(marketingInsightsItems).map((item) => (
              <li key={item.path}>
                <button
                  onClick={() => navigate(item.path)}
                  className={`portal-sidebar-row flex items-center w-full ${showLabels ? 'justify-start px-2' : 'justify-center px-0'} rounded-md text-xs font-medium transition-all ${
                    window.location.pathname === item.path
                      ? 'bg-[#334155] text-white shadow-sm border-l-2 border-blue-500'
                      : 'text-gray-300 hover:bg-[#334155] hover:text-white'
                  }`}
                  title={!showLabels ? item.label : undefined}
                >
                  <span className={`${window.location.pathname === item.path ? 'text-blue-400' : 'text-gray-400'} text-sm`}>
                    {item.icon}
                  </span>
                  {showLabels && <span className="ml-2 flex-1 text-left">{item.label}</span>}
                  {/* Notification badge */}
                  {showLabels && item.section && unreadCounts[item.section as keyof typeof unreadCounts] > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-semibold leading-none text-white bg-red-500 rounded-full">
                      {unreadCounts[item.section as keyof typeof unreadCounts]}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
        )}

        {/* TRACKING Section */}
        {filterItems(trackingItems).length > 0 && (
        <div className={`portal-sidebar-section ${showLabels ? "mb-3" : "mb-1"}`}>
          {showLabels && <h3 className="portal-sidebar-heading text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-2">
            TRACKING
          </h3>}
          <ul className="portal-sidebar-list space-y-0.5">
            {filterItems(trackingItems).map((item) => (
              <li key={item.path}>
                <button
                  onClick={() => !item.comingSoon && navigate(item.path)}
                  disabled={item.comingSoon}
                  className={`portal-sidebar-row flex items-center w-full ${showLabels ? 'justify-start px-3' : 'justify-center px-0'} rounded-md text-sm font-medium transition-all ${
                    item.comingSoon
                      ? 'text-gray-500 cursor-not-allowed opacity-50'
                      : window.location.pathname === item.path
                      ? 'bg-[#334155] text-white shadow-sm border-l-2 border-blue-500'
                      : 'text-gray-300 hover:bg-[#334155] hover:text-white'
                  }`}
                  title={!showLabels ? item.label : undefined}
                >
                  <span className={window.location.pathname === item.path ? 'text-blue-400' : 'text-gray-400'}>
                    {item.icon}
                  </span>
                  {showLabels && <span className="ml-3 flex-1 text-left">{item.label}</span>}
                  {/* Coming Soon badge */}
                  {showLabels && item.comingSoon && (
                    <span className="ml-auto text-[10px] font-medium text-gray-500 italic">
                      Coming Soon
                    </span>
                  )}
                  {/* Notification badge */}
                  {showLabels && !item.comingSoon && item.section && unreadCounts[item.section as keyof typeof unreadCounts] > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-semibold leading-none text-white bg-red-500 rounded-full">
                      {unreadCounts[item.section as keyof typeof unreadCounts]}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
        )}
      </nav>
      {/* Bottom: Logout */}
      <div className={`${showLabels ? 'p-2' : 'p-1.5'} border-t border-gray-700`}>
        <button
          onClick={handleLogout}
          className={`portal-sidebar-footer-button flex items-center w-full ${showLabels ? 'justify-start px-2' : 'justify-center px-0'} text-xs font-medium text-gray-300 hover:bg-[#334155] hover:text-white rounded-md transition-colors`}
          title={!showLabels ? 'Logout' : undefined}
        >
          <FaSignOutAlt className="text-sm" />
          {showLabels && <span className="ml-2">Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default CustomerSidebar; 

