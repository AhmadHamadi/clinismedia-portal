// src/components/Admin/AdminDash.tsx
import { useNavigate } from "react-router-dom";
import logo1 from "../../assets/CliniMedia_Logo1.png";

const AdminDash = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 p-8 max-w-7xl mx-auto font-sans">
      {/* Header with logo left, title centered */}
      <div className="relative flex items-center justify-between mb-10">
        <div className="flex-shrink-0">
          <img
            src={logo1}
            alt="CliniMedia Logo"
            className="w-64 h-auto"
          />
        </div>

        <h1
          className="absolute left-1/2 transform -translate-x-1/2 text-5xl font-extrabold tracking-tight pointer-events-none select-none"
          style={{ color: "#303b45" }}
        >
          Admin Portal
        </h1>

        <div className="w-64" /> {/* Spacer for right */}
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

interface DashboardBoxProps {
  title: string;
  description: string;
  onClick: () => void;
}

const DashboardBox = ({ title, description, onClick }: DashboardBoxProps) => (
  <div
    onClick={onClick}
    className="cursor-pointer rounded-xl bg-white p-6 shadow-md hover:shadow-lg transition flex flex-col justify-center items-center text-center h-48"
  >
    <h2 className="text-xl font-semibold mb-2" style={{ color: "#303b45" }}>
      {title}
    </h2>
    <p className="text-sm text-black">{description}</p>
  </div>
);

export default AdminDash;
