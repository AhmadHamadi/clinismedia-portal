import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPinIcon } from '@heroicons/react/24/outline';
import axios from 'axios';

interface Booking {
  _id: string;
  date: string;
  notes?: string;
  status: 'pending' | 'accepted' | 'declined';
  location?: string;
}

type MediaDay = { date: string; time: string };

interface NotificationCounts {
  meta_insights: number;
  invoice: number;
  gallery: number;
}

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationCounts, setNotificationCounts] = useState<NotificationCounts>({
    meta_insights: 0,
    invoice: 0,
    gallery: 0
  });

  const fetchCustomerData = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      if (!token) {
        navigate('/login');
        return;
      }

      const [customerResponse, bookingsResponse, notificationsResponse] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_BASE_URL}/customers/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${import.meta.env.VITE_API_BASE_URL}/bookings/customer`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${import.meta.env.VITE_API_BASE_URL}/customer-notifications/counts`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setCustomer(customerResponse.data);
      setBookings(bookingsResponse.data);
      setNotificationCounts(notificationsResponse.data);
    } catch (error) {
      console.error('Error fetching customer data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerData();
  }, []);

  const getUpcomingMediaDay = (): (MediaDay & { status: string }) | null => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Find the next media day in the current month or future months
    const upcomingBooking = bookings
      .filter(booking => booking.status === 'accepted')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .find(booking => {
        const bookingDate = new Date(booking.date);
        return bookingDate >= now;
      });

    if (upcomingBooking) {
      const date = new Date(upcomingBooking.date);
      return {
        date: date.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        time: date.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }),
        status: upcomingBooking.status
      };
    }

    return null;
  };

  const hadMediaDayThisMonth = bookings.some(booking => {
    const bookingDate = new Date(booking.date);
    const now = new Date();
    return booking.status === 'accepted' && 
           bookingDate.getMonth() === now.getMonth() && 
           bookingDate.getFullYear() === now.getFullYear();
  });

  const handleLogoutAndNavigate = () => {
    navigate('/login');
  };

  const handleQuickActionClick = async (path: string, notificationType?: string) => {
    // Mark notifications as read if clicking on a page with notifications
    if (notificationType && notificationCounts[notificationType as keyof NotificationCounts] > 0) {
      try {
        const token = localStorage.getItem('customerToken');
        if (token) {
          await axios.patch(
            `${import.meta.env.VITE_API_BASE_URL}/customer-notifications/mark-read/${notificationType}`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );

          // Update local state
          setNotificationCounts(prev => ({
            ...prev,
            [notificationType]: 0
          }));
        }
      } catch (err) {
        console.error('Error marking notifications as read:', err);
      }
    }

    navigate(path);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#98c6d5]"></div>
      </div>
    );
  }

  const upcomingMediaDay = getUpcomingMediaDay();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Section */}
        <div className="bg-gradient-to-br from-[#e0f2fe] to-[#f8fafc] rounded-xl shadow-lg p-6 border border-[#e0e7ef] mb-4 relative overflow-hidden flex items-center justify-center min-h-[160px]">
          {/* Sparkles */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-4 left-10 w-2 h-2 bg-yellow-400 rounded-full animate-ping"></div>
            <div className="absolute top-8 right-20 w-1 h-1 bg-blue-400 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
            <div className="absolute bottom-6 left-20 w-1.5 h-1.5 bg-green-400 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
            <div className="absolute bottom-8 right-10 w-1 h-1 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '1.5s' }}></div>
          </div>
          
          <div className="z-10 w-full max-w-4xl text-center mx-auto px-4">
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#1877f3] mb-3 font-sans text-center leading-tight">
              Welcome to Your CliniMedia Portal!
            </h1>
            <p className="text-gray-700 text-sm md:text-base font-medium text-center mx-auto leading-relaxed max-w-3xl">
              We're excited to help your clinic shine. Here you can easily{' '}
              <span className="text-[#60a5fa] font-bold">book your next Media Day</span>, access your{' '}
              <span className="text-[#60a5fa] font-bold">professional photo galleries</span>, manage{' '}
              <span className="text-[#60a5fa] font-bold">invoices</span>, and track{' '}
              <span className="text-[#60a5fa] font-bold">onboarding tasks</span>, monitor your{' '}
              <span className="text-[#60a5fa] font-bold">Facebook and Google advertisements</span>—all in one place. Our team is here to support you every step of the way.
            </p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Profile Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold mb-4" style={{ color: '#14b8a6' }}>Your Profile</h3>
            <div className="flex items-start space-x-4">
              {/* Profile Picture Placeholder */}
              <div className="w-16 h-16 bg-gradient-to-br from-[#98c6d5] to-[#7bb3c4] rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
                {customer?.name?.charAt(0)?.toUpperCase() || 'C'}
              </div>
              
              {/* Profile Info */}
              <div className="flex-1 flex flex-col items-center md:items-start justify-center min-w-0">
                <h2 className="text-xl font-bold text-gray-900 mb-0 text-center md:text-left break-words">
                  {customer.name}
                </h2>
                {customer.email && (
                  <div className="text-gray-500 text-xs mt-0.5 mb-1 text-center md:text-left break-words">
                    {customer.email}
                  </div>
                )}
                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3 w-full justify-center md:justify-start mt-1">
                  {customer.location && (
                    <div className="flex items-center gap-1 text-gray-600 text-xs break-words">
                      <MapPinIcon className="w-3 h-3 text-[#98c6d5] flex-shrink-0" />
                      <span className="break-words">{customer.location}</span>
                      {customer.address && (
                        <span className="ml-2 text-gray-500 break-words">| {customer.address}</span>
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

          {/* Media Day Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold mb-4" style={{ color: '#14b8a6' }}>Next Media Day</h3>
            <div className="space-y-3">
              {upcomingMediaDay ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {/* Calendar Icon */}
                    <svg className="w-4 h-4 text-[#98c6d5]" fill="none" viewBox="0 0 24 24" stroke="#98c6d5" strokeWidth="2.2">
                      <rect x="3" y="4" width="18" height="18" rx="2" stroke="#98c6d5" strokeWidth="2.2" />
                      <line x1="16" y1="2" x2="16" y2="6" stroke="#98c6d5" strokeWidth="2.2" strokeLinecap="round" />
                      <line x1="8" y1="2" x2="8" y2="6" stroke="#98c6d5" strokeWidth="2.2" strokeLinecap="round" />
                      <line x1="3" y1="10" x2="21" y2="10" stroke="#98c6d5" strokeWidth="2.2" strokeLinecap="round" />
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
              className="bg-[#98c6d5] hover:bg-[#7bb3c4] text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-md transition"
            >
              View/Request Booking
            </button>
          </div>
        </div>
        {/* Quick Actions Section (next row, spans both columns) */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-base font-bold mb-3" style={{ color: '#14b8a6' }}>Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Meta Insights - Meta logo */}
              <button
                onClick={() => handleQuickActionClick("/customer/facebook-insights", "meta_insights")}
                className="flex flex-col items-center p-3 bg-[#e7f0fd] rounded-lg hover:bg-[#c7e0fa] transition relative"
              >
                {/* Meta SVG Logo */}
                <svg className="w-6 h-6 mb-1" viewBox="0 0 40 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10.5 19C13.5 7 26.5 7 29.5 19" stroke="#1877f3" strokeWidth="2.5" strokeLinecap="round"/>
                  <ellipse cx="10.5" cy="19" rx="4.5" ry="4" stroke="#1877f3" strokeWidth="2.5"/>
                  <ellipse cx="29.5" cy="19" rx="4.5" ry="4" stroke="#1877f3" strokeWidth="2.5"/>
                </svg>
                <span className="font-medium text-gray-800 text-sm">Meta Insights</span>
                {notificationCounts.meta_insights > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] flex items-center justify-center">
                    {notificationCounts.meta_insights}
                  </span>
                )}
              </button>
              {/* Gallery - green */}
              <button
                onClick={() => handleQuickActionClick("/customer/gallery", "gallery")}
                className="flex flex-col items-center p-3 bg-[#d1fae5] rounded-lg hover:bg-[#6ee7b7] transition relative"
              >
                <svg className="w-6 h-6 text-[#22c55e] mb-1" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth="1.5">
                  <rect x="3" y="7" width="18" height="12" rx="2" stroke="#22c55e" strokeWidth="1.5" />
                  <circle cx="12" cy="13" r="3" stroke="#22c55e" strokeWidth="1.5" />
                  <rect x="8" y="3" width="8" height="4" rx="1.5" stroke="#22c55e" strokeWidth="1.5" />
                </svg>
                <span className="font-medium text-gray-800 text-sm">Gallery</span>
                {notificationCounts.gallery > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] flex items-center justify-center">
                    {notificationCounts.gallery}
                  </span>
                )}
              </button>
              {/* Invoices - red */}
              <button
                onClick={() => handleQuickActionClick("/customer/invoices", "invoice")}
                className="flex flex-col items-center p-3 bg-[#fee2e2] rounded-lg hover:bg-[#fca5a5] transition relative"
              >
                <svg className="w-6 h-6 text-[#ef4444] mb-1" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="1.5">
                  <rect x="5" y="3" width="14" height="18" rx="2" stroke="#ef4444" strokeWidth="1.5" />
                  <path d="M9 7h6M9 11h6M9 15h3" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="font-medium text-gray-800 text-sm">Invoices</span>
                {notificationCounts.invoice > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] flex items-center justify-center">
                    {notificationCounts.invoice}
                  </span>
                )}
              </button>
              {/* Onboarding - blue */}
              <button
                onClick={() => navigate("/customer/onboarding-tasks")}
                className="flex flex-col items-center p-3 bg-[#e0f2fe] rounded-lg hover:bg-[#bae6fd] transition"
              >
                <svg className="w-6 h-6 text-[#3b82f6] mb-1" fill="none" viewBox="0 0 24 24" stroke="#3b82f6" strokeWidth="1.5">
                  <rect x="4" y="4" width="16" height="16" rx="4" stroke="#3b82f6" strokeWidth="1.5" />
                  <path d="M8 12l3 3 5-5" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="font-medium text-gray-800 text-sm">Onboarding</span>
              </button>
            </div>
            {/* Second row for Google Integration - Coming Soon */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <div className="flex flex-col items-center p-3 bg-[#fef9c3] rounded-lg opacity-60 cursor-not-allowed border-2 border-dashed border-[#fbbf24]">
                <svg className="w-6 h-6 text-[#fbbf24] mb-1" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth="1.5">
                  <path d="M4 17a8 8 0 0116 0" stroke="#fbbf24" strokeWidth="1.5" fill="none" />
                  <circle cx="12" cy="17" r="1.5" stroke="#fbbf24" strokeWidth="1.5" fill="none" />
                  <path d="M12 17l4-4" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M8 13a4 4 0 018 0" stroke="#fbbf24" strokeWidth="1.5" fill="none" />
                </svg>
                <span className="font-medium text-gray-800 text-sm">Google Integration</span>
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