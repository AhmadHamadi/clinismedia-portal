import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomerDashboard, Customer } from "./CustomerDashLogic";
import { UserCircleIcon, MapPinIcon, CheckCircleIcon } from '@heroicons/react/24/solid';
import { FaCalendarAlt, FaTasks, FaGoogle, FaInstagram, FaShare, FaImages, FaDollarSign, FaPhone, FaFacebook, FaCamera } from 'react-icons/fa';
import axios from 'axios';

// Booking type
interface Booking {
  _id: string;
  date: string;
  notes?: string;
  status: 'pending' | 'accepted' | 'declined';
  location?: string;
}

type MediaDay = { date: string; time: string };

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const { customer, loading, error, handleLogout } = useCustomerDashboard();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const token = localStorage.getItem('customerToken');
        if (!token) return;
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/bookings/my-bookings`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setBookings(response.data);
      } catch (err) {
        // Optionally handle error
      } finally {
        setIsLoadingBookings(false);
      }
    };
    fetchBookings();
  }, []);

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
        console.log('[Dashboard] Could not fetch unpaid invoices count:', error.response?.status);
        setUnpaidInvoicesCount(0);
      }
    };

    fetchUnpaidInvoicesCount();
    // Poll every 30 seconds for updates
    const interval = setInterval(fetchUnpaidInvoicesCount, 30000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);


  const getUpcomingMediaDay = (): (MediaDay & { status: string }) | null => {
    const now = new Date();
    // Only consider accepted or pending bookings in the future
    const upcoming = bookings
      .filter(b => (b.status === 'accepted' || b.status === 'pending') && new Date(b.date) > now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
    if (!upcoming) return null;
    const dateObj = new Date(upcoming.date);
    return {
      date: dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      time: dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      status: upcoming.status
    };
  };

  const upcomingMediaDay = getUpcomingMediaDay();

  // Find completed (not cancelled) Media Day for the current month
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const hadMediaDayThisMonth = bookings.some(b => {
    const d = new Date(b.date);
    return (
      b.status === 'accepted' &&
      d.getMonth() === currentMonth &&
      d.getFullYear() === currentYear &&
      d < now // in the past
    );
  });

  const handleLogoutAndNavigate = () => {
    handleLogout();
    navigate("/login");
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    setUploadingLogo(true);
    try {
      const token = localStorage.getItem('customerToken');
      if (!token) {
        alert('Please log in again');
        return;
      }

      const formData = new FormData();
      formData.append('logo', file);

      const response = await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/customers/profile`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      // Update local storage with new customer data
      if (response.data) {
        localStorage.setItem('customerData', JSON.stringify(response.data));
        // Refresh the page to show updated logo
        window.location.reload();
      }
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to upload logo. Please try again.';
      alert(errorMessage);
    } finally {
      setUploadingLogo(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
            {error}
          </div>
          <button
            onClick={() => navigate("/login")}
            className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-md transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No customer data found.</p>
          <button
            onClick={() => navigate("/login")}
            className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-md transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-gray-50 min-h-screen overflow-x-hidden">
      <div className="w-full mx-auto max-w-full xl:max-w-7xl 2xl:max-w-7xl">
      {/* Header Section */}
      <div className="mb-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">Dashboard</h1>
        <p className="text-xs text-gray-600">Welcome back, {customer.name}</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        {/* Profile Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-3">
            {/* Logo or Profile Icon */}
            <div className="flex-shrink-0 relative">
              {customer.customerSettings?.logoUrl ? (
                <img
                  src={`${import.meta.env.VITE_BACKEND_BASE_URL}${customer.customerSettings.logoUrl}`}
                  alt="Clinic Logo"
                  className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
                  <UserCircleIcon className="w-8 h-8 text-gray-400" />
                </div>
              )}
              {/* Upload Button Overlay */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-gray-900 hover:bg-gray-800 text-white rounded-full flex items-center justify-center shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Upload logo"
              >
                {uploadingLogo ? (
                  <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <FaCamera className="w-2.5 h-2.5" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-gray-900 mb-0.5 truncate">
                {customer.name}
              </h2>
              {customer.email && (
                <p className="text-xs text-gray-600 mb-1 truncate">
                  {customer.email}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
                {customer.location && (
                  <div className="flex items-center gap-1">
                    <MapPinIcon className="w-2.5 h-2.5" />
                    <span>{customer.location}</span>
                  </div>
                )}
                {customer.createdAt && (
                  <span>Member since {new Date(customer.createdAt).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Upcoming Media Day Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-xs font-semibold text-gray-900 mb-2">Upcoming Media Day</h3>
              {upcomingMediaDay && upcomingMediaDay.status === 'pending' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-yellow-50 text-yellow-800 border border-yellow-200">
                  Pending Approval
                </span>
              )}
              {upcomingMediaDay && upcomingMediaDay.status === 'accepted' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-green-50 text-green-800 border border-green-200">
                  Approved
                </span>
              )}
            </div>
          </div>
          {isLoadingBookings ? (
            <div className="text-xs text-gray-500">Loading...</div>
          ) : upcomingMediaDay !== null ? (
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center gap-2 text-xs text-gray-700">
                <FaCalendarAlt className="w-3.5 h-3.5 text-gray-400" />
                <span>{upcomingMediaDay.date}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-700">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                <span>{upcomingMediaDay.time}</span>
              </div>
            </div>
          ) : hadMediaDayThisMonth ? (
            <p className="text-xs text-gray-600 mb-3">Media Day completed for this month. Book for next month!</p>
          ) : (
            <p className="text-xs text-gray-600 mb-3">No Media Day scheduled for this month.</p>
          )}
          <button
            onClick={() => navigate("/customer/media-day-booking")}
            className="w-full sm:w-auto px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-medium rounded-md transition-colors"
          >
            View/Request Booking
          </button>
        </div>
        {/* Quick Actions Section */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h3>
            
            {/* Main Actions Section */}
            <div className="mb-5">
              <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Main Actions</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {/* Media Day Calendar */}
                <button
                  onClick={() => navigate("/customer/media-day-booking")}
                  className="flex flex-col items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
                >
                  <FaCalendarAlt className="w-5 h-5 text-[#f59e0b] group-hover:text-[#d97706] mb-1.5" />
                  <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">Media Day Calendar</span>
                </button>
                {/* Onboarding Tasks */}
                <button
                  onClick={() => navigate("/customer/onboarding-tasks")}
                  className="flex flex-col items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group relative"
                >
                  {unreadCounts.onboarding > 0 && (
                    <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[16px] h-4.5 px-1 text-[9px] font-semibold text-white bg-red-500 rounded-full">
                      {unreadCounts.onboarding}
                    </span>
                  )}
                  <FaTasks className="w-5 h-5 text-[#3b82f6] group-hover:text-[#2563eb] mb-1.5" />
                  <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">Onboarding Tasks</span>
                </button>
                {/* View Media (Gallery) */}
                <button
                  onClick={() => navigate("/customer/gallery")}
                  className="flex flex-col items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group relative"
                >
                  {unreadCounts.gallery > 0 && (
                    <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[16px] h-4.5 px-1 text-[9px] font-semibold text-white bg-red-500 rounded-full">
                      {unreadCounts.gallery}
                    </span>
                  )}
                  <FaImages className="w-5 h-5 text-[#22c55e] group-hover:text-[#16a34a] mb-1.5" />
                  <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">View Media</span>
                </button>
                {/* Share Your Media */}
                <button
                  onClick={() => navigate("/customer/shared-media")}
                  className="flex flex-col items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
                >
                  <FaShare className="w-5 h-5 text-[#0ea5e9] group-hover:text-[#0284c7] mb-1.5" />
                  <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">Share Your Media</span>
                </button>
                {/* QuickBooks Invoices */}
                <button
                  onClick={() => navigate("/customer/quickbooks-invoices")}
                  className="flex flex-col items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group relative"
                >
                  {unpaidInvoicesCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[16px] h-4.5 px-1 text-[9px] font-semibold text-white bg-red-500 rounded-full">
                      {unpaidInvoicesCount}
                    </span>
                  )}
                  <FaDollarSign className="w-5 h-5 text-[#2563eb] group-hover:text-[#1d4ed8] mb-1.5" />
                  <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">QuickBooks Invoices</span>
                </button>
              </div>
            </div>

            {/* Marketing & Insights Section */}
            <div className="mb-5">
              <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Marketing & Insights</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* Meta Insights */}
                <button
                  onClick={() => navigate("/customer/facebook-insights")}
                  className="flex flex-col items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group relative"
                >
                  {unreadCounts.metaInsights > 0 && (
                    <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[16px] h-4.5 px-1 text-[9px] font-semibold text-white bg-red-500 rounded-full">
                      {unreadCounts.metaInsights}
                    </span>
                  )}
                  <FaFacebook className="w-5 h-5 text-[#1877f3] group-hover:text-[#166fe5] mb-1.5" />
                  <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">Meta Insights</span>
                </button>
                {/* Google Ads */}
                <button
                  onClick={() => navigate("/customer/google-ads")}
                  className="flex flex-col items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
                >
                  <FaGoogle className="w-5 h-5 text-[#ea4335] group-hover:text-[#d33b2c] mb-1.5" />
                  <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">Google Ads</span>
                </button>
                {/* Google Business */}
                <button
                  onClick={() => navigate("/customer/google-business-analytics")}
                  className="flex flex-col items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
                >
                  <FaGoogle className="w-5 h-5 text-[#4285f4] group-hover:text-[#357ae8] mb-1.5" />
                  <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">Google Business</span>
                </button>
                {/* Instagram Insights */}
                <button
                  onClick={() => navigate("/customer/instagram-insights")}
                  className="flex flex-col items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group relative"
                >
                  {unreadCounts.instagramInsights > 0 && (
                    <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[16px] h-4.5 px-1 text-[9px] font-semibold text-white bg-red-500 rounded-full">
                      {unreadCounts.instagramInsights}
                    </span>
                  )}
                  <FaInstagram className="w-5 h-5 text-[#e4405f] group-hover:text-[#c13584] mb-1.5" />
                  <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">Instagram Insights</span>
                </button>
              </div>
            </div>

            {/* Tracking Section */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <h4 className="text-[10px] font-semibold text-gray-700 uppercase tracking-wider mb-3">Tracking</h4>
              <div className="grid grid-cols-2 gap-2">
                {/* Call Logs */}
                <button
                  onClick={() => navigate("/customer/call-logs")}
                  className="flex flex-col items-center p-3 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors group relative"
                >
                  {unreadCounts.callLogs > 0 && (
                    <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[16px] h-4.5 px-1 text-[9px] font-semibold text-white bg-red-500 rounded-full">
                      {unreadCounts.callLogs}
                    </span>
                  )}
                  <FaPhone className="w-5 h-5 text-gray-600 group-hover:text-gray-900 mb-1.5" />
                  <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">Call Logs</span>
                </button>
                {/* Meta Leads */}
                <button
                  onClick={() => navigate("/customer/meta-leads")}
                  className="flex flex-col items-center p-3 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors group relative"
                >
                  {unreadCounts.metaLeads > 0 && (
                    <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[16px] h-4.5 px-1 text-[9px] font-semibold text-white bg-red-500 rounded-full">
                      {unreadCounts.metaLeads}
                    </span>
                  )}
                  <FaFacebook className="w-5 h-5 text-[#1877f3] group-hover:text-[#166fe5] mb-1.5" />
                  <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">Meta Leads</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default CustomerDashboard; 