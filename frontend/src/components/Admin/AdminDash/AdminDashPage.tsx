// src/components/Admin/AdminDash/AdminDashPage.tsx
import React from 'react';
import { useNavigate } from "react-router-dom";
import logo1 from "../../../assets/CliniMedia_Logo1.png";
import { DashboardBox } from "./AdminDashLogic";
import NotificationCenter from "../../Customer/NotificationCenter";

const AdminDash = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-sans">
      {/* Header with logo left, title centered */}
      <div className="relative flex items-center justify-between mb-10 bg-gray-100 p-4 rounded">
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

      {/* Notification Center for Admin */}
      <NotificationCenter navigateTo="/admin/notifications" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
        <DashboardBox
          title="Media Day Calendar"
          description="View and manage media day events"
          onClick={() => navigate("/admin/media")}
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
          title="Manage Gallery Edits"
          description="Review and edit gallery items"
          onClick={() => navigate("/admin/gallery")}
        />
        <DashboardBox
          title="Manage Customer Invoices"
          description="View and manage customer invoices"
          onClick={() => navigate("/admin/invoices")}
        />
        <DashboardBox
          title="Settings"
          description="Configure admin preferences"
          onClick={() => navigate("/admin/settings")}
        />
      </div>
    </div>
  );
};

export default AdminDash;
