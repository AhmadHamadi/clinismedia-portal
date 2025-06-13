import React from "react";
import NotificationCenter from "../Customer/NotificationCenter";

const AdminNotificationPage = () => {
  return (
    <div className="flex-1 p-8 overflow-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Notifications</h1>
      <div className="bg-white rounded-lg shadow-md p-6">
        <NotificationCenter navigateTo="/admin/notifications" />
      </div>
    </div>
  );
};

export default AdminNotificationPage; 