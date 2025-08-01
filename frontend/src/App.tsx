import "./App.css";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import AdminLayout from "./components/Admin/AdminLayout";
import CustomerDashboard from "./components/Customer/CustomerDash/CustomerDashPage";
import ProtectedRoute from "./components/Customer/ProtectedRoute";
import EmployeeDashboard from "./components/Employee/EmployeeDash/EmployeeDashPage";
import NotificationPage from "./components/Customer/NotificationPage";
import CustomerPortalLayout from "./components/Customer/CustomerPortalLayout";
import EmployeePortalLayout from "./components/Employee/EmployeePortalLayout";
import CustomerMediaDayBookingPage from "./components/Customer/CustomerMediaDayBooking/CustomerMediaDayBookingPage";
import CustomerOnboardingTasks from "./components/Customer/CustomerOnboardingTasks";
import { EmployeeMediaDayBookingPage } from "./components/Employee/EmployeeMediaDayBooking/EmployeeMediaDayBookingPage";
import FacebookIntegrationPage from "./components/Customer/FacebookIntegrationPage";
import FacebookInsightsPage from "./components/Customer/FacebookInsightsPage";
import CustomerGalleryPage from "./components/Customer/CustomerGalleryPage";
import CustomerInvoicePage from "./components/Customer/CustomerInvoicePage";
import PageTitle from "./components/PageTitle";

function App() {
  return (
    <div>
      <Router>
        <PageTitle />
        <Routes>
          {/* Redirect root path to Login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Login Page */}
          <Route path="/login" element={<Login />} />

          {/* Admin Routes */}
          <Route 
            path="/admin/*" 
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminLayout />
              </ProtectedRoute>
            } 
          />

          {/* Customer Routes */}
          <Route 
            path="/customer/*" 
            element={
              <ProtectedRoute requiredRole="customer">
                <CustomerPortalLayout />
              </ProtectedRoute>
            } 
          />

          {/* Employee Routes */}
          <Route 
            path="/employee/dashboard" 
            element={
              <ProtectedRoute requiredRole="employee">
                <EmployeePortalLayout title="Employee Dashboard" hideBackButton={true}>
                  <EmployeeDashboard />
                </EmployeePortalLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/employee/media-day-calendar"
            element={
              <ProtectedRoute requiredRole="employee">
                <EmployeePortalLayout title="View Media Day Calendar">
                  <EmployeeMediaDayBookingPage />
                </EmployeePortalLayout>
              </ProtectedRoute>
            }
          />

          <Route 
            path="/employee/edit-availability"
            element={
              <ProtectedRoute requiredRole="employee">
                <EmployeePortalLayout title="Edit Availability">
                  <EmployeeDashboard />
                </EmployeePortalLayout>
              </ProtectedRoute>
            }
          />

          <Route 
            path="/employee/messages"
            element={
              <ProtectedRoute requiredRole="employee">
                <EmployeePortalLayout title="Messages">
                  <EmployeeDashboard />
                </EmployeePortalLayout>
              </ProtectedRoute>
            }
          />

          <Route 
            path="/employee/payment-receipt"
            element={
              <ProtectedRoute requiredRole="employee">
                <EmployeePortalLayout title="Payment Receipt">
                  <EmployeeDashboard />
                </EmployeePortalLayout>
              </ProtectedRoute>
            }
          />

          <Route 
            path="/employee/settings"
            element={
              <ProtectedRoute requiredRole="employee">
                <EmployeePortalLayout title="Settings">
                  <EmployeeDashboard />
                </EmployeePortalLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </div>
  );
}

export default App;