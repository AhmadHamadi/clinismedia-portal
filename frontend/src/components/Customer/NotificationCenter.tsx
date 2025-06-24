import React, { useState, useEffect } from 'react';
import { IoNotificationsOutline } from 'react-icons/io5'; // For the notification icon
import { useNavigate, useLocation } from "react-router-dom"; // Import useNavigate and useLocation
import axios from 'axios';
import { API_BASE_URL } from '../../utils/api';

interface Notification {
  _id: string; // Changed from id to _id to match MongoDB convention
  type: string; // e.g., 'booking', 'onboarding', 'upload', 'invoice', 'support'
  message: string;
  read: boolean;
  link: string; // URL to navigate to
  timestamp: string;
}

interface NotificationCenterProps {
  navigateTo?: string; // Optional prop for custom navigation
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ navigateTo }) => {
  const [generalUnreadCount, setGeneralUnreadCount] = useState<number>(0);
  const navigate = useNavigate(); // Initialize navigate
  const location = useLocation(); // Initialize useLocation

  useEffect(() => {
    const fetchCounts = async () => {
      let token = null;
      let userData = null;
      let role = null;

      // Determine the user's role and get the appropriate token and user data
      if (localStorage.getItem('adminToken')) {
        token = localStorage.getItem('adminToken');
        userData = JSON.parse(localStorage.getItem('adminData') || '{}');
        role = 'admin';
      } else if (localStorage.getItem('customerToken')) {
        token = localStorage.getItem('customerToken');
        userData = JSON.parse(localStorage.getItem('customerData') || '{}');
        role = 'customer';
      } else if (localStorage.getItem('employeeToken')) {
        token = localStorage.getItem('employeeToken');
        userData = JSON.parse(localStorage.getItem('employeeData') || '{}');
        role = 'employee';
      }

      if (!token || !userData || !userData.id) {
        console.error("Authentication token or user data not found.");
        console.log("Token:", token, "User Data:", userData);
        // Optionally, navigate to login or show an error
        return;
      }

      try {
        console.log("Fetching general notifications for user ID:", userData.id, "with role:", role);
        const generalNotificationsResponse = await axios.get(`${API_BASE_URL}/notifications`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        console.log("General Notifications API Response Data:", generalNotificationsResponse.data);
        setGeneralUnreadCount(generalNotificationsResponse.data.filter((n: Notification) => !n.read).length);
        console.log("Calculated General Unread Count:", generalNotificationsResponse.data.filter((n: Notification) => !n.read).length);

      } catch (error) {
        console.error("Failed to fetch counts:", error);
      }
    };

    fetchCounts();

    // Poll for new notifications/tasks every 30 seconds (adjust as needed)
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);

  }, [location.pathname]); // Add location.pathname to dependencies

  const totalUnreadCount = generalUnreadCount;
  console.log("Final Total Unread Count:", totalUnreadCount);

  return (
    <button
      onClick={() => navigate(navigateTo || '/customer/notifications')}
      className="w-full bg-gradient-to-r from-[#98c6d5] to-[#a0d2eb] rounded-lg shadow-md mb-8 p-4 flex items-center justify-between relative overflow-hidden cursor-pointer transition-all duration-200 ease-in-out transform hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 focus:ring-[#98c6d5]"
    >
      <div className="flex items-center">
        <IoNotificationsOutline className="h-8 w-8 text-white mr-3" />
        <h3 className="text-xl font-bold text-white">Notification Center</h3>
        <p className="text-white ml-4 hidden md:block">Stay updated with your latest alerts.</p>
      </div>

      <div className="relative">
        <div className="p-2 rounded-full bg-white bg-opacity-20">
          <IoNotificationsOutline className={`h-6 w-6 ${totalUnreadCount > 0 ? 'text-red-500' : 'text-white'}`} />
          {totalUnreadCount > 0 && (
            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-3 py-1.5 text-sm font-bold leading-none text-red-100 bg-red-600 rounded-full">
              {totalUnreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export default NotificationCenter; 