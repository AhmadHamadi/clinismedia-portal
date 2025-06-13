import React, { useState, useEffect } from 'react';
import { IoNotificationsOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';

interface AdminNotificationPopupProps {
  message: string;
  link: string;
  onClose: () => void;
}

const AdminNotificationPopup: React.FC<AdminNotificationPopupProps> = ({ message, link, onClose }) => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 5000); // Popup disappears after 5 seconds
    return () => clearTimeout(timer);
  }, [onClose]);

  const handleClick = () => {
    setIsVisible(false);
    onClose();
    navigate(link);
  };

  if (!isVisible) return null;

  return (
    <div 
      className="fixed bottom-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg flex items-center cursor-pointer transform transition-all duration-300 ease-out z-50 hover:scale-105"
      onClick={handleClick}
    >
      <IoNotificationsOutline className="h-6 w-6 mr-3" />
      <p className="font-medium">{message}</p>
      <button 
        onClick={(e) => { e.stopPropagation(); setIsVisible(false); onClose(); }}
        className="ml-4 text-white hover:text-gray-200 focus:outline-none"
      >
        &times;
      </button>
    </div>
  );
};

export default AdminNotificationPopup; 