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
  const [sidebarOpen, setSidebarOpen] = useState(() => (
    typeof window === 'undefined' ? true : window.innerWidth >= 768
  ));



  const handleBack = () => {
    navigate(-1); // Go back to the previous page
  };

  const contentMarginClass = sidebarOpen ? "md:ml-64" : "md:ml-16";

  return (
    <div className="flex min-h-screen bg-gray-100 overflow-x-hidden">
      <EmployeeSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} /> {/* Pass state and setter */}
      <div className={`flex-1 flex flex-col ml-16 ${contentMarginClass} transition-all duration-300 min-w-0`}>
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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{title}</h1>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

export default EmployeePortalLayout;
