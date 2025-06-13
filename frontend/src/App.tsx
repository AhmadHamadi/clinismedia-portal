import "./App.css";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";

import AdminLayout from "./components/Admin/AdminLayout";

import CustomerDashboard from "./components/Customer/CustomerDashboard";
import ProtectedRoute from "./components/Customer/ProtectedRoute";
import EmployeeDashboard from "./components/Employee/EmployeeDashboard";
import NotificationPage from "./components/Customer/NotificationPage";
import CustomerPortalLayout from "./components/Customer/CustomerPortalLayout";
import EmployeePortalLayout from "./components/Employee/EmployeePortalLayout";
import EmployeeNotificationPage from "./components/Employee/EmployeeNotificationPage";
import EmployeeTasksPage from "./components/Employee/EmployeeTasksPage";

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
                <CustomerPortalLayout title="Customer Dashboard" hideBackButton={true}>
                  <CustomerDashboard />
                </CustomerPortalLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/customer/notifications" 
            element={
              <ProtectedRoute requiredRole="customer">
                <CustomerPortalLayout title="Notifications">
                  <NotificationPage />
                </CustomerPortalLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/customer/media-day-booking"
            element={
              <ProtectedRoute requiredRole="customer">
                <CustomerPortalLayout title="Media Day Booking">
                  <CustomerDashboard />
                </CustomerPortalLayout>
              </ProtectedRoute>
            }
          />

          <Route 
            path="/customer/onboarding-tasks"
            element={
              <ProtectedRoute requiredRole="customer">
                <CustomerPortalLayout title="Onboarding Tasks">
                  <CustomerDashboard />
                </CustomerPortalLayout>
              </ProtectedRoute>
            }
          />

          <Route 
            path="/customer/google-integration"
            element={
              <ProtectedRoute requiredRole="customer">
                <CustomerPortalLayout title="Google Integration">
                  <CustomerDashboard />
                </CustomerPortalLayout>
              </ProtectedRoute>
            }
          />

          <Route 
            path="/customer/facebook-integration"
            element={
              <ProtectedRoute requiredRole="customer">
                <CustomerPortalLayout title="Facebook Integration">
                  <CustomerDashboard />
                </CustomerPortalLayout>
              </ProtectedRoute>
            }
          />

          <Route 
            path="/customer/create-ticket"
            element={
              <ProtectedRoute requiredRole="customer">
                <CustomerPortalLayout title="Create a Ticket">
                  <CustomerDashboard />
                </CustomerPortalLayout>
              </ProtectedRoute>
            }
          />

          <Route 
            path="/customer/completed-tasks"
            element={
              <ProtectedRoute requiredRole="customer">
                <CustomerPortalLayout title="Recently Completed Tasks">
                  <CustomerDashboard />
                </CustomerPortalLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/customer/invoices"
            element={
              <ProtectedRoute requiredRole="customer">
                <CustomerPortalLayout title="View Your Invoice">
                  <CustomerDashboard /> {/* Placeholder for now */}
                </CustomerPortalLayout>
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
                  <EmployeeDashboard /> {/* Placeholder for now */}
                </EmployeePortalLayout>
              </ProtectedRoute>
            }
          />

          <Route 
            path="/employee/edit-availability"
            element={
              <ProtectedRoute requiredRole="employee">
                <EmployeePortalLayout title="Edit Availability">
                  <EmployeeDashboard /> {/* Placeholder for now */}
                </EmployeePortalLayout>
              </ProtectedRoute>
            }
          />

          <Route 
            path="/employee/tasks"
            element={
              <ProtectedRoute requiredRole="employee">
                <EmployeePortalLayout title="Tasks">
                  <EmployeeTasksPage />
                </EmployeePortalLayout>
              </ProtectedRoute>
            }
          />

          <Route 
            path="/employee/messages"
            element={
              <ProtectedRoute requiredRole="employee">
                <EmployeePortalLayout title="Messages">
                  <EmployeeDashboard /> {/* Placeholder for now */}
                </EmployeePortalLayout>
              </ProtectedRoute>
            }
          />

          <Route 
            path="/employee/payment-receipt"
            element={
              <ProtectedRoute requiredRole="employee">
                <EmployeePortalLayout title="Payment Receipt">
                  <EmployeeDashboard /> {/* Placeholder for now */}
                </EmployeePortalLayout>
              </ProtectedRoute>
            }
          />

          <Route 
            path="/employee/settings"
            element={
              <ProtectedRoute requiredRole="employee">
                <EmployeePortalLayout title="Settings">
                  <EmployeeDashboard /> {/* Reverting to placeholder */}
                </EmployeePortalLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/employee/notifications"
            element={
              <ProtectedRoute requiredRole="employee">
                <EmployeePortalLayout title="Notifications">
                  <EmployeeNotificationPage />
                </EmployeePortalLayout>
              </ProtectedRoute>
            }
          />

          {/* Protected Admin Routes */}
          <Route 
            path="/admin/*" 
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminLayout />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Router>
    </div>
  );
}

export default App;