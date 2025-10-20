import React from 'react';
import { FaFacebook } from 'react-icons/fa';

const FacebookAdsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center">
          <FaFacebook className="text-4xl text-[#1877f2] mr-3" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Facebook Ads Performance</h1>
            <p className="text-gray-600">Facebook Ads integration in development...</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Facebook Ads Dashboard</h2>
          <p className="text-gray-600 mb-4">
            This feature is currently being set up. Please check back later.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              <strong>Status:</strong> Facebook Ads integration in development
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacebookAdsPage;