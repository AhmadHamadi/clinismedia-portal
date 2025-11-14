import React, { useEffect } from 'react';
import { useNavigate, Outlet, Routes, Route, useLocation } from 'react-router-dom';
import axios from 'axios';
import CustomerSidebar from './CustomerSidebar';
import CustomerDashboard from './CustomerDash/CustomerDashPage';
import CustomerMediaDayBookingPage from './CustomerMediaDayBooking/CustomerMediaDayBookingPage';
import CustomerOnboardingTasks from './CustomerOnboardingTasks';
import FacebookIntegrationPage from './FacebookIntegrationPage';
import FacebookInsightsPage from './FacebookInsightsPage';
import InstagramInsightsPage from './InstagramInsightsPage';
import SharedMediaPage from './SharedMediaPage';
import CustomerGalleryPage from './CustomerGalleryPage';
import CustomerInvoicePage from './CustomerInvoicePage';
import NotificationPage from './NotificationPage';
import GoogleAdsPage from './GoogleAdsPage';
import CallLogsPage from './CallLogsPage';
import GoogleBusinessAnalyticsPage from './GoogleBusinessAnalyticsPage';
import MetaLeadsPage from './MetaLeadsPage';

const CustomerPortalLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-clear notification badges when visiting sections
  useEffect(() => {
    const clearNotificationBadge = async (section: string) => {
      try {
        const token = localStorage.getItem('customerToken');
        if (!token) return;

        await axios.post(`${import.meta.env.VITE_API_BASE_URL}/customer-notifications/mark-read/${section}`, {}, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Dispatch custom event to refresh notification counts in sidebar and dashboard
        window.dispatchEvent(new CustomEvent('refreshCustomerNotifications'));
      } catch (error) {
        console.error(`Failed to mark ${section} as read:`, error);
      }
    };

    // Clear appropriate badge based on current route
    if (location.pathname === '/customer/facebook-insights') {
      clearNotificationBadge('metaInsights');
    } else if (location.pathname === '/customer/instagram-insights') {
      clearNotificationBadge('instagramInsights');
    } else if (location.pathname === '/customer/gallery') {
      clearNotificationBadge('gallery');
    } else if (location.pathname === '/customer/invoices') {
      clearNotificationBadge('invoices');
    } else if (location.pathname === '/customer/onboarding-tasks') {
      clearNotificationBadge('onboarding');
    } else if (location.pathname === '/customer/meta-leads') {
      clearNotificationBadge('metaLeads');
    } else if (location.pathname === '/customer/notifications') {
      // Clear all badges when visiting notifications page
      const clearAllBadges = async () => {
        try {
          const token = localStorage.getItem('customerToken');
          if (!token) return;

          await axios.post(`${import.meta.env.VITE_API_BASE_URL}/customer-notifications/mark-all-read`, {}, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          window.dispatchEvent(new CustomEvent('refreshCustomerNotifications'));
        } catch (error) {
          console.error('Failed to mark all sections as read:', error);
        }
      };
      clearAllBadges();
    }
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('customerToken');
    localStorage.removeItem('customerData');
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar - Always visible */}
      <CustomerSidebar onLogout={handleLogout} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col ml-64">
        {/* Page Content */}
        <main className="flex-1">
          <Routes>
            <Route path="dashboard" element={<CustomerDashboard />} />
            <Route path="media-day-booking" element={<CustomerMediaDayBookingPage />} />
            <Route path="onboarding-tasks" element={<CustomerOnboardingTasks />} />
            <Route path="facebook-integration" element={<FacebookIntegrationPage />} />
            <Route path="facebook-insights" element={<FacebookInsightsPage />} />
            <Route path="instagram-insights" element={<InstagramInsightsPage />} />
            <Route path="shared-media" element={<SharedMediaPage />} />
            <Route path="gallery" element={<CustomerGalleryPage />} />
            <Route path="invoices" element={<CustomerInvoicePage />} />
            <Route path="notifications" element={<NotificationPage />} />
            <Route path="google-ads" element={<GoogleAdsPage />} />
            <Route path="google-business-analytics" element={<GoogleBusinessAnalyticsPage />} />
            <Route path="call-logs" element={<CallLogsPage />} />
            <Route path="meta-leads" element={<MetaLeadsPage />} />
            <Route path="" element={<CustomerDashboard />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default CustomerPortalLayout; 