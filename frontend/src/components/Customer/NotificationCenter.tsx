import React, { useState, useEffect } from 'react';
import { IoNotificationsOutline } from 'react-icons/io5'; // For the notification icon
import { useNavigate } from "react-router-dom"; // Import useNavigate

interface Notification {
  id: string;
  type: string; // e.g., 'booking', 'onboarding', 'upload', 'invoice', 'support'
  message: string;
  read: boolean;
  link: string; // URL to navigate to
  timestamp: string;
}

const NotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const navigate = useNavigate(); // Initialize navigate

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
    ];
    setNotifications(fetchedNotifications);
    setUnreadCount(fetchedNotifications.filter(n => !n.read).length);
  }, []);

  return (
    <button
      onClick={() => navigate('/customer/notifications')}
      className="w-full bg-gradient-to-r from-[#98c6d5] to-[#a0d2eb] rounded-lg shadow-md mb-8 p-4 flex items-center justify-between relative overflow-hidden cursor-pointer transition-all duration-200 ease-in-out transform hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 focus:ring-[#98c6d5]"
    >
      <div className="flex items-center">
        <IoNotificationsOutline className="h-8 w-8 text-white mr-3" />
        <h3 className="text-xl font-bold text-white">Notification Center</h3>
        <p className="text-white ml-4 hidden md:block">Stay updated with your latest alerts.</p>
      </div>

      <div className="relative">
        <div className="p-2 rounded-full bg-white bg-opacity-20">
          <IoNotificationsOutline className="h-6 w-6 text-white" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export default NotificationCenter; 