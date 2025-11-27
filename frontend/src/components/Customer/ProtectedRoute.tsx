import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import axios from "axios";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "customer" | "admin" | "employee";
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole = "customer" }) => {
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const location = useLocation();

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

  const validateToken = async (token: string) => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/auth/validate`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return { valid: response.status === 200, message: "" };
    } catch (error: any) {
      console.error("Token validation failed:", error);
      const message = error.response?.data?.error || "Session expired. Please login again.";
      return { valid: false, message };
    }
  };

  useEffect(() => {
    const token = getToken();
    
    if (!token) {
      setIsValidating(false);
      setIsValid(false);
      setErrorMessage("Please login to access this page.");
      return;
    }

    // For better performance, only validate on first load or when token changes
    // Standard web apps don't validate on every route change
    const lastValidation = localStorage.getItem(`lastValidation_${requiredRole}`);
    const now = Date.now();
    
    // Only validate if it's been more than 5 minutes since last validation
    if (!lastValidation || (now - parseInt(lastValidation)) > 5 * 60 * 1000) {
      validateToken(token).then(({ valid, message }) => {
        setIsValid(valid);
        setIsValidating(false);
        setErrorMessage(message);
        
        if (valid) {
          localStorage.setItem(`lastValidation_${requiredRole}`, now.toString());
        } else {
          // Clear invalid tokens
          localStorage.removeItem("customerToken");
          localStorage.removeItem("adminToken");
          localStorage.removeItem("employeeToken");
          localStorage.removeItem("customerData");
          localStorage.removeItem("adminData");
          localStorage.removeItem("employeeData");
          localStorage.removeItem(`lastValidation_${requiredRole}`);
        }
      });
    } else {
      // Use cached validation result
      setIsValid(true);
      setIsValidating(false);
    }
  }, [requiredRole]);

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#98c6d5] mx-auto"></div>
          <p className="mt-4 text-gray-600">Validating session...</p>
        </div>
      </div>
    );
  }

  if (!isValid) {
    // Show error message if available
    if (errorMessage && errorMessage.includes("Session expired")) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <h2 className="text-lg font-semibold text-yellow-800 mb-2">Daily Login Required</h2>
              <p className="text-yellow-700 text-sm">
                For security reasons, you need to login once per day. This resets at 9 AM daily.
              </p>
            </div>
            <Navigate to={`/login?returnUrl=${encodeURIComponent(location.pathname)}`} replace />
          </div>
        </div>
      );
    }
    
    // Redirect to login if no valid token found, preserving the destination
    return <Navigate to={`/login?returnUrl=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute; 