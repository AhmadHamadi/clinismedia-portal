import React from "react";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "customer" | "admin" | "employee";
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole = "customer" }) => {
  const getToken = () => {
    switch (requiredRole) {
      case "customer":
        return localStorage.getItem("customerToken");
      case "admin":
        return localStorage.getItem("adminToken");
      case "employee":
        return localStorage.getItem("employeeToken");
      default:
        return null;
    }
  };

  const token = getToken();

  if (!token) {
    // Redirect to login if no token found
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute; 