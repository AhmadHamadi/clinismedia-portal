import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useEmployeeDashboard, Employee } from "./EmployeeDashLogic";
import { UserCircleIcon, CalendarIcon, ClockIcon, MapPinIcon } from '@heroicons/react/24/solid';

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const { employee, loading, error, handleLogout, acceptedBookings, isLoadingBookings } = useEmployeeDashboard();
  const [availableSessionsCount, setAvailableSessionsCount] = useState(0);

  // Fetch available photography sessions count
  useEffect(() => {
    const fetchAvailableSessionsCount = async () => {
      try {
        const token = localStorage.getItem('employeeToken');
        if (!token) return;

        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/bookings/employee`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        // Count accepted bookings without photographers (available for claiming)
        const availableCount = response.data.filter((booking: any) => 
          booking.status === 'accepted' && !booking.photographer
        ).length;
        
        setAvailableSessionsCount(availableCount);
      } catch (error) {
        console.error('Failed to fetch available sessions count:', error);
      }
    };

    fetchAvailableSessionsCount();
    // Poll every 5 seconds for real-time updates
    const interval = setInterval(fetchAvailableSessionsCount, 5000);
    
    // Listen for refresh events from media day booking
    const handleRefreshNotifications = () => {
      fetchAvailableSessionsCount();
    };
    window.addEventListener('refreshEmployeeNotifications', handleRefreshNotifications);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('refreshEmployeeNotifications', handleRefreshNotifications);
    };
  }, []);

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
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Intro Box */}
      <div className="bg-gradient-to-br from-[#e0f2fe] to-[#f8fafc] rounded-xl shadow-lg p-4 border border-[#e0e7ef] mb-4 relative overflow-hidden flex items-center justify-center min-h-[140px]">
        {/* Decorative Sparkles in Corners */}
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="absolute top-1 left-1 opacity-30 rotate-12 pointer-events-none">
          <path d="M16 2L18.09 10.26L26 12L18.09 13.74L16 22L13.91 13.74L6 12L13.91 10.26L16 2Z" fill="#98c6d5"/>
        </svg>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="absolute top-1 right-1 opacity-20 -rotate-12 pointer-events-none">
          <path d="M16 2L18.09 10.26L26 12L18.09 13.74L16 22L13.91 13.74L6 12L13.91 10.26L16 2Z" fill="#98c6d5"/>
        </svg>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="absolute bottom-1 left-1 opacity-20 -rotate-6 pointer-events-none">
          <path d="M16 2L18.09 10.26L26 12L18.09 13.74L16 22L13.91 13.74L6 12L13.91 10.26L16 2Z" fill="#98c6d5"/>
        </svg>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="absolute bottom-1 right-1 opacity-30 rotate-6 pointer-events-none">
          <path d="M16 2L18.09 10.26L26 12L18.09 13.74L16 22L13.91 13.74L6 12L13.91 10.26L16 2Z" fill="#98c6d5"/>
        </svg>
        <div className="z-10 w-full max-w-xl text-center mx-auto">
          <h1 className="text-xl md:text-2xl font-extrabold text-[#1877f3] mb-1 font-sans text-center">Welcome to Your CliniMedia Portal!</h1>
          <p className="text-gray-700 text-sm md:text-base font-medium text-center mx-auto">
            We're glad to have you on board. This is your space to <span className="text-[#60a5fa] font-bold">view and accept upcoming photography sessions</span>, <span className="text-[#60a5fa] font-bold">track your bookings</span>, and <span className="text-[#60a5fa] font-bold">access payment receipts</span>, all in one place. Each session is a chance to capture meaningful moments and help clinics tell their story through your lens.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Profile Section */}
        <div>
          <div className="flex flex-col md:flex-row items-center md:items-end gap-3 bg-white rounded-lg shadow p-4 h-full">
            {/* Avatar or Profile Icon */}
            <div className="flex-shrink-0">
              <UserCircleIcon className="w-16 h-16 text-[#98c6d5] bg-gray-100 rounded-full" />
            </div>
            <div className="flex-1 flex flex-col items-center md:items-start justify-center">
              <h2 className="text-xl font-bold text-gray-900 mb-0 text-center md:text-left">
                {employee.name}
              </h2>
              {employee.email && (
                <div className="text-gray-500 text-xs mt-0.5 mb-1 text-center md:text-left">
                  {employee.email}
                </div>
              )}
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3 w-full justify-center md:justify-start mt-1">
                <div className="flex items-center gap-1 text-gray-600 text-xs">
                  <span className="font-semibold">Department:</span> {employee.department.charAt(0).toUpperCase() + employee.department.slice(1)}
                </div>
                {('createdAt' in employee && employee.createdAt) && (
                  <div className="text-gray-400 text-xs">
                    Member since {new Date((employee as any).createdAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Photography Session Section */}
        <div>
          <div className="bg-white rounded-lg shadow p-4 flex flex-col md:flex-row items-center gap-4 h-full">
            <div className="flex-1">
              <h3 className="text-base font-bold mb-3" style={{ color: '#38bdf8' }}>Upcoming Photography Session</h3>
              {isLoadingBookings ? (
                <div className="text-gray-500 text-sm">Loading...</div>
              ) : acceptedBookings && acceptedBookings.length > 0 ? (
                (() => {
                  const nextSession = acceptedBookings[0];
                  const dateObj = new Date(nextSession.date);
                  return (
                    <div className="flex flex-col gap-1 text-gray-700 text-sm">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-[#98c6d5]" />
                        <span>{dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ClockIcon className="w-4 h-4 text-[#98c6d5]" />
                        <span>{dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserCircleIcon className="w-4 h-4 text-[#98c6d5]" />
                        <span className="font-semibold">Client:</span>
                        <span>{nextSession.customer?.name || 'N/A'}</span>
                      </div>
                      {nextSession.customer?.location && (
                        <div className="flex items-center gap-2">
                          <MapPinIcon className="w-4 h-4 text-[#98c6d5]" />
                          <span className="font-semibold">Location:</span>
                          <span>{nextSession.customer.location}</span>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="flex flex-col gap-1 text-gray-700 text-sm">
                  <div className="flex items-center gap-2">
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

        {/* Quick Actions Section (next row, spans both columns) */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-base font-bold mb-3" style={{ color: '#14b8a6' }}>Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {/* Media Day Calendar - blue */}
              <button
                onClick={() => navigate("/employee/media-day-calendar")}
                className="flex flex-col items-center p-3 bg-[#e0f2fe] rounded-lg hover:bg-[#bae6fd] transition relative"
              >
                {/* Notification badge */}
                {availableSessionsCount > 0 && (
                  <span className="absolute top-2 right-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                    {availableSessionsCount}
                  </span>
                )}
                <CalendarIcon className="w-6 h-6 text-[#3b82f6] mb-1" />
                <span className="font-medium text-gray-800 text-sm">Media Day Calendar</span>
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
                <span className="font-medium text-gray-800 text-sm">Payment Receipt</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard; 