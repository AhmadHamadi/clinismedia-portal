// src/components/Admin/AdminDash/AdminDashPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import axios from "axios";
import logo1 from "../../../assets/CliniMedia_Logo1.png";
import { DashboardBox } from "./AdminDashLogic";

const AdminDash = () => {
  const [pendingBookingsCount, setPendingBookingsCount] = useState(0);
  const [unreadNotesCount, setUnreadNotesCount] = useState(0);
  const navigate = useNavigate();

  // Fetch pending bookings count
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const token = localStorage.getItem('adminToken');
        if (!token) return;

        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/bookings/pending-count`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setPendingBookingsCount(response.data.count);
      } catch (error: any) {
        console.error('Failed to fetch pending bookings count:', error);
        console.error('Error details:', error.response?.data);
      }
    };

    fetchPendingCount();
    // Poll every 5 seconds for real-time updates
    const interval = setInterval(fetchPendingCount, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch unread notes count for Shared Folder
  useEffect(() => {
    const fetchUnreadNotesCount = async () => {
      try {
        const token = localStorage.getItem('adminToken');
        if (!token) return;

        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/client-notes/unread-count`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setUnreadNotesCount(response.data.count || 0);
      } catch (error: any) {
        console.error('Failed to fetch unread notes count:', error);
      }
    };

    fetchUnreadNotesCount();
    // Poll every 5 seconds for real-time updates
    const interval = setInterval(fetchUnreadNotesCount, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      {/* Header with logo left, title centered */}
      <div className="relative flex items-center justify-between mb-10 bg-gray-50 p-4 rounded">
        {/* Logo */}
        <div className="flex-shrink-0">
          <img
            src={logo1}
            alt="CliniMedia Logo"
            className="w-64 h-auto"
          />
        </div>

        {/* Title */}
        <h1
          className="text-5xl font-extrabold tracking-tight pointer-events-none select-none mx-auto"
          style={{ color: "#303b45" }}
        >
          Admin Portal
        </h1>

        {/* Spacer for balance */}
        <div className="w-64"></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
        <DashboardBox
          title="Media Day Calendar"
          description="View and manage media day events"
          onClick={() => navigate("/admin/media")}
          notificationCount={pendingBookingsCount}
        />
        <DashboardBox
          title="Onboarding Tasks"
          description="Customize customer onboarding phases"
          onClick={() => navigate("/admin/onboarding")}
        />
        <DashboardBox
          title="Manage Customers"
          description="Add, edit, and view customers"
          onClick={() => navigate("/admin/customers")}
        />
        <DashboardBox
          title="Manage Employees"
          description="Add, edit, and view employees"
          onClick={() => navigate("/admin/employees")}
        />
        <DashboardBox
          title="Manage Google Ads"
          description="Assign and manage Google Ads accounts"
          onClick={() => navigate("/admin/google-ads")}
        />
        <DashboardBox
          title="Manage Google Business"
          description="Assign and manage Google Business Profiles"
          onClick={() => navigate("/admin/google-business")}
        />
        <DashboardBox
          title="Manage Facebook"
          description="Assign and manage Facebook Pages"
          onClick={() => navigate("/admin/facebook")}
        />
        <DashboardBox
          title="Manage Twilio"
          description="Connect phone numbers to clinics and manage call forwarding"
          onClick={() => navigate("/admin/twilio")}
        />
        <DashboardBox
          title="Manage Instagram Insights"
          description="Upload and manage Instagram insight images"
          onClick={() => navigate("/admin/instagram-insights")}
        />
        <DashboardBox
          title="Manage QuickBooks"
          description="Connect and manage QuickBooks integration"
          onClick={() => navigate("/admin/quickbooks")}
        />
        <DashboardBox
          title="Manage Gallery Edits"
          description="Review and edit gallery items"
          onClick={() => navigate("/admin/gallery")}
        />
        <DashboardBox
          title="Manage Shared Folder"
          description="Manage shared folder access and permissions"
          onClick={() => navigate("/admin/shared-folders")}
          notificationCount={unreadNotesCount}
        />
        <DashboardBox
          title="Manage Meta Leads"
          description="Configure email subject mappings and manage Facebook leads"
          onClick={() => navigate("/admin/meta-leads")}
        />
      </div>
    </div>
  );
};

export default AdminDash;
