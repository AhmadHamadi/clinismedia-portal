import "./App.css";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import AdminDash from "./components/AdminDash";
import MediaDayCalendar from "./components/MediaDayCalendar";
import OnboardingTasks from "./components/OnboardingTasks";
import ManageCustomers from "./components/CustomerManagement";
import ManageEmployees from "./components/EmployeeManagement";
import AdminSettings from "./components/Settings";

function App() {
  return (
    <Router>
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
        <Route path="/admin/settings" element={<AdminSettings />} />
      </Routes>
    </Router>
  );
}

export default App;
