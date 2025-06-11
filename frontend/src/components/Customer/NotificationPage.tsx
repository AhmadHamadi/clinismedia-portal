import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  type: string; // e.g., 'booking', 'onboarding', 'upload', 'invoice', 'support'
  message: string;
  read: boolean;
  link: string; // URL to navigate to
  timestamp: string;
}

const NotificationPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Mock fetching notifications - replace with actual API call later
    const fetchedNotifications: Notification[] = [
      {
        id: '1',
        type: 'booking',
        message: 'New booking confirmed for 2024-08-15.',
        read: false,
        link: '/customer/bookings',
        timestamp: '2024-07-20T10:00:00Z',
      },
      {
        id: '2',
        type: 'onboarding',
        message: 'Your onboarding task "Upload ID" is due soon.',
        read: false,
        link: '/customer/onboarding',
        timestamp: '2024-07-19T14:30:00Z',
      },
      {
        id: '3',
        type: 'upload',
        message: 'Your latest content upload has been reviewed.',
        read: true,
        link: '/customer/gallery',
        timestamp: '2024-07-18T09:15:00Z',
      },
      {
        id: '4',
        type: 'invoice',
        message: 'Invoice #CLNM202407001 is now available.',
        read: false,
        link: '/customer/invoices',
        timestamp: '2024-07-17T11:00:00Z',
      },
      {
        id: '5',
        type: 'support',
        message: 'Your support request #1234 has been updated.',
        read: false,
        link: '/customer/support',
        timestamp: '2024-07-16T16:00:00Z',
      },
      {
        id: '6',
        type: 'booking',
        message: 'Reminder: Media day scheduled for next week.',
        read: false,
        link: '/customer/bookings',
        timestamp: '2024-07-21T09:00:00Z',
      },
    ];
    setNotifications(fetchedNotifications);
  }, []);

  const handleNotificationClick = (notificationId: string, link: string) => {
    // Mark as read (for now, just in local state)
    setNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
    );
    navigate(link);
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
              key={notification.id}
              onClick={() => handleNotificationClick(notification.id, notification.link)}
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

export default NotificationPage; 