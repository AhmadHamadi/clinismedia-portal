import React from 'react';
import { useNavigate, Outlet, Routes, Route } from 'react-router-dom';
import CustomerSidebar from './CustomerSidebar';
import CustomerDashboard from './CustomerDash/CustomerDashPage';
import CustomerMediaDayBookingPage from './CustomerMediaDayBooking/CustomerMediaDayBookingPage';
import CustomerOnboardingTasks from './CustomerOnboardingTasks';
import FacebookIntegrationPage from './FacebookIntegrationPage';
import FacebookInsightsPage from './FacebookInsightsPage';
import CustomerGalleryPage from './CustomerGalleryPage';
import CustomerInvoicePage from './CustomerInvoicePage';
import NotificationPage from './NotificationPage';

const CustomerPortalLayout: React.FC = () => {
  const navigate = useNavigate();

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
            <Route path="google-integration" element={<CustomerDashboard />} />
            <Route path="facebook-integration" element={<FacebookIntegrationPage />} />
            <Route path="facebook-insights" element={<FacebookInsightsPage />} />
            <Route path="gallery" element={<CustomerGalleryPage />} />
            <Route path="invoices" element={<CustomerInvoicePage />} />
            <Route path="notifications" element={<NotificationPage />} />
            <Route path="" element={<CustomerDashboard />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default CustomerPortalLayout; 