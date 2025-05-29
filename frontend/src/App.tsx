import "./App.css";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import AdminDash from "./components/Admin/AdminDash";
import MediaDayCalendar from "./components/Admin/MediaDayCalendar";
import OnboardingTasks from "./components/Admin/OnboardingTasks";
import ManageCustomers from "./components/Admin/CustomerManagement";
import ManageEmployees from "./components/Admin/EmployeeManagement";
import Settings from "./components/Admin/Settings";
import SidebarMenu from "./components/Admin/SidebarMenu";

function App() {
  return (
    <div>
      {/* Main Router for Admin Dashboard */} 
      <Router>
    <div style={{ display: "flex" }}>
        <SidebarMenu />
        <Routes>
          {/* Redirect root path to Admin Dashboard */}
          <Route path="/" element={<Navigate to="/admin" replace />} />

          {/* General Dashboard */}
          <Route path="/admin" element={<AdminDash />} />

          {/* Individual Admin Pages */}
          <Route path="/admin/media" element={<MediaDayCalendar />} />
          <Route path="/admin/onboarding" element={<OnboardingTasks />} />
          <Route path="/admin/customers" element={<ManageCustomers />} />
          <Route path="/admin/employees" element={<ManageEmployees />} />
          <Route path="/admin/settings" element={<Settings />} />
        </Routes>
    </div>
      </Router>
    </div>
  );
}

export default App;
