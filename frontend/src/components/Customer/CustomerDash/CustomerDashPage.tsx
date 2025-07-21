import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomerDashboard, Customer } from "./CustomerDashLogic";
import { UserCircleIcon, MapPinIcon, CheckCircleIcon } from '@heroicons/react/24/solid';
import axios from 'axios';
import { API_BASE_URL, BACKEND_BASE_URL } from '../../../utils/api';

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

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const token = localStorage.getItem('customerToken');
        if (!token) return;
        const response = await axios.get(`${API_BASE_URL}/bookings/my-bookings`, {
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
    <div className="max-w-6xl mx-auto px-2 py-8">
      {/* Intro Box */}
      <div className="bg-gradient-to-br from-[#e0f2fe] to-[#f8fafc] rounded-2xl shadow-lg p-6 border border-[#e0e7ef] mb-6 relative overflow-hidden flex items-center justify-center min-h-[170px]">
        {/* Decorative Sparkles in Corners */}
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none" className="absolute top-2 left-2 opacity-30 rotate-12 pointer-events-none"><path d="M16 2L18.09 10.26L26 12L18.09 13.74L16 22L13.91 13.74L6 12L13.91 10.26L16 2Z" fill="#98c6d5"/></svg>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none" className="absolute top-2 right-2 opacity-20 -rotate-12 pointer-events-none"><path d="M16 2L18.09 10.26L26 12L18.09 13.74L16 22L13.91 13.74L6 12L13.91 10.26L16 2Z" fill="#98c6d5"/></svg>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none" className="absolute bottom-2 left-2 opacity-20 -rotate-6 pointer-events-none"><path d="M16 2L18.09 10.26L26 12L18.09 13.74L16 22L13.91 13.74L6 12L13.91 10.26L16 2Z" fill="#98c6d5"/></svg>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none" className="absolute bottom-2 right-2 opacity-30 rotate-6 pointer-events-none"><path d="M16 2L18.09 10.26L26 12L18.09 13.74L16 22L13.91 13.74L6 12L13.91 10.26L16 2Z" fill="#98c6d5"/></svg>
        <div className="z-10 w-full max-w-2xl text-center mx-auto">
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#1877f3] mb-1 font-sans text-center">Welcome to Your CliniMedia Portal!</h1>
          <p className="text-gray-700 text-base md:text-lg font-medium text-center mx-auto">
            We're excited to help your clinic shine. Here you can easily <span className="text-[#60a5fa] font-semibold">book your next Media Day</span>, access your <span className="text-[#60a5fa] font-semibold">professional photo galleries</span>, manage <span className="text-[#60a5fa] font-semibold">invoices</span>, and track <span className="text-[#60a5fa] font-semibold">onboarding tasks</span>, <span className="text-[#60a5fa] font-semibold">monitor the performance of your Facebook and Google advertisements</span>—all in one place. Our team is here to support you every step of the way. Let's make your brand stand out!
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Section */}
        <div>
          <div className="flex flex-col md:flex-row items-center md:items-end gap-4 bg-white rounded-xl shadow p-6 h-full">
            {/* Logo or Profile Icon */}
            <div className="flex-shrink-0">
              {customer.customerSettings?.logoUrl ? (
                <img
                  src={BACKEND_BASE_URL + customer.customerSettings.logoUrl}
                  alt="Clinic Logo"
                  className="w-20 h-20 rounded-full object-cover border-2 border-[#98c6d5] bg-white"
                />
              ) : (
                <UserCircleIcon className="w-20 h-20 text-[#98c6d5] bg-gray-100 rounded-full" />
              )}
            </div>
            <div className="flex-1 flex flex-col items-center md:items-start justify-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-0 text-center md:text-left">
                {customer.name}
              </h2>
              {customer.email && (
                <div className="text-gray-500 text-sm mt-0.5 mb-1 text-center md:text-left">
                  {customer.email}
                </div>
              )}
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 w-full justify-center md:justify-start mt-1">
                {customer.location && (
                  <div className="flex items-center gap-1 text-gray-600 text-sm">
                    <MapPinIcon className="w-4 h-4 text-[#98c6d5]" />
                    <span>{customer.location}</span>
                    {customer.address && (
                      <span className="ml-2 text-gray-500">| {customer.address}</span>
                    )}
                  </div>
                )}
                {customer.createdAt && (
                  <div className="text-gray-400 text-xs md:text-sm">
                    Member since {new Date(customer.createdAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Upcoming Media Day Section */}
        <div>
          <div className="bg-white rounded-xl shadow p-6 flex flex-col md:flex-row items-center gap-6 h-full">
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-4" style={{ color: '#38bdf8' }}>Upcoming Media Day</h3>
              {upcomingMediaDay && upcomingMediaDay.status === 'pending' && (
                <div className="mb-2 flex items-center">
                  <span className="px-4 py-2 text-lg rounded-full bg-yellow-300 text-yellow-900 font-extrabold border-2 border-yellow-500 shadow-md animate-pulse">
                    Pending Approval
                  </span>
                </div>
              )}
              {upcomingMediaDay && upcomingMediaDay.status === 'accepted' && (
                <div className="mb-2 flex items-center">
                  <span className="px-4 py-2 text-lg rounded-full bg-green-200 text-green-900 font-extrabold border-2 border-green-500 shadow-md">
                    Approved
                  </span>
                </div>
              )}
              {isLoadingBookings ? (
                <div className="text-gray-500">Loading...</div>
              ) : upcomingMediaDay !== null ? (
                <div className="flex flex-col gap-2 text-gray-700">
                  <div className="flex items-center gap-2">
                    {/* Calendar Icon */}
                    <svg className="w-6 h-6 text-[#98c6d5]" fill="none" viewBox="0 0 24 24" stroke="#98c6d5" strokeWidth="2.2">
                      <rect x="3" y="5" width="18" height="16" rx="2" stroke="#98c6d5" strokeWidth="2.2" />
                      <path d="M8 3v4M16 3v4" stroke="#98c6d5" strokeWidth="2.2" strokeLinecap="round" />
                      <circle cx="12" cy="13" r="4" fill="#98c6d5" opacity="0.08" />
                    </svg>
                    <span>{upcomingMediaDay.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Clock Icon */}
                    <svg className="w-6 h-6 text-[#98c6d5]" fill="none" viewBox="0 0 24 24" stroke="#98c6d5" strokeWidth="2.2">
                      <circle cx="12" cy="12" r="9" stroke="#98c6d5" strokeWidth="2.2" />
                      <path d="M12 8v4.5l3 2.5" stroke="#98c6d5" strokeWidth="2.2" strokeLinecap="round" />
                      <circle cx="12" cy="12" r="4" fill="#98c6d5" opacity="0.08" />
                    </svg>
                    <span>{upcomingMediaDay.time}</span>
                  </div>
                </div>
              ) : hadMediaDayThisMonth ? (
                <div className="text-green-700 font-semibold">Media Day completed for this month. Book for next month!</div>
              ) : (
                <div className="text-gray-500">No Media Day scheduled for this month. Book your next Media Day!</div>
              )}
            </div>
            <button
              onClick={() => navigate("/customer/media-day-booking")}
              className="bg-[#98c6d5] hover:bg-[#7bb3c4] text-white px-6 py-3 rounded-lg font-semibold text-lg shadow-md transition"
            >
              {upcomingMediaDay ? "View Bookings" : "Book Media Day"}
            </button>
          </div>
        </div>
        {/* Quick Actions Section (next row, spans both columns) */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-lg font-bold mb-4" style={{ color: '#14b8a6' }}>Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Meta Insights - Meta logo */}
              <button
                onClick={() => navigate("/customer/facebook-insights")}
                className="flex flex-col items-center p-4 bg-[#e7f0fd] rounded-lg hover:bg-[#c7e0fa] transition"
              >
                {/* Meta SVG Logo */}
                <svg className="w-8 h-8 mb-2" viewBox="0 0 40 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10.5 19C13.5 7 26.5 7 29.5 19" stroke="#1877f3" strokeWidth="2.5" strokeLinecap="round"/>
                  <ellipse cx="10.5" cy="19" rx="4.5" ry="4" stroke="#1877f3" strokeWidth="2.5"/>
                  <ellipse cx="29.5" cy="19" rx="4.5" ry="4" stroke="#1877f3" strokeWidth="2.5"/>
                </svg>
                <span className="font-medium text-gray-800">Meta Insights</span>
              </button>
              {/* Gallery - green */}
              <button
                onClick={() => navigate("/customer/gallery")}
                className="flex flex-col items-center p-4 bg-[#d1fae5] rounded-lg hover:bg-[#6ee7b7] transition"
              >
                <svg className="w-8 h-8 text-[#22c55e] mb-2" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth="1.5">
                  <rect x="3" y="7" width="18" height="12" rx="2" stroke="#22c55e" strokeWidth="1.5" />
                  <circle cx="12" cy="13" r="3" stroke="#22c55e" strokeWidth="1.5" />
                  <rect x="8" y="3" width="8" height="4" rx="1.5" stroke="#22c55e" strokeWidth="1.5" />
                </svg>
                <span className="font-medium text-gray-800">Gallery</span>
              </button>
              {/* Invoices - red */}
              <button
                onClick={() => navigate("/customer/invoices")}
                className="flex flex-col items-center p-4 bg-[#fee2e2] rounded-lg hover:bg-[#fca5a5] transition"
              >
                <svg className="w-8 h-8 text-[#ef4444] mb-2" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="1.5">
                  <rect x="5" y="3" width="14" height="18" rx="2" stroke="#ef4444" strokeWidth="1.5" />
                  <path d="M9 7h6M9 11h6M9 15h3" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="font-medium text-gray-800">Invoices</span>
              </button>
              {/* Onboarding - blue */}
              <button
                onClick={() => navigate("/customer/onboarding-tasks")}
                className="flex flex-col items-center p-4 bg-[#e0f2fe] rounded-lg hover:bg-[#bae6fd] transition"
              >
                <svg className="w-8 h-8 text-[#3b82f6] mb-2" fill="none" viewBox="0 0 24 24" stroke="#3b82f6" strokeWidth="1.5">
                  <rect x="4" y="4" width="16" height="16" rx="4" stroke="#3b82f6" strokeWidth="1.5" />
                  <path d="M8 12l3 3 5-5" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="font-medium text-gray-800">Onboarding</span>
              </button>
            </div>
            {/* Second row for Google Integration - Coming Soon */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="flex flex-col items-center p-4 bg-[#fef9c3] rounded-lg opacity-60 cursor-not-allowed border-2 border-dashed border-[#fbbf24]">
                <svg className="w-8 h-8 text-[#fbbf24] mb-2" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth="1.5">
                  <path d="M4 17a8 8 0 0116 0" stroke="#fbbf24" strokeWidth="1.5" fill="none" />
                  <circle cx="12" cy="17" r="1.5" stroke="#fbbf24" strokeWidth="1.5" fill="none" />
                  <path d="M12 17l4-4" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M8 13a4 4 0 018 0" stroke="#fbbf24" strokeWidth="1.5" fill="none" />
                </svg>
                <span className="font-medium text-gray-800">Google Integration</span>
                <span className="text-xs text-gray-500 mt-1">Coming Soon</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard; 