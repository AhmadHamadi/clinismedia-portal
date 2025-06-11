// src/components/Admin/AdminDash/AdminDashPage.tsx
import { useNavigate } from "react-router-dom";
import logo1 from "../../../assets/CliniMedia_Logo1.png";
import { DashboardBox } from "./AdminDashLogic";

const AdminDash = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clear admin tokens and data
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminData");
    localStorage.removeItem("employeeToken");
    localStorage.removeItem("employeeData");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 max-w-7xl mx-auto font-sans">
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

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition ml-auto"
        >
          Logout
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
          title="Settings"
          description="Configure admin preferences"
          onClick={() => navigate("/admin/settings")}
        />
      </div>
    </div>
  );
};

export default AdminDash;
