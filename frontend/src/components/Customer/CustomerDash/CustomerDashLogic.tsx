import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export interface Customer {
  _id: string;
  name: string;
  email: string;
  username: string;
  location?: string;
  address?: string;
  customerSettings?: {
    logoUrl?: string;
    displayName?: string;
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

      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/customers/profile`, {
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

interface NotificationCounts {
  meta_insights: number;
  invoice: number;
  gallery: number;
}

export const useCustomerNotifications = () => {
  const [notificationCounts, setNotificationCounts] = useState<NotificationCounts>({
    meta_insights: 0,
    invoice: 0,
    gallery: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotificationCounts = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('customerToken');
      if (!token) return;

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/customer-notifications/counts`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setNotificationCounts(response.data);
    } catch (err: any) {
      console.error('Error fetching notification counts:', err);
      setError(err.response?.data?.message || 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  const markNotificationsAsRead = useCallback(async (type: 'meta_insights' | 'invoice' | 'gallery') => {
    try {
      const token = localStorage.getItem('customerToken');
      if (!token) return;

      await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL}/customer-notifications/mark-read/${type}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update local state
      setNotificationCounts(prev => ({
        ...prev,
        [type]: 0
      }));
    } catch (err: any) {
      console.error('Error marking notifications as read:', err);
      setError(err.response?.data?.message || 'Failed to mark notifications as read');
    }
  }, []);

  useEffect(() => {
    fetchNotificationCounts();
  }, [fetchNotificationCounts]);

  return {
    notificationCounts,
    loading,
    error,
    fetchNotificationCounts,
    markNotificationsAsRead
  };
};
