import "./App.css";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";

import AdminDash from "./components/Admin/AdminDash/AdminDashPage";
import MediaDayCalendar from "./components/Admin/MediaDayCalendar";
import OnboardingTasks from "./components/Admin/OnboardingTasks";
import CustomerManagementPage from "./components/Admin/CustomerManagement/CustomerManagementPage";
import EmployeeManagementPage from "./components/Admin/EmployeeManagement/EmployeeManagementPage";
import Settings from "./components/Admin/Settings";
import SidebarMenu from "./components/Admin/SidebarMenu";

import CustomerDashboard from "./components/Customer/CustomerDashboard";
import ProtectedRoute from "./components/Customer/ProtectedRoute";

function App() {
  return (
    <div>
      <Router>
        <Routes>
          {/* Redirect root path to Login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Login Page */}
          <Route path="/login" element={<Login />} />

          {/* Customer Routes */}
          <Route 
            path="/customer/dashboard" 
            element={
              <ProtectedRoute requiredRole="customer">
                <CustomerDashboard />
              </ProtectedRoute>
            } 
          />

          {/* Protected Admin Routes */}
          <Route 
            path="/admin/*" 
            element={
              <ProtectedRoute requiredRole="admin">
                <div style={{ display: "flex" }}>
                  <SidebarMenu />
                  <Routes>
                    <Route path="/" element={<AdminDash />} />
                    <Route path="/media" element={<MediaDayCalendar />} />
                    <Route path="/onboarding" element={<OnboardingTasks />} />
                    <Route path="/customers" element={<CustomerManagementPage />} />
                    <Route path="/employees" element={<EmployeeManagementPage />} />
                    <Route path="/settings" element={<Settings />} />
                  </Routes>
                </div>
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Router>
    </div>
  );
}

export default App;