import React from "react";
import { useNavigate } from "react-router-dom";
import NotificationCenter from "../../Customer/NotificationCenter";
import { useEmployeeDashboard, Employee } from "./EmployeeDashLogic";
import { UserCircleIcon, CalendarIcon, ClockIcon, MapPinIcon } from '@heroicons/react/24/solid';

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const { employee, loading, error, handleLogout, acceptedBookings, isLoadingBookings } = useEmployeeDashboard();

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

  if (!employee) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No employee data found.</p>
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
    <div className="min-h-screen bg-gradient-to-br from-[#f9fafb] via-[#f3f4f6] to-[#e5e7eb] py-8">
      <div className="max-w-6xl mx-auto px-2 py-8">
        {/* Page Title */}
        <div className="mb-6 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-[#38bdf8] via-[#60a5fa] to-[#1877f3] bg-clip-text text-transparent mb-4 font-sans text-center">Welcome to your CliniMedia Portal</h1>
        </div>
        {/* Intro Box */}
        <div className="bg-gradient-to-br from-[#e0f2fe] to-[#f8fafc] rounded-2xl shadow-lg p-12 border border-[#e0e7ef] mb-8 relative overflow-hidden flex items-center justify-center min-h-[240px] max-w-5xl mx-auto">
          {/* Decorative Sparkles in Corners */}
          <svg width="40" height="40" viewBox="0 0 32 32" fill="none" className="absolute top-2 left-2 opacity-30 rotate-12 pointer-events-none"><path d="M16 2L18.09 10.26L26 12L18.09 13.74L16 22L13.91 13.74L6 12L13.91 10.26L16 2Z" fill="#98c6d5"/></svg>
          <svg width="40" height="40" viewBox="0 0 32 32" fill="none" className="absolute top-2 right-2 opacity-20 -rotate-12 pointer-events-none"><path d="M16 2L18.09 10.26L26 12L18.09 13.74L16 22L13.91 13.74L6 12L13.91 10.26L16 2Z" fill="#98c6d5"/></svg>
          <svg width="40" height="40" viewBox="0 0 32 32" fill="none" className="absolute bottom-2 left-2 opacity-20 -rotate-6 pointer-events-none"><path d="M16 2L18.09 10.26L26 12L18.09 13.74L16 22L13.91 13.74L6 12L13.91 10.26L16 2Z" fill="#98c6d5"/></svg>
          <svg width="40" height="40" viewBox="0 0 32 32" fill="none" className="absolute bottom-2 right-2 opacity-30 rotate-6 pointer-events-none"><path d="M16 2L18.09 10.26L26 12L18.09 13.74L16 22L13.91 13.74L6 12L13.91 10.26L16 2Z" fill="#98c6d5"/></svg>
          <div className="z-10 w-full max-w-2xl text-center mx-auto">
            <div className="text-center mx-auto">
              <div className="text-gray-700 text-lg md:text-xl font-medium font-sans leading-relaxed md:leading-8 max-w-3xl mx-auto">
                We’re glad to have you on board. This is your space to <span className='text-[#60a5fa] font-semibold'>view and accept upcoming photography sessions</span>, <span className='text-[#60a5fa] font-semibold'>track your bookings</span>, and <span className='text-[#60a5fa] font-semibold'>access payment receipts</span>, all in one place. Each session is a chance to capture meaningful moments and help clinics tell their story through your lens.
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 max-w-5xl mx-auto">
          {/* Profile Section */}
          <div>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 bg-white rounded-xl shadow p-6 h-full mx-auto">
              {/* Avatar or Profile Icon */}
              <div className="flex-shrink-0">
                <UserCircleIcon className="w-20 h-20 text-[#98c6d5] bg-gray-100 rounded-full" />
              </div>
              <div className="flex flex-col items-start justify-center text-left">
                <h2 className="text-2xl font-bold text-gray-900 mb-0">
                  {employee.name}
                </h2>
                {employee.email && (
                  <div className="text-gray-500 text-sm mt-0.5 mb-1">
                    {employee.email}
                  </div>
                )}
                <div className="flex flex-col gap-1 w-full items-start justify-center mt-1">
                  <div className="flex items-center gap-1 text-gray-600 text-sm">
                    <span className="font-semibold">Department:</span> {employee.department.charAt(0).toUpperCase() + employee.department.slice(1)}
                  </div>
                  <div className="text-gray-400 text-xs md:text-sm mt-1">
                    Member since {('createdAt' in employee && employee.createdAt) ? new Date((employee as any).createdAt).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Upcoming Photography Session Section */}
          <div>
            <div className="bg-white rounded-xl shadow p-6 flex flex-col md:flex-row items-center gap-6 h-full">
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-4" style={{ color: '#38bdf8' }}>Upcoming Photography Session</h3>
                {isLoadingBookings ? (
                  <div className="text-gray-500">Loading...</div>
                ) : acceptedBookings && acceptedBookings.length > 0 ? (
                  (() => {
                    const nextSession = acceptedBookings[0];
                    const dateObj = new Date(nextSession.date);
                    return (
                      <div className="flex flex-col gap-2 text-gray-700">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-6 h-6 text-[#98c6d5]" />
                          <span>{dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ClockIcon className="w-6 h-6 text-[#98c6d5]" />
                          <span>{dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <UserCircleIcon className="w-5 h-5 text-[#98c6d5]" />
                          <span className="font-semibold">Client:</span>
                          <span>{nextSession.customer?.name || 'N/A'}</span>
                        </div>
                        {nextSession.customer?.location && (
                          <div className="flex items-center gap-2">
                            <MapPinIcon className="w-5 h-5 text-[#98c6d5]" />
                            <span className="font-semibold">Location:</span>
                            <span>{nextSession.customer.location}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex flex-col gap-2 text-gray-700">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-6 h-6 text-[#98c6d5]" />
                      <span>No upcoming photography session scheduled.</span>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => navigate("/employee/media-day-calendar")}
                className="bg-[#98c6d5] hover:bg-[#7bb3c4] text-white px-6 py-3 rounded-lg font-semibold text-lg shadow-md transition"
              >
                View Calendar
              </button>
            </div>
          </div>
          {/* Quick Actions Section (next row, spans both columns) */}
          <div className="lg:col-span-2 flex justify-center">
            <div className="bg-white rounded-xl shadow p-8 max-w-xl w-full mx-auto">
              <h3 className="text-lg font-bold mb-4 text-center" style={{ color: '#14b8a6' }}>Quick Actions</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Media Day Calendar - blue */}
                <button
                  onClick={() => navigate("/employee/media-day-calendar")}
                  className="flex flex-col items-center p-4 bg-[#e0f2fe] rounded-lg hover:bg-[#bae6fd] transition"
                >
                  <CalendarIcon className="w-8 h-8 text-[#3b82f6] mb-2" />
                  <span className="font-medium text-gray-800">Media Day Calendar</span>
                </button>
                {/* Payment Receipt - red */}
                <button
                  onClick={() => navigate("/employee/payment-receipt")}
                  className="flex flex-col items-center p-4 bg-[#fee2e2] rounded-lg hover:bg-[#fca5a5] transition"
                >
                  <svg className="w-8 h-8 text-[#ef4444] mb-2" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="1.5">
                    <rect x="5" y="3" width="14" height="18" rx="2" stroke="#ef4444" strokeWidth="1.5" />
                    <path d="M9 7h6M9 11h6M9 15h3" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span className="font-medium text-gray-800">Payment Receipt</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard; 