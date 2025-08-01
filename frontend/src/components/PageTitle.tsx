import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PageTitle = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    let title = "CliniMedia Portal";

    // Login page
    if (path === '/login') {
      title = "Login - CliniMedia Portal";
    }
    // Admin pages
    else if (path.startsWith('/admin')) {
      if (path.includes('/media')) title = "Media Day Booking - CliniMedia Portal";
      else if (path.includes('/onboarding')) title = "Onboarding Tasks - CliniMedia Portal";
      else if (path.includes('/customers')) title = "Customer Management - CliniMedia Portal";
      else if (path.includes('/employees')) title = "Employee Management - CliniMedia Portal";
      else if (path.includes('/gallery')) title = "Gallery Management - CliniMedia Portal";
      else if (path.includes('/settings')) title = "Admin Settings - CliniMedia Portal";
      else if (path.includes('/notifications')) title = "Notifications - CliniMedia Portal";
      else if (path.includes('/invoices')) title = "Invoice Management - CliniMedia Portal";
      else if (path.includes('/facebook')) title = "Facebook Management - CliniMedia Portal";
      else if (path.includes('/instagram-insights')) title = "Instagram Insights - CliniMedia Portal";
      else title = "Admin Dashboard - CliniMedia Portal";
    }
    // Customer pages
    else if (path.startsWith('/customer')) {
      if (path.includes('/media-day-booking')) title = "Media Day Booking - CliniMedia Portal";
      else if (path.includes('/onboarding-tasks')) title = "Onboarding Tasks - CliniMedia Portal";
      else if (path.includes('/google-integration')) title = "Google Integration - CliniMedia Portal";
      else if (path.includes('/facebook-integration')) title = "Facebook Integration - CliniMedia Portal";
      else if (path.includes('/facebook-insights')) title = "Facebook Insights - CliniMedia Portal";
      else if (path.includes('/gallery')) title = "Gallery - CliniMedia Portal";
      else if (path.includes('/invoices')) title = "Invoices - CliniMedia Portal";
      else if (path.includes('/notifications')) title = "Notifications - CliniMedia Portal";
      else title = "Customer Dashboard - CliniMedia Portal";
    }
    // Employee pages
    else if (path.startsWith('/employee')) {
      if (path.includes('/media-day-calendar')) title = "View Media Day Calendar - CliniMedia Portal";
      else if (path.includes('/edit-availability')) title = "Edit Availability - CliniMedia Portal";
      else if (path.includes('/messages')) title = "Messages - CliniMedia Portal";
      else if (path.includes('/payment-receipt')) title = "Payment Receipt - CliniMedia Portal";
      else if (path.includes('/settings')) title = "Settings - CliniMedia Portal";
      else title = "Employee Dashboard - CliniMedia Portal";
    }

    document.title = title;
  }, [location.pathname]);

  return null; // This component doesn't render anything
};

export default PageTitle; 