import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface DashboardBoxProps {
  title: string;
  description: string;
  onClick: () => void;
  notificationCount?: number;
}

export const DashboardBox = ({ title, description, onClick, notificationCount }: DashboardBoxProps) => {
  console.log('DashboardBox render:', { title, notificationCount });
  
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl bg-white p-6 shadow-md hover:shadow-lg transition flex flex-col justify-center items-center text-center h-48 relative"
    >
      <h2 className="text-xl font-semibold mb-2" style={{ color: "#303b45" }}>
        {title}
      </h2>
      <p className="text-sm text-black">{description}</p>
      {notificationCount && notificationCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] flex items-center justify-center">
          {notificationCount}
        </span>
      )}
    </div>
  );
};

export const useAdminDashboard = () => {
  const [pendingBookingsCount, setPendingBookingsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchPendingBookingsCount = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Count pending bookings
      const pendingCount = response.data.filter((booking: any) => booking.status === 'pending').length;
      console.log('Fetched pending bookings count:', pendingCount);
      setPendingBookingsCount(pendingCount);
    } catch (err) {
      console.error('Error fetching pending bookings count:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingBookingsCount();
  }, []);

  return {
    pendingBookingsCount,
    loading,
    refetchPendingCount: fetchPendingBookingsCount
  };
};
