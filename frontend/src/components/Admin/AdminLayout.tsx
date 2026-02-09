import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import SidebarMenu from './SidebarMenu';
import AdminDash from './AdminDash/AdminDashPage';
import AdminMediaDayBookingPage from './AdminMediaDayBooking/AdminMediaDayBookingPage';
import OnboardingTasks from './OnboardingTasks';
import CustomerManagementPage from './CustomerManagement/CustomerManagementPage';
import EmployeeManagementPage from './EmployeeManagement/EmployeeManagementPage';
import Settings from './Settings';
import AdminNotificationPage from './AdminNotificationPage';
import AdminGalleryPage from './AdminGalleryPage';
import AdminInvoicePage from './AdminInvoicePage';
import FacebookManagementPage from './FacebookManagement/FacebookManagementPage';
import SharedFolderManagementPage from './SharedFolderManagement/SharedFolderManagementPage';
import GoogleAdsManagementPage from './GoogleAdsManagement/GoogleAdsManagementPage';
import GoogleBusinessManagementPage from './GoogleBusinessManagement/GoogleBusinessManagementPage';
import TwilioManagementPage from './TwilioManagement/TwilioManagementPage';
import InstagramInsightsManagementPage from './InstagramInsightsManagement/InstagramInsightsManagementPage';
import MetaLeadsManagementPage from './MetaLeadsManagementPage';
import QuickBooksManagementPage from './QuickBooksManagement/QuickBooksManagementPage';
import QRReviewsPage from './QRReviews/QRReviewsPage';

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const handleSidebarToggle = (event: CustomEvent) => {
      setSidebarOpen(event.detail.isOpen);
    };

    window.addEventListener('sidebarToggle', handleSidebarToggle as EventListener);
    
    return () => {
      window.removeEventListener('sidebarToggle', handleSidebarToggle as EventListener);
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50 overflow-x-hidden">
      <SidebarMenu />
      <div 
        className={`flex-1 flex flex-col transition-all duration-300 ${ sidebarOpen ? 'ml-64' : 'ml-16' } overflow-x-hidden`}
      >
        <main className="flex-1 overflow-x-hidden w-full">
          <Routes>
            <Route path="/" element={<AdminDash />} />
            <Route path="/media" element={<AdminMediaDayBookingPage />} />
            <Route path="/onboarding" element={<OnboardingTasks />} />
            <Route path="/customers" element={<CustomerManagementPage />} />
            <Route path="/employees" element={<EmployeeManagementPage />} />
            <Route path="/gallery" element={<AdminGalleryPage />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/notifications" element={<AdminNotificationPage />} />
            <Route path="/invoices" element={<AdminInvoicePage />} />
            <Route path="/facebook" element={<FacebookManagementPage />} />
            <Route path="/shared-folders" element={<SharedFolderManagementPage />} />
            <Route path="/google-ads" element={<GoogleAdsManagementPage />} />
            <Route path="/google-business" element={<GoogleBusinessManagementPage />} />
            <Route path="/twilio" element={<TwilioManagementPage />} />
            <Route path="/instagram-insights" element={<InstagramInsightsManagementPage />} />
            <Route path="/meta-leads" element={<MetaLeadsManagementPage />} />
            <Route path="/quickbooks" element={<QuickBooksManagementPage />} />
            <Route path="/qr-reviews" element={<QRReviewsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout; 