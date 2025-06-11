import React from 'react';

interface Notification {
  id: number;
  type: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
}

const EmployeeNotificationPage: React.FC = () => {
  const mockNotifications: Notification[] = [
    {
      id: 1,
      type: 'Booking',
      message: 'New media day booking confirmed for March 15, 2024.',
      timestamp: '2 hours ago',
      read: false,
      link: '/employee/media-day-calendar',
    },
    {
      id: 2,
      type: 'Task',
      message: 'New task assigned: "Review client feedback for Project X".',
      timestamp: '1 day ago',
      read: false,
      link: '/employee/tasks',
    },
    {
      id: 3,
      type: 'Payment',
      message: 'Your payment for March 2024 has been processed.',
      timestamp: '2 days ago',
      read: true,
      link: '/employee/payment-receipt',
    },
    {
      id: 4,
      type: 'Availability',
      message: 'Your availability for next week has been updated.',
      timestamp: '3 days ago',
      read: true,
      link: '/employee/edit-availability',
    },
    {
      id: 5,
      type: 'Message',
      message: 'New message from admin: "Regarding your recent project status".',
      timestamp: '4 days ago',
      read: true,
      link: '/employee/messages',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">All Notifications</h2>
      <div className="bg-white rounded-lg shadow-md p-6">
        {mockNotifications.length === 0 ? (
          <p className="text-gray-600">No notifications to display.</p>
        ) : (
          <div className="space-y-4">
            {mockNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 border border-gray-200 rounded-lg ${!notification.read ? 'bg-blue-50' : 'bg-white'}`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className={`font-semibold ${!notification.read ? 'text-blue-700' : 'text-gray-900'}`}>
                    {notification.type} Notification
                  </span>
                  <span className="text-sm text-gray-500">{notification.timestamp}</span>
                </div>
                <p className="text-gray-700">{notification.message}</p>
                {notification.link && (
                  <a href={notification.link} className="text-[#98c6d5] hover:underline text-sm mt-2 block">
                    View Details
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeNotificationPage; 