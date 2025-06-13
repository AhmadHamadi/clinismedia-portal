import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from '../../../utils/api';

export interface Employee {
  _id: string;
  name: string;
  email: string;
  username: string;
  department: string;
}

export const useEmployeeDashboard = () => {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployeeData = async () => {
    try {
      const token = localStorage.getItem("employeeToken");
      
      if (!token) {
        setError("No authentication token found. Please log in again.");
        setLoading(false);
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/employees/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setEmployee(response.data);
      setLoading(false);
    } catch (err: any) {
      console.error("Failed to fetch employee data:", err);
      setError("Failed to load employee data. Please try again.");
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("employeeToken");
    localStorage.removeItem("employeeData");
  };

  useEffect(() => {
    fetchEmployeeData();
  }, []);

  return {
    employee,
    loading,
    error,
    handleLogout,
  };
};
