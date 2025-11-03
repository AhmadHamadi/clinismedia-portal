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
import InstagramInsightsManagementPage from './InstagramInsightsManagement/InstagramInsightsManagementPage';

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
    <div style={{ display: "flex" }}>
      <SidebarMenu />
      <div 
        className={`flex-1 min-h-screen bg-gray-100 transition-all duration-300 ${ sidebarOpen ? 'ml-64' : 'ml-16' } max-w-7xl mx-auto`}
      >
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
          <Route path="/instagram-insights" element={<InstagramInsightsManagementPage />} />
        </Routes>
      </div>
    </div>
  );
};

export default AdminLayout; 