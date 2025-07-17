import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from '../../../utils/api';

export interface Customer {
  _id: string;
  name: string;
  email: string;
  username: string;
  location?: string;
  customerSettings?: {
    displayName?: string;
    logoUrl?: string;
  };
  createdAt?: string;
}

export const useCustomerDashboard = () => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomerData = async () => {
    try {
      const token = localStorage.getItem("customerToken");
      
      if (!token) {
        setError("No authentication token found. Please log in again.");
        setLoading(false);
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/customers/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setCustomer(response.data);
      setLoading(false);
    } catch (err: any) {
      console.error("Failed to fetch customer data:", err);
      setError("Failed to load customer data. Please try again.");
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("customerToken");
    localStorage.removeItem("customerData");
  };

  useEffect(() => {
    fetchCustomerData();
  }, []);

  return {
    customer,
    loading,
    error,
    handleLogout,
  };
};
