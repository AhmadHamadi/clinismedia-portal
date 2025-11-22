import React, { useState } from 'react';
import { FaFacebook, FaSpinner, FaSyncAlt } from 'react-icons/fa';
import { useFacebookManagement, Customer, FacebookPage } from './FacebookManagementLogic';

const FacebookManagementPage: React.FC = () => {
  const {
    customers,
    loading,
    error,
    pages,
    oauthStatus,
    oauthError,
    handleConnectFacebook,
    fetchCustomers,
    assignFacebookPage,
  } = useFacebookManagement();

  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedPages, setSelectedPages] = useState<{ [customerId: string]: string }>({});

  // Handle dropdown change
  const handleAssignPage = async (customer: Customer, pageId: string) => {
    setAssigning(customer._id);
    setSelectedPages(prev => ({ ...prev, [customer._id]: pageId }));
    const selectedPage = pages.find(p => p.id === pageId);
    if (!selectedPage) {
      setAssigning(null);
      return;
    }
    await assignFacebookPage(customer, selectedPage);
    setAssigning(null);
  };

  // Top-level Connect Facebook button
  const handleTopConnect = () => {
    // Use the first customer just to start the OAuth flow (clinicId is just for state)
    const anyCustomer = customers[0];
    if (anyCustomer) {
      handleConnectFacebook(anyCustomer);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-[#98c6d5] mx-auto mb-4" />
          <p className="text-gray-600">Loading Facebook management...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-[#98c6d5] hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center">
            <FaFacebook className="text-4xl text-[#1877f3] mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Facebook Management</h1>
              <p className="text-gray-600">Assign Facebook Pages to clinics and manage your integration</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleTopConnect}
              className="flex items-center px-4 py-2 bg-[#1877f3] text-white rounded-lg font-semibold hover:bg-[#145db2]"
            >
              <FaFacebook className="mr-2" /> Connect Facebook
            </button>
            <button
              onClick={fetchCustomers}
              className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
              title="Refresh customer list"
            >
              <FaSyncAlt className="mr-2" /> Refresh
            </button>
          </div>
        </div>

        {/* OAuth Error */}
        {oauthError && (
          <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50">
            {oauthError}
          </div>
        )}

        {/* Customers Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Clinic Facebook Assignments</h2>
            <p className="text-sm text-gray-600 mt-1">
              {customers.length} clinic{customers.length !== 1 ? 's' : ''} found
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Clinic
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned Facebook Page
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {customers.map((customer) => {
                  const assignedPageId = customer.facebookPageId;
                  return (
                    <tr key={customer._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                          <div className="text-sm text-gray-500">{customer.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.location || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <select
                          className="border rounded px-2 py-1 w-full"
                          value={selectedPages[customer._id] || assignedPageId || ''}
                          onChange={e => handleAssignPage(customer, e.target.value)}
                          disabled={assigning === customer._id || pages.length === 0}
                        >
                          <option value="">No page assigned</option>
                          {pages.map((page: FacebookPage) => (
                            <option key={page.id} value={page.id}>
                              {page.name}
                            </option>
                          ))}
                        </select>
                        {assigning === customer._id && (
                          <span className="ml-2 text-xs text-blue-600"><FaSpinner className="inline animate-spin" /> Assigning...</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {customers.length === 0 && (
            <div className="text-center py-12">
              <FaFacebook className="text-4xl text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No clinics found</h3>
              <p className="text-gray-500">Add some clinics first to manage their Facebook connections.</p>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">How it works</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>• <strong>Connect Facebook:</strong> Use the button above to authorize and fetch all pages you manage.</p>
            <p>• <strong>Assign Pages:</strong> Use the dropdown to assign a Facebook Page to each clinic.</p>
            <p>• <strong>Re-assign:</strong> You can change the assignment at any time.</p>
            <p>• <strong>Refresh:</strong> Use the refresh button to reload clinics and assignments.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacebookManagementPage; 