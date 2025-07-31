import React from "react";
import { useNavigate } from "react-router-dom";
import NotificationCenter from "../../Customer/NotificationCenter";
import { useEmployeeDashboard, Employee } from "./EmployeeDashLogic";
import { UserCircleIcon, CalendarIcon, ClockIcon, MapPinIcon, BellIcon } from '@heroicons/react/24/solid';

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const { employee, loading, error, handleLogout, acceptedBookings, isLoadingBookings, availableBookingsCount } = useEmployeeDashboard();

  const handleLogoutAndNavigate = () => {
    handleLogout();
    navigate("/login");
  };

  // Get the next media day date (only show if there are actual accepted bookings)
  const getNextMediaDayInfo = () => {
    if (isLoadingBookings) {
      return { isLoading: true, hasSession: false };
    }
    
    if (acceptedBookings && acceptedBookings.length > 0) {
      const nextSession = acceptedBookings[0];
      const dateObj = new Date(nextSession.date);
      return {
        isLoading: false,
        hasSession: true,
        date: dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        time: dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        customer: nextSession.customer?.name || 'N/A',
        location: nextSession.customer?.location
      };
    }
    
    // If no accepted bookings, return null to show "No upcoming photography session scheduled"
    return {
      isLoading: false,
      hasSession: false,
      date: null,
      time: null,
      customer: null,
      location: null
    };
  };

  const nextMediaDay = getNextMediaDayInfo();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#98c6d5] mx-auto mb-2"></div>
          <p className="text-gray-600 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-3 text-sm">
            {error}
          </div>
          <button
            onClick={() => navigate("/login")}
            className="bg-[#98c6d5] hover:bg-blue-700 text-white px-3 py-2 rounded text-sm"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-3 text-sm">No employee data found.</p>
          <button
            onClick={() => navigate("/login")}
            className="bg-[#98c6d5] hover:bg-blue-700 text-white px-3 py-2 rounded text-sm"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f9fafb] via-[#f3f4f6] to-[#e5e7eb] py-4">
      <div className="max-w-6xl mx-auto px-2 py-4">
        {/* Page Title */}
        <div className="mb-4 text-center">
          <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-[#38bdf8] via-[#60a5fa] to-[#1877f3] bg-clip-text text-transparent mb-2 font-sans text-center">Welcome to your CliniMedia Portal</h1>
        </div>
        {/* Intro Box */}
        <div className="bg-gradient-to-br from-[#e0f2fe] to-[#f8fafc] rounded-xl shadow-lg p-6 border border-[#e0e7ef] mb-4 relative overflow-hidden flex items-center justify-center min-h-[120px] max-w-4xl mx-auto">
          {/* Decorative Sparkles in Corners */}
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" className="absolute top-1 left-1 opacity-30 rotate-12 pointer-events-none"><path d="M16 2L18.09 10.26L26 12L18.09 13.74L16 22L13.91 13.74L6 12L13.91 10.26L16 2Z" fill="#98c6d5"/></svg>
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" className="absolute top-1 right-1 opacity-20 -rotate-12 pointer-events-none"><path d="M16 2L18.09 10.26L26 12L18.09 13.74L16 22L13.91 13.74L6 12L13.91 10.26L16 2Z" fill="#98c6d5"/></svg>
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" className="absolute bottom-1 left-1 opacity-20 -rotate-6 pointer-events-none"><path d="M16 2L18.09 10.26L26 12L18.09 13.74L16 22L13.91 13.74L6 12L13.91 10.26L16 2Z" fill="#98c6d5"/></svg>
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" className="absolute bottom-1 right-1 opacity-30 rotate-6 pointer-events-none"><path d="M16 2L18.09 10.26L26 12L18.09 13.74L16 22L13.91 13.74L6 12L13.91 10.26L16 2Z" fill="#98c6d5"/></svg>
          <div className="z-10 w-full max-w-2xl text-center mx-auto">
            <div className="text-center mx-auto">
              <div className="text-gray-700 text-sm md:text-base font-medium font-sans leading-relaxed max-w-3xl mx-auto">
                We're glad to have you on board. This is your space to <span className='text-[#60a5fa] font-semibold'>view and accept upcoming photography sessions</span>, <span className='text-[#60a5fa] font-semibold'>track your bookings</span>, and <span className='text-[#60a5fa] font-semibold'>access payment receipts</span>, all in one place. Each session is a chance to capture meaningful moments and help clinics tell their story through your lens.
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {/* Profile Section */}
          <div>
            <div className="flex flex-col md:flex-row items-center justify-center gap-3 bg-white rounded-lg shadow p-4 h-full mx-auto">
              {/* Avatar or Profile Icon */}
              <div className="flex-shrink-0">
                <UserCircleIcon className="w-12 h-12 text-[#98c6d5] bg-gray-100 rounded-full" />
              </div>
              <div className="flex flex-col items-start justify-center text-left">
                <h2 className="text-lg font-bold text-gray-900 mb-0">
                  {employee.name}
                </h2>
                {employee.email && (
                  <div className="text-gray-500 text-xs mt-0.5 mb-1">
                    {employee.email}
                  </div>
                )}
                <div className="flex flex-col gap-0.5 w-full items-start justify-center mt-1">
                  <div className="flex items-center gap-1 text-gray-600 text-xs">
                    <span className="font-semibold">Department:</span> {employee.department.charAt(0).toUpperCase() + employee.department.slice(1)}
                  </div>
                  <div className="text-gray-400 text-xs mt-0.5">
                    Member since {('createdAt' in employee && employee.createdAt) ? new Date((employee as any).createdAt).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Next Media Day Section */}
          <div>
            <div className="bg-white rounded-lg shadow p-4 flex flex-col md:flex-row items-center gap-4 h-full">
              <div className="flex-1">
                <h3 className="text-base font-bold mb-2" style={{ color: '#38bdf8' }}>Next Media Day</h3>
                {nextMediaDay.isLoading ? (
                  <div className="text-gray-500 text-sm">Loading...</div>
                ) : nextMediaDay.hasSession ? (
                  <div className="flex flex-col gap-1 text-gray-700 text-sm">
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="w-4 h-4 text-[#98c6d5]" />
                      <span>{nextMediaDay.date}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ClockIcon className="w-4 h-4 text-[#98c6d5]" />
                      <span>{nextMediaDay.time}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <UserCircleIcon className="w-4 h-4 text-[#98c6d5]" />
                      <span className="font-semibold">Client:</span>
                      <span>{nextMediaDay.customer}</span>
                    </div>
                    {nextMediaDay.location && (
                      <div className="flex items-center gap-1">
                        <MapPinIcon className="w-4 h-4 text-[#98c6d5]" />
                        <span className="font-semibold">Location:</span>
                        <span>{nextMediaDay.location}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 text-gray-700 text-sm">
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="w-4 h-4 text-[#98c6d5]" />
                      <span>No upcoming photography session scheduled.</span>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => navigate("/employee/media-day-calendar")}
                className="bg-[#98c6d5] hover:bg-[#7bb3c4] text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-md transition"
              >
                View Calendar
              </button>
            </div>
          </div>
        </div>
        {/* Quick Actions Section */}
        <div className="flex justify-center mt-4">
          <div className="bg-white rounded-lg shadow p-4 max-w-md w-full mx-auto">
            <h3 className="text-base font-bold mb-3 text-center" style={{ color: '#14b8a6' }}>Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {/* Photography Session Booking - blue */}
              <button
                onClick={() => navigate("/employee/media-day-calendar")}
                className="flex flex-col items-center p-3 bg-[#e0f2fe] rounded-lg hover:bg-[#bae6fd] transition relative"
              >
                <CalendarIcon className="w-6 h-6 text-[#3b82f6] mb-1" />
                <span className="font-medium text-gray-800 text-xs">Photography Session Booking</span>
                {availableBookingsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] flex items-center justify-center">
                    {availableBookingsCount}
                  </span>
                )}
              </button>
              {/* Payment Receipt - red */}
              <button
                onClick={() => navigate("/employee/payment-receipt")}
                className="flex flex-col items-center p-3 bg-[#fee2e2] rounded-lg hover:bg-[#fca5a5] transition"
              >
                <svg className="w-6 h-6 text-[#ef4444] mb-1" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="1.5">
                  <rect x="5" y="3" width="14" height="18" rx="2" stroke="#ef4444" strokeWidth="1.5" />
                  <path d="M9 7h6M9 11h6M9 15h3" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="font-medium text-gray-800 text-xs">Payment Receipt</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard; 