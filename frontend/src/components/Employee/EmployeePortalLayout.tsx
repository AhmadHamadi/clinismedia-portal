import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EmployeeSidebar from './EmployeeSidebar'; // Import the new EmployeeSidebar
import { IoMdArrowBack } from "react-icons/io"; // Back arrow icon

interface EmployeePortalLayoutProps {
  children: React.ReactNode;
  title: string; // Title for the page
  hideBackButton?: boolean; // New optional prop
}

const EmployeePortalLayout: React.FC<EmployeePortalLayoutProps> = ({ children, title, hideBackButton }) => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true); // State to manage sidebar open/close

  const handleBack = () => {
    navigate(-1); // Go back to the previous page
  };

  const contentMarginClass = sidebarOpen ? "ml-64" : "ml-16"; // Dynamic margin for content

  return (
    <div className="flex min-h-screen bg-gray-100">
      <EmployeeSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} /> {/* Pass state and setter */}
      <div className={`flex-1 flex flex-col ${contentMarginClass} transition-all duration-300`}>
        {/* Header with Back Button and Title */}
        <header className="bg-white shadow-sm p-4 flex items-center">
          {!hideBackButton && ( // Conditionally render back button
            <button 
              onClick={handleBack} 
              className="mr-4 p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#98c6d5]"
              aria-label="Go back"
            >
              <IoMdArrowBack className="h-6 w-6 text-gray-600" />
            </button>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default EmployeePortalLayout; 