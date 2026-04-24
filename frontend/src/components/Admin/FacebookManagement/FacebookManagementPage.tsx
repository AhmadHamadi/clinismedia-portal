import React, { useState } from 'react';
import {
  FaCheckCircle,
  FaClock,
  FaFacebook,
  FaInbox,
  FaSpinner,
  FaSyncAlt,
  FaTimesCircle,
} from 'react-icons/fa';
import { useFacebookManagement, Customer, FacebookPage } from './FacebookManagementLogic';

const FacebookManagementPage: React.FC = () => {
  const {
    customers,
    loading,
    error,
    pages,
    oauthError,
    handleConnectFacebook,
    fetchCustomers,
    assignFacebookPage,
    metaLeadsAudit,
    metaLeadsLoading,
    metaLeadsRefreshing,
    metaLeadsError,
    refreshMetaLeadsAudit,
  } = useFacebookManagement();

  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedPages, setSelectedPages] = useState<{ [customerId: string]: string }>({});

  const formatDateTime = (value?: string | null) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString();
  };

  const clinicsWithLeadMappings = metaLeadsAudit?.clinics || [];
  const totalLeads = clinicsWithLeadMappings.reduce((sum, clinic) => sum + (clinic.totalLeads || 0), 0);
  const totalRecentLeads = clinicsWithLeadMappings.reduce((sum, clinic) => sum + (clinic.leadsLast30Days || 0), 0);

  const handleAssignPage = async (customer: Customer, pageId: string) => {
    setAssigning(customer._id);
    setSelectedPages((prev) => ({ ...prev, [customer._id]: pageId }));
    const selectedPage = pages.find((p) => p.id === pageId);
    if (!selectedPage) {
      setAssigning(null);
      return;
    }
    await assignFacebookPage(customer, selectedPage);
    setAssigning(null);
  };

  const handleTopConnect = () => {
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

        {oauthError && (
          <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50">
            {oauthError}
          </div>
        )}

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
                          onChange={(e) => handleAssignPage(customer, e.target.value)}
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
                          <span className="ml-2 text-xs text-blue-600">
                            <FaSpinner className="inline animate-spin" /> Assigning...
                          </span>
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

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">How it works</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>- <strong>Connect Facebook:</strong> Use the button above to authorize and fetch all pages you manage.</p>
            <p>- <strong>Assign Pages:</strong> Use the dropdown to assign a Facebook Page to each clinic.</p>
            <p>- <strong>Meta Leads check:</strong> Use the section below to confirm leads are landing in the portal and separated by clinic.</p>
            <p>- <strong>Refresh:</strong> Use the refresh buttons to reload clinics, assignments, and lead health.</p>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Meta Leads Health Check</h2>
              <p className="text-sm text-gray-600 mt-1">
                This shows the Meta leads currently stored in the portal, separated by clinic.
              </p>
            </div>
            <button
              onClick={refreshMetaLeadsAudit}
              disabled={metaLeadsRefreshing}
              className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50"
            >
              <FaSyncAlt className={`mr-2 ${metaLeadsRefreshing ? 'animate-spin' : ''}`} />
              {metaLeadsRefreshing ? 'Refreshing...' : 'Refresh Lead Health'}
            </button>
          </div>

          {metaLeadsLoading ? (
            <div className="py-12 text-center">
              <FaSpinner className="animate-spin text-3xl text-[#1877f3] mx-auto mb-3" />
              <p className="text-gray-600">Loading Meta lead health...</p>
            </div>
          ) : metaLeadsError ? (
            <div className="p-6">
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                {metaLeadsError}
              </div>
            </div>
          ) : (
            <>
              <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4 border-b border-gray-100">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-500 mb-1">Total Leads</p>
                  <p className="text-2xl font-bold text-gray-900">{totalLeads}</p>
                  <p className="text-sm text-gray-500">Across mapped clinics</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-500 mb-1">Last 30 Days</p>
                  <p className="text-2xl font-bold text-gray-900">{totalRecentLeads}</p>
                  <p className="text-sm text-gray-500">Recent lead volume</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-500 mb-1">Mapped Clinics</p>
                  <p className="text-2xl font-bold text-gray-900">{metaLeadsAudit?.totalMappedClinics ?? 0}</p>
                  <p className="text-sm text-gray-500">Stale clinics: {metaLeadsAudit?.staleClinics ?? 0}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-500 mb-1">Mailbox Poller</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {metaLeadsAudit?.monitoring?.monitoringEnabled ? 'Running' : 'Not Running'}
                  </p>
                  <p className="text-sm text-gray-500">
                    Last success: {formatDateTime(metaLeadsAudit?.monitoring?.lastSuccessfulCheckAt)}
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 border-b border-gray-100 bg-slate-50">
                <div className="flex flex-wrap gap-6 text-sm text-gray-700">
                  <div className="flex items-center">
                    <FaInbox className="mr-2 text-[#1877f3]" />
                    <span>Mailbox: {metaLeadsAudit?.monitoring?.mailboxUser || 'N/A'}</span>
                  </div>
                  <div className="flex items-center">
                    <FaClock className="mr-2 text-[#1877f3]" />
                    <span>Last completed check: {formatDateTime(metaLeadsAudit?.monitoring?.lastCheckCompletedAt)}</span>
                  </div>
                  {metaLeadsAudit?.monitoring?.lastError && (
                    <div className="flex items-center text-red-700">
                      <FaTimesCircle className="mr-2" />
                      <span>{metaLeadsAudit.monitoring.lastError}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clinic</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Facebook Page</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead Totals</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Folder Mapping</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Latest Lead</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {clinicsWithLeadMappings.map((clinic) => {
                      const customer = customers.find((item) => item._id === clinic.customerId);
                      const hasFacebookPage = !!customer?.facebookPageId && !!customer?.facebookPageName;

                      return (
                        <tr key={clinic.customerId} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{clinic.customerName || 'Unknown clinic'}</div>
                            <div className="text-sm text-gray-500">{clinic.customerEmail || customer?.email || 'No email'}</div>
                            <div className="text-xs text-gray-400 mt-1">{clinic.location || customer?.location || 'No location'}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {hasFacebookPage ? (
                              <div>
                                <div className="font-medium">{customer?.facebookPageName}</div>
                                <div className="text-xs text-gray-500 break-all">{customer?.facebookPageId}</div>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">No Facebook page assigned</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="font-semibold">{clinic.totalLeads} total</div>
                            <div className="text-gray-500">{clinic.leadsLast30Days} in last 30 days</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="font-medium">{clinic.folderCount} folder{clinic.folderCount === 1 ? '' : 's'}</div>
                            <div className="text-xs text-gray-500">
                              {clinic.folders.length ? clinic.folders.join(', ') : 'No mapped folders'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {clinic.latestLeadDate ? (
                              <>
                                <div>{formatDateTime(clinic.latestLeadDate)}</div>
                                <div className="text-xs text-gray-500">
                                  {clinic.staleDays === null ? 'Freshness unknown' : `${clinic.staleDays} day${clinic.staleDays === 1 ? '' : 's'} ago`}
                                </div>
                              </>
                            ) : (
                              <span className="text-gray-400 italic">No leads yet</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="space-y-2">
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                  clinic.isStale ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                                }`}
                              >
                                {clinic.isStale ? <FaTimesCircle className="mr-1" /> : <FaCheckCircle className="mr-1" />}
                                {clinic.isStale ? 'Needs attention' : 'Healthy'}
                              </span>
                              {!hasFacebookPage && (
                                <div className="text-xs text-red-600">Facebook page not assigned here yet.</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {clinicsWithLeadMappings.length === 0 && (
                <div className="text-center py-12">
                  <FaFacebook className="text-4xl text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No mapped Meta lead clinics yet</h3>
                  <p className="text-gray-500">
                    Once a clinic has a Meta Leads folder mapping, its lead totals will show up here.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FacebookManagementPage;
