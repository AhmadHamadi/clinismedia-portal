import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Routes, Route, useLocation } from 'react-router-dom';
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
import ReceptionistCallLogsPage from './ReceptionistCallLogsPage';
import GoogleBusinessAnalyticsPage from './GoogleBusinessAnalyticsPage';
import CustomerQuickBooksInvoicesPage from './CustomerQuickBooksInvoicesPage';
import MetaLeadsPage from './MetaLeadsPage';
import CustomerQRReviewsPage from './CustomerQRReviewsPage';

const CustomerPortalLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // After /auth/validate, we merge role/parentCustomerId/canBookMediaDay into this; null = use localStorage
  const [userFromValidate, setUserFromValidate] = useState<{ role?: string; canBookMediaDay?: boolean; parentCustomerId?: string } | null>(null);

  // On mount: refresh customerData from /auth/validate so canBookMediaDay/parentCustomerId stay in sync (e.g. after admin edits)
  useEffect(() => {
    const token = localStorage.getItem('customerToken');
    if (!token) return;
    axios
      .get(`${import.meta.env.VITE_API_BASE_URL}/auth/validate`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        const u = res.data?.user;
        if (u && (u.role === 'receptionist' || u.role === 'customer')) {
          try {
            const stored = JSON.parse(localStorage.getItem('customerData') || '{}');
            if (u.role) stored.role = u.role;
            if (Object.prototype.hasOwnProperty.call(u, 'canBookMediaDay')) stored.canBookMediaDay = u.canBookMediaDay;
            if (Object.prototype.hasOwnProperty.call(u, 'parentCustomerId')) stored.parentCustomerId = u.parentCustomerId;
            localStorage.setItem('customerData', JSON.stringify(stored));
          } catch (_) {}
        }
        setUserFromValidate(u || null);
      })
      .catch(() => setUserFromValidate(null));
  }, []);

  const allowedPages = useMemo(() => {
    const u = userFromValidate ?? (() => { try { return JSON.parse(localStorage.getItem('customerData') || '{}'); } catch { return {}; } })();
    if (u.role === 'receptionist') {
      const pages = ['call-logs', 'meta-leads'];
      if (u.canBookMediaDay === true) pages.push('media-day-booking');
      return pages;
    }
    return null; // customer: all pages
  }, [userFromValidate]);

  // Route guard: redirect receptionist away from pages they cannot access
  useEffect(() => {
    if (!allowedPages || allowedPages.length === 0) return;
    let pageKey = location.pathname.replace(/^\/customer\/?/, '') || 'dashboard';
    if (pageKey === '') pageKey = 'dashboard';
    if (!allowedPages.includes(pageKey)) {
      navigate('/customer/' + allowedPages[0], { replace: true });
    }
  }, [location.pathname, allowedPages, navigate]);

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
    } else if (location.pathname === '/customer/call-logs') {
      clearNotificationBadge('callLogs');
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
    <div className="flex min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Sidebar - Always visible */}
      <CustomerSidebar onLogout={handleLogout} allowedPages={allowedPages ?? undefined} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col ml-64 overflow-x-hidden">
        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden w-full">
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
            <Route path="call-logs" element={(() => {
              try {
                const u = JSON.parse(localStorage.getItem('customerData') || '{}');
                return u.role === 'receptionist' ? <ReceptionistCallLogsPage /> : <CallLogsPage />;
              } catch {
                return <CallLogsPage />;
              }
            })()} />
            <Route path="meta-leads" element={<MetaLeadsPage />} />
            <Route path="quickbooks-invoices" element={<CustomerQuickBooksInvoicesPage />} />
            <Route path="qr-reviews" element={<CustomerQRReviewsPage />} />
            <Route path="" element={<CustomerDashboard />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default CustomerPortalLayout; 