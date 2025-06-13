import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface Notification {
  _id: string;
  type: string;
  message: string;
  read: boolean;
  link: string;
  timestamp: string;
}

const EmployeeNotificationPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchNotifications = async () => {
      let token = null;
      let userData = null;

      if (localStorage.getItem('employeeToken')) {
        token = localStorage.getItem('employeeToken');
        userData = JSON.parse(localStorage.getItem('employeeData') || '{}');
      } else if (localStorage.getItem('adminToken')) {
        token = localStorage.getItem('adminToken');
        userData = JSON.parse(localStorage.getItem('adminData') || '{}');
      } else if (localStorage.getItem('customerToken')) {
        token = localStorage.getItem('customerToken');
        userData = JSON.parse(localStorage.getItem('customerData') || '{}');
      }

      if (!token || !userData || !userData.id) {
        console.error("Authentication token or user data not found.");
        return;
      }

      try {
        const response = await axios.get(`http://localhost:5000/api/notifications`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setNotifications(response.data);
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      }
    };

    fetchNotifications();

    const markAllAsRead = async () => {
      let token = null;

      if (localStorage.getItem('employeeToken')) {
        token = localStorage.getItem('employeeToken');
      } else if (localStorage.getItem('adminToken')) {
        token = localStorage.getItem('adminToken');
      } else if (localStorage.getItem('customerToken')) {
        token = localStorage.getItem('customerToken');
      }

      if (!token) {
        console.error("Authentication token not found for marking all notifications as read.");
        return;
      }

      try {
        await axios.put(`http://localhost:5000/api/notifications/mark-all-read`, {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        // No need to update state here, as fetchNotifications will re-fetch and update
      } catch (error) {
        console.error("Failed to mark all notifications as read:", error);
      }
    };

    // Mark all as read after fetching, to ensure the latest count is accurate for the bell
    markAllAsRead();
  }, []);

  const handleNotificationClick = async (notificationId: string, link: string) => {
    const token =
      localStorage.getItem('employeeToken') ||
      localStorage.getItem('adminToken') ||
      localStorage.getItem('customerToken');

    if (!token) {
      console.error("No authentication token found for marking notification as read.");
      navigate(link);
      return;
    }

    try {
      await axios.put(
        `http://localhost:5000/api/notifications/${notificationId}/read`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      setNotifications(prev =>
        prev.map(n => (n._id === notificationId ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    } finally {
      navigate(link);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">All Notifications</h1>

      {notifications.length === 0 ? (
        <div className="p-4 text-center text-gray-500 border border-gray-200 rounded-md">
          You have no notifications.
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <button
              key={notification._id}
              onClick={() => handleNotificationClick(notification._id, notification.link)}
              className={`block w-full text-left p-4 rounded-lg transition-all duration-200 ease-in-out ${
                notification.read ? 'bg-gray-50 text-gray-500' : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
              }`}
            >
              <p className={`font-semibold ${notification.read ? 'text-gray-600' : 'text-blue-900'}`}>
                {notification.message}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(notification.timestamp).toLocaleString()} - {notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeeNotificationPage; 