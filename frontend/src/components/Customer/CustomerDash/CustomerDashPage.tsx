import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomerDashboard, Customer } from "./CustomerDashLogic";
import { UserCircleIcon, MapPinIcon, CheckCircleIcon } from '@heroicons/react/24/solid';
import { FaCalendarAlt, FaTasks, FaGoogle, FaInstagram, FaShare, FaImages, FaDollarSign, FaPhone, FaFacebook } from 'react-icons/fa';
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
    metaLeads: 0
  });
  const [unpaidInvoicesCount, setUnpaidInvoicesCount] = useState(0);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#98c6d5] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
          <button
            onClick={() => navigate("/login")}
            className="bg-[#98c6d5] hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No customer data found.</p>
          <button
            onClick={() => navigate("/login")}
            className="bg-[#98c6d5] hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-3 py-3" style={{ transform: 'scale(0.9)', transformOrigin: 'top left', width: '111%' }}>
      {/* Intro Box */}
      <div className="bg-gradient-to-br from-[#e0f2fe] to-[#f8fafc] rounded-lg shadow-lg p-3 border border-[#e0e7ef] mb-3 relative overflow-hidden flex items-center justify-center min-h-[100px]">
        {/* Decorative Sparkles in Corners */}
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="absolute top-1 left-1 opacity-30 rotate-12 pointer-events-none"><path d="M16 2L18.09 10.26L26 12L18.09 13.74L16 22L13.91 13.74L6 12L13.91 10.26L16 2Z" fill="#98c6d5"/></svg>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="absolute top-1 right-1 opacity-20 -rotate-12 pointer-events-none"><path d="M16 2L18.09 10.26L26 12L18.09 13.74L16 22L13.91 13.74L6 12L13.91 10.26L16 2Z" fill="#98c6d5"/></svg>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="absolute bottom-1 left-1 opacity-20 -rotate-6 pointer-events-none"><path d="M16 2L18.09 10.26L26 12L18.09 13.74L16 22L13.91 13.74L6 12L13.91 10.26L16 2Z" fill="#98c6d5"/></svg>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="absolute bottom-1 right-1 opacity-30 rotate-6 pointer-events-none"><path d="M16 2L18.09 10.26L26 12L18.09 13.74L16 22L13.91 13.74L6 12L13.91 10.26L16 2Z" fill="#98c6d5"/></svg>
        <div className="z-10 w-full max-w-xl text-center mx-auto">
          <h1 className="text-lg md:text-xl font-extrabold text-[#1877f3] mb-0.5 font-sans text-center">Welcome to Your CliniMedia Portal!</h1>
          <p className="text-gray-700 text-xs md:text-sm font-medium text-center mx-auto">
            We're excited to help your clinic shine. Here you can easily <span className="text-[#60a5fa] font-bold">book your next Media Day</span>, access your <span className="text-[#60a5fa] font-bold">professional photo galleries</span>, manage <span className="text-[#60a5fa] font-bold">invoices</span>, and track <span className="text-[#60a5fa] font-bold">onboarding tasks</span>, monitor your <span className="text-[#60a5fa] font-bold">Facebook and Google advertisements</span>—all in one place. Our team is here to support you every step of the way.
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Profile Section */}
        <div>
          <div className="flex flex-col md:flex-row items-center md:items-end gap-2 bg-white rounded-lg shadow p-3 h-full">
            {/* Logo or Profile Icon */}
            <div className="flex-shrink-0">
              {customer.customerSettings?.logoUrl ? (
                <img
                  src={`${import.meta.env.VITE_BACKEND_BASE_URL}${customer.customerSettings.logoUrl}`}
                  alt="Clinic Logo"
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#98c6d5] bg-white"
                />
              ) : (
                <UserCircleIcon className="w-12 h-12 text-[#98c6d5] bg-gray-100 rounded-full" />
              )}
            </div>
            <div className="flex-1 flex flex-col items-center md:items-start justify-center">
              <h2 className="text-base font-bold text-gray-900 mb-0 text-center md:text-left">
                {customer.name}
              </h2>
              {customer.email && (
                <div className="text-gray-500 text-[10px] mt-0.5 mb-0.5 text-center md:text-left">
                  {customer.email}
                </div>
              )}
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3 w-full justify-center md:justify-start mt-1">
                {customer.location && (
                  <div className="flex items-center gap-1 text-gray-600 text-xs">
                    <MapPinIcon className="w-3 h-3 text-[#98c6d5]" />
                    <span>{customer.location}</span>
                    {customer.address && (
                      <span className="ml-2 text-gray-500">| {customer.address}</span>
                    )}
                  </div>
                )}
                {customer.createdAt && (
                  <div className="text-gray-400 text-xs">
                    Member since {new Date(customer.createdAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Upcoming Media Day Section */}
        <div>
          <div className="bg-white rounded-lg shadow p-3 flex flex-col md:flex-row items-center gap-2 h-full">
            <div className="flex-1">
              <h3 className="text-sm font-bold mb-2" style={{ color: '#38bdf8' }}>Upcoming Media Day</h3>
              {upcomingMediaDay && upcomingMediaDay.status === 'pending' && (
                <div className="mb-2 flex items-center">
                  <span className="px-3 py-1 text-sm rounded-full bg-yellow-300 text-yellow-900 font-bold border-2 border-yellow-500 shadow-md animate-pulse">
                    Pending Approval
                  </span>
                </div>
              )}
              {upcomingMediaDay && upcomingMediaDay.status === 'accepted' && (
                <div className="mb-2 flex items-center">
                  <span className="px-3 py-1 text-sm rounded-full bg-green-200 text-green-900 font-bold border-2 border-green-500 shadow-md">
                    Approved
                  </span>
                </div>
              )}
              {isLoadingBookings ? (
                <div className="text-gray-500 text-sm">Loading...</div>
              ) : upcomingMediaDay !== null ? (
                <div className="flex flex-col gap-1 text-gray-700 text-sm">
                  <div className="flex items-center gap-2">
                    {/* Calendar Icon */}
                    <svg className="w-4 h-4 text-[#98c6d5]" fill="none" viewBox="0 0 24 24" stroke="#98c6d5" strokeWidth="2.2">
                      <rect x="3" y="5" width="18" height="16" rx="2" stroke="#98c6d5" strokeWidth="2.2" />
                      <path d="M8 3v4M16 3v4" stroke="#98c6d5" strokeWidth="2.2" strokeLinecap="round" />
                      <circle cx="12" cy="13" r="4" fill="#98c6d5" opacity="0.08" />
                    </svg>
                    <span>{upcomingMediaDay.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Clock Icon */}
                    <svg className="w-4 h-4 text-[#98c6d5]" fill="none" viewBox="0 0 24 24" stroke="#98c6d5" strokeWidth="2.2">
                      <circle cx="12" cy="12" r="9" stroke="#98c6d5" strokeWidth="2.2" />
                      <path d="M12 8v4.5l3 2.5" stroke="#98c6d5" strokeWidth="2.2" strokeLinecap="round" />
                      <circle cx="12" cy="12" r="4" fill="#98c6d5" opacity="0.08" />
                    </svg>
                    <span>{upcomingMediaDay.time}</span>
                  </div>
                </div>
              ) : hadMediaDayThisMonth ? (
                <div className="text-green-700 font-semibold text-sm">Media Day completed for this month. Book for next month!</div>
              ) : (
                <div className="text-gray-500 text-sm">No Media Day scheduled for this month. Book your next Media Day!</div>
              )}
            </div>
            <button
              onClick={() => navigate("/customer/media-day-booking")}
              className="bg-[#98c6d5] hover:bg-[#7bb3c4] text-white px-3 py-1.5 rounded-lg font-semibold text-xs shadow-md transition"
            >
              View/Request Booking
            </button>
          </div>
        </div>
        {/* Quick Actions Section (next row, spans both columns) */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-3">
            <h3 className="text-sm font-bold mb-3" style={{ color: '#14b8a6' }}>Quick Actions</h3>
            
            {/* Main Actions Section */}
            <div className="mb-4">
              <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">Main Actions</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {/* Media Day Calendar */}
                <button
                  onClick={() => navigate("/customer/media-day-booking")}
                  className="flex flex-col items-center p-2.5 bg-[#fef3c7] rounded-lg hover:bg-[#fde68a] transition relative shadow-sm hover:shadow-md"
                >
                  <FaCalendarAlt className="w-5 h-5 text-[#f59e0b] mb-1" />
                  <span className="font-medium text-gray-800 text-[10px] text-center leading-tight">Media Day Calendar</span>
                </button>
                {/* Onboarding Tasks */}
                <button
                  onClick={() => navigate("/customer/onboarding-tasks")}
                  className="flex flex-col items-center p-2.5 bg-[#e0f2fe] rounded-lg hover:bg-[#bae6fd] transition relative shadow-sm hover:shadow-md"
                >
                  {unreadCounts.onboarding > 0 && (
                    <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold leading-none text-white bg-red-600 rounded-full">
                      {unreadCounts.onboarding}
                    </span>
                  )}
                  <FaTasks className="w-5 h-5 text-[#3b82f6] mb-1" />
                  <span className="font-medium text-gray-800 text-[10px] text-center leading-tight">Onboarding Tasks</span>
                </button>
                {/* View Media (Gallery) */}
                <button
                  onClick={() => navigate("/customer/gallery")}
                  className="flex flex-col items-center p-2.5 bg-[#d1fae5] rounded-lg hover:bg-[#6ee7b7] transition relative shadow-sm hover:shadow-md"
                >
                  {unreadCounts.gallery > 0 && (
                    <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold leading-none text-white bg-red-600 rounded-full">
                      {unreadCounts.gallery}
                    </span>
                  )}
                  <FaImages className="w-5 h-5 text-[#22c55e] mb-1" />
                  <span className="font-medium text-gray-800 text-[10px] text-center leading-tight">View Media</span>
                </button>
                {/* Share Your Media */}
                <button
                  onClick={() => navigate("/customer/shared-media")}
                  className="flex flex-col items-center p-2.5 bg-[#e0f2fe] rounded-lg hover:bg-[#bae6fd] transition relative shadow-sm hover:shadow-md"
                >
                  <FaShare className="w-5 h-5 text-[#0ea5e9] mb-1" />
                  <span className="font-medium text-gray-800 text-[10px] text-center leading-tight">Share Your Media</span>
                </button>
                {/* QuickBooks Invoices */}
                <button
                  onClick={() => navigate("/customer/quickbooks-invoices")}
                  className="flex flex-col items-center p-2.5 bg-[#dbeafe] rounded-lg hover:bg-[#bfdbfe] transition relative shadow-sm hover:shadow-md"
                >
                  {unpaidInvoicesCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold leading-none text-white bg-red-600 rounded-full">
                      {unpaidInvoicesCount}
                    </span>
                  )}
                  <FaDollarSign className="w-5 h-5 text-[#2563eb] mb-1" />
                  <span className="font-medium text-gray-800 text-[10px] text-center leading-tight">QuickBooks Invoices</span>
                </button>
              </div>
            </div>

            {/* Marketing & Insights Section */}
            <div className="mb-4">
              <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">Marketing & Insights</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {/* Meta Insights (Facebook Insights) */}
                <button
                  onClick={() => navigate("/customer/facebook-insights")}
                  className="flex flex-col items-center p-2.5 bg-[#e7f0fd] rounded-lg hover:bg-[#c7e0fa] transition relative shadow-sm hover:shadow-md"
                >
                  {unreadCounts.metaInsights > 0 && (
                    <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold leading-none text-white bg-red-600 rounded-full">
                      {unreadCounts.metaInsights}
                    </span>
                  )}
                  <FaFacebook className="w-5 h-5 text-[#1877f3] mb-1" />
                  <span className="font-medium text-gray-800 text-[10px] text-center leading-tight">Meta Insights</span>
                </button>
                {/* Google Ads */}
                <button
                  onClick={() => navigate("/customer/google-ads")}
                  className="flex flex-col items-center p-2.5 bg-[#fef3c7] rounded-lg hover:bg-[#fde68a] transition relative shadow-sm hover:shadow-md"
                >
                  <FaGoogle className="w-5 h-5 text-[#ea4335] mb-1" />
                  <span className="font-medium text-gray-800 text-[10px] text-center leading-tight">Google Ads</span>
                </button>
                {/* Google Business */}
                <button
                  onClick={() => navigate("/customer/google-business-analytics")}
                  className="flex flex-col items-center p-2.5 bg-[#fef3c7] rounded-lg hover:bg-[#fde68a] transition relative shadow-sm hover:shadow-md"
                >
                  <FaGoogle className="w-5 h-5 text-[#4285f4] mb-1" />
                  <span className="font-medium text-gray-800 text-[10px] text-center leading-tight">Google Business</span>
                </button>
                {/* Instagram Insights */}
                <button
                  onClick={() => navigate("/customer/instagram-insights")}
                  className="flex flex-col items-center p-2.5 bg-[#fce7f3] rounded-lg hover:bg-[#fbcfe8] transition relative shadow-sm hover:shadow-md"
                >
                  {unreadCounts.instagramInsights > 0 && (
                    <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold leading-none text-white bg-red-600 rounded-full">
                      {unreadCounts.instagramInsights}
                    </span>
                  )}
                  <FaInstagram className="w-5 h-5 text-[#e4405f] mb-1" />
                  <span className="font-medium text-gray-800 text-[10px] text-center leading-tight">Instagram Insights</span>
                </button>
              </div>
            </div>

            {/* Tracking Section - HIGHLIGHTED */}
            <div className="bg-gradient-to-br from-[#eff6ff] via-[#dbeafe] to-[#bfdbfe] rounded-lg p-3 border-2 border-[#3b82f6] shadow-lg">
              <div className="mb-2">
                <h4 className="text-xs font-bold text-[#1e40af] uppercase tracking-wider px-1">
                  Tracking
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {/* Call Logs */}
                <button
                  onClick={() => navigate("/customer/call-logs")}
                  className="flex flex-col items-center p-2.5 bg-white rounded-lg hover:bg-[#eff6ff] transition relative shadow-md hover:shadow-lg border border-[#3b82f6]"
                >
                  <FaPhone className="w-5 h-5 text-[#6b7280] mb-1" />
                  <span className="font-semibold text-gray-800 text-[10px] text-center leading-tight">Call Logs</span>
                </button>
                {/* Meta Leads */}
                <button
                  onClick={() => navigate("/customer/meta-leads")}
                  className="flex flex-col items-center p-2.5 bg-white rounded-lg hover:bg-[#eff6ff] transition relative shadow-md hover:shadow-lg border border-[#3b82f6]"
                >
                  {unreadCounts.metaLeads > 0 && (
                    <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold leading-none text-white bg-red-600 rounded-full">
                      {unreadCounts.metaLeads}
                    </span>
                  )}
                  <FaFacebook className="w-5 h-5 text-[#1877f3] mb-1" />
                  <span className="font-semibold text-gray-800 text-[10px] text-center leading-tight">Meta Leads</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard; 