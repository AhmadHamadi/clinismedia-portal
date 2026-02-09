// src/components/SidebarMenu.tsx
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import { FaHome, FaCalendarAlt, FaTasks, FaUsers, FaUserTie, FaFileInvoice, FaGoogle, FaFacebook, FaPhone, FaImages, FaFolderOpen, FaDollarSign, FaSignOutAlt, FaBars, FaStar } from 'react-icons/fa';
import logo1 from "../../assets/CliniMedia_Logo1.png";
import { logout } from "../../utils/auth";

const SidebarMenu = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pendingBookingsCount, setPendingBookingsCount] = useState(0);
  const [unreadNotesCount, setUnreadNotesCount] = useState(0);
  const navigate = useNavigate();
  const currentPath = window.location.pathname;

  // Fetch pending bookings count
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const token = localStorage.getItem('adminToken');
        if (!token) {
          console.log('No admin token found');
          return;
        }

        console.log('Fetching pending bookings count...');
        console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL);
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/bookings/pending-count`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        console.log('Pending bookings response:', response.data);
        setPendingBookingsCount(response.data.count);
      } catch (error: any) {
        console.error('Failed to fetch pending bookings count:', error);
        console.error('Error details:', error.response?.data);
      }
    };

    fetchPendingCount();
    // Poll every 5 seconds for real-time updates
    const interval = setInterval(fetchPendingCount, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch unread notes count
  useEffect(() => {
    const fetchUnreadNotesCount = async () => {
      try {
        const token = localStorage.getItem('adminToken');
        if (!token) return;

        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/client-notes/unread-count`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUnreadNotesCount(response.data.count);
      } catch (error: any) {
        console.error('Error fetching unread notes count:', error);
        setUnreadNotesCount(0);
      }
    };

    fetchUnreadNotesCount();
    // Poll every 10 seconds for unread notes updates
    const interval = setInterval(fetchUnreadNotesCount, 10000);
    return () => clearInterval(interval);
  }, []);

  // Emit custom event when sidebar state changes
  useEffect(() => {
    const event = new CustomEvent('sidebarToggle', { 
      detail: { isOpen: sidebarOpen } 
    });
    window.dispatchEvent(event);
  }, [sidebarOpen]);

  // MAIN ACTIONS section items
  const mainActionsItems = [
    { label: "Dashboard", path: "/admin", icon: <FaHome /> },
    { label: "Media Day Calendar", path: "/admin/media", icon: <FaCalendarAlt />, notificationCount: pendingBookingsCount },
    { label: "Onboarding Tasks", path: "/admin/onboarding", icon: <FaTasks /> },
    { label: "Manage Customers", path: "/admin/customers", icon: <FaUsers /> },
    { label: "Manage Employees", path: "/admin/employees", icon: <FaUserTie /> },
  ];

  // INTEGRATIONS section items
  const integrationsItems = [
    { label: "Manage Google Ads", path: "/admin/google-ads", icon: <FaGoogle /> },
    { label: "Manage Google Business", path: "/admin/google-business", icon: <FaGoogle /> },
    { label: "Manage Facebook", path: "/admin/facebook", icon: <FaFacebook /> },
    { label: "Manage Twilio", path: "/admin/twilio", icon: <FaPhone /> },
    { label: "Manage Instagram Insights", path: "/admin/instagram-insights", icon: <FaImages /> },
    { label: "Manage QuickBooks", path: "/admin/quickbooks", icon: <FaDollarSign /> },
  ];

  // CONTENT section items
  const contentItems = [
    { label: "Manage Gallery Edits", path: "/admin/gallery", icon: <FaImages /> },
    { label: "Manage Shared Folder", path: "/admin/shared-folders", icon: <FaFolderOpen />, notificationCount: unreadNotesCount },
    { label: "Manage Meta Leads", path: "/admin/meta-leads", icon: <FaFacebook /> },
    { label: "QR Reviews", path: "/admin/qr-reviews", icon: <FaStar /> },
  ];

  const handleLogout = async () => {
    const confirmed = window.confirm("Are you sure you want to logout? You will need to login again to access your account.");
    if (confirmed) {
      await logout('admin');
      navigate("/login");
    }
  };

  return (
    <div className={`fixed top-0 left-0 h-screen bg-[#1e293b] shadow-xl z-40 transition-all duration-300 ${sidebarOpen ? "w-64" : "w-16"} flex flex-col`}>
      {/* Top: Logo and Toggle */}
      <div className="p-3 border-b border-gray-700 flex-shrink-0 flex items-center justify-between">
        {sidebarOpen && (
          <img
            src={logo1}
            alt="CliniMedia Logo"
            className="h-10 object-contain cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => navigate("/admin")}
          />
        )}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-gray-400 hover:text-white transition-colors p-1"
        >
          <FaBars className="text-sm" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 overflow-y-auto">
        {/* MAIN ACTIONS Section */}
        <div className="mb-3">
          {sidebarOpen && (
            <h3 className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-2">
              MAIN ACTIONS
            </h3>
          )}
          <ul className="space-y-0.5">
            {mainActionsItems.map((item) => (
              <li key={item.path}>
                <button
                  onClick={() => navigate(item.path)}
                  className={`flex items-center w-full px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                    currentPath === item.path
                      ? 'bg-[#334155] text-white shadow-sm border-l-2 border-blue-500'
                      : 'text-gray-300 hover:bg-[#334155] hover:text-white'
                  }`}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <span className={`${currentPath === item.path ? 'text-blue-400' : 'text-gray-400'} text-sm flex-shrink-0`}>
                    {item.icon}
                  </span>
                  {sidebarOpen && (
                    <>
                      <span className="ml-2 flex-1 text-left">{item.label}</span>
                      {item.notificationCount !== undefined && item.notificationCount > 0 && (
                        <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-semibold leading-none text-white bg-red-500 rounded-full">
                          {item.notificationCount}
                        </span>
                      )}
                    </>
                  )}
                  {!sidebarOpen && item.notificationCount !== undefined && item.notificationCount > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-semibold leading-none text-white bg-red-500 rounded-full">
                      {item.notificationCount > 9 ? '9+' : item.notificationCount}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* INTEGRATIONS Section */}
        <div className="mb-3">
          {sidebarOpen && (
            <h3 className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-2">
              INTEGRATIONS
            </h3>
          )}
          <ul className="space-y-0.5">
            {integrationsItems.map((item) => (
              <li key={item.path}>
                <button
                  onClick={() => navigate(item.path)}
                  className={`flex items-center w-full px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                    currentPath === item.path
                      ? 'bg-[#334155] text-white shadow-sm border-l-2 border-blue-500'
                      : 'text-gray-300 hover:bg-[#334155] hover:text-white'
                  }`}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <span className={`${currentPath === item.path ? 'text-blue-400' : 'text-gray-400'} text-sm flex-shrink-0`}>
                    {item.icon}
                  </span>
                  {sidebarOpen && <span className="ml-2 flex-1 text-left">{item.label}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* CONTENT Section */}
        <div className="mb-3">
          {sidebarOpen && (
            <h3 className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-2">
              CONTENT
            </h3>
          )}
          <ul className="space-y-0.5">
            {contentItems.map((item) => (
              <li key={item.path}>
                <button
                  onClick={() => navigate(item.path)}
                  className={`flex items-center w-full px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                    currentPath === item.path
                      ? 'bg-[#334155] text-white shadow-sm border-l-2 border-blue-500'
                      : 'text-gray-300 hover:bg-[#334155] hover:text-white'
                  }`}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <span className={`${currentPath === item.path ? 'text-blue-400' : 'text-gray-400'} text-sm flex-shrink-0`}>
                    {item.icon}
                  </span>
                  {sidebarOpen && (
                    <>
                      <span className="ml-2 flex-1 text-left">{item.label}</span>
                      {item.notificationCount !== undefined && item.notificationCount > 0 && (
                        <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-semibold leading-none text-white bg-red-500 rounded-full">
                          {item.notificationCount}
                        </span>
                      )}
                    </>
                  )}
                  {!sidebarOpen && item.notificationCount !== undefined && item.notificationCount > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-semibold leading-none text-white bg-red-500 rounded-full">
                      {item.notificationCount > 9 ? '9+' : item.notificationCount}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Bottom: Logout */}
      <div className="p-2 border-t border-gray-700 flex-shrink-0">
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-2 py-1.5 text-xs font-medium text-gray-300 hover:bg-[#334155] hover:text-white rounded-md transition-colors"
          title={!sidebarOpen ? "Logout" : undefined}
        >
          <FaSignOutAlt className="text-sm flex-shrink-0" />
          {sidebarOpen && <span className="ml-2">Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default SidebarMenu;
