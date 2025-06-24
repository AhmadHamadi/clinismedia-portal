import React from "react";
import { useNavigate } from "react-router-dom";
import NotificationCenter from "../NotificationCenter";
import { useCustomerDashboard, Customer } from "./CustomerDashLogic";

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const { customer, loading, error, handleLogout } = useCustomerDashboard();

  const handleLogoutAndNavigate = () => {
    handleLogout();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#98c6d5] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
          <button
            onClick={() => navigate("/login")}
            className="bg-[#98c6d5] hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No customer data found.</p>
          <button
            onClick={() => navigate("/login")}
            className="bg-[#98c6d5] hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {customer.name}! 👋
        </h2>
        <p className="text-gray-600">
          Here's your personalized dashboard where you can manage your projects and view your media assets.
        </p>
      </div>

      {/* Customer Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">Profile</h3>
              <p className="text-gray-600">{customer.email}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">Status</h3>
              <p className="text-green-600 font-medium">Active</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">Member Since</h3>
              <p className="text-gray-600">Recently joined</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Center */}
      <NotificationCenter navigateTo="/customer/notifications"/>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button onClick={() => navigate("/customer/media-day-booking")} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-left">
            <div className="flex items-center">
              <div className="p-2 bg-pink-100 rounded-lg mr-3">
                <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Media Day Booking</h4>
                <p className="text-sm text-gray-600">Schedule your media day</p>
              </div>
            </div>
          </button>

          <button onClick={() => navigate("/customer/dashboard")} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-left">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg mr-3">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Google Integration</h4>
                <p className="text-sm text-gray-600">Connect your Google account</p>
              </div>
            </div>
          </button>

          <button onClick={() => navigate("/customer/dashboard")} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-left">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Facebook Integration</h4>
                <p className="text-sm text-gray-600">Connect your Facebook page</p>
              </div>
            </div>
          </button>

          <button onClick={() => navigate("/customer/dashboard")} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-left">
            <div className="flex items-center">
              <div className="p-2 bg-gray-100 rounded-lg mr-3">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Create a Ticket</h4>
                <p className="text-sm text-gray-600">Get support for your issues</p>
              </div>
            </div>
          </button>

          <button onClick={() => navigate("/customer/invoices")} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-left">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg mr-3">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a2 2 0 012-2h2a2 2 0 012 2v2m-6 4h6a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">View Your Invoice</h4>
                <p className="text-sm text-gray-600">See your billing details</p>
              </div>
            </div>
          </button>

          <button onClick={() => navigate("/customer/gallery")} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-left">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg mr-3">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M16 3h-1a2 2 0 00-2 2v1H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-4V5a2 2 0 00-2-2h-1" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">View Gallery</h4>
                <p className="text-sm text-gray-600">Browse your media assets</p>
              </div>
            </div>
          </button>

          <button onClick={() => navigate("/customer/onboarding-tasks")} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-left">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7M5 7h14M5 11h14M5 17h14" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Onboarding Tasks</h4>
                <p className="text-sm text-gray-600">Complete your onboarding checklist</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard; 