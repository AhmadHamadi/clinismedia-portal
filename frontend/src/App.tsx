import "./App.css";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";

import AdminDash from "./components/Admin/AdminDash/AdminDashPage";
import MediaDayCalendar from "./components/Admin/MediaDayCalendar";
import OnboardingTasks from "./components/Admin/OnboardingTasks";
import CustomerManagementPage from "./components/Admin/CustomerManagement/CustomerManagementPage";
import ManageEmployees from "./components/Admin/EmployeeManagement";
import Settings from "./components/Admin/Settings";
import SidebarMenu from "./components/Admin/SidebarMenu";

function App() {
  return (
    <div>
      <Router>
        <Routes>
          {/* Redirect root path to Login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Login Page */}
          <Route path="/login" element={<Login />} />

          {/* Protected Admin Routes */}
          <Route path="/admin/*" element={
            <div style={{ display: "flex" }}>
              <SidebarMenu />
              <Routes>
                <Route path="/" element={<AdminDash />} />
                <Route path="/media" element={<MediaDayCalendar />} />
                <Route path="/onboarding" element={<OnboardingTasks />} />
                <Route path="/customers" element={<CustomerManagementPage />} />
                <Route path="/employees" element={<ManageEmployees />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </div>
          } />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
