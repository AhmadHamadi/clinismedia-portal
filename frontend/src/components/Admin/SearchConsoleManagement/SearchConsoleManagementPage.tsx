import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { FaGoogle, FaSearch, FaSpinner, FaCheckCircle, FaUnlink, FaSave, FaPlug } from 'react-icons/fa';

interface Customer {
  _id: string;
  name: string;
  email: string;
  location?: string;
  websiteUrl?: string | null;
  searchConsolePropertyUrl?: string | null;
}

interface SearchConsoleStatus {
  connected: boolean;
  tokenExpiry: string | null;
  hasRefreshToken: boolean;
}

const normalizeWebsiteSuggestion = (value?: string | null) => {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
};

const buildPropertySuggestions = (websiteUrl?: string | null) => {
  const normalizedWebsite = normalizeWebsiteSuggestion(websiteUrl);
  if (!normalizedWebsite) return [];

  const suggestions = [normalizedWebsite];

  try {
    const hostname = new URL(normalizedWebsite).hostname.toLowerCase();
    const rootHostname = hostname.replace(/^www\./, '');
    const domainSuggestions = [`sc-domain:${hostname}`];

    if (rootHostname && rootHostname !== hostname) {
      domainSuggestions.push(`sc-domain:${rootHostname}`);
    }

    return [...suggestions, ...domainSuggestions];
  } catch {
    return suggestions;
  }
};

const SearchConsoleManagementPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { websiteUrl: string; searchConsolePropertyUrl: string }>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [integrationStatus, setIntegrationStatus] = useState<SearchConsoleStatus | null>(null);
  const [connecting, setConnecting] = useState(false);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const token = localStorage.getItem('adminToken');

  const fetchStatus = async () => {
    try {
      const response = await axios.get(`${apiBaseUrl}/search-console/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setIntegrationStatus(response.data);
    } catch (err) {
      console.error('Failed to fetch Search Console status', err);
    }
  };

  const fetchMappings = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${apiBaseUrl}/search-console/mappings`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const nextCustomers = response.data.customers || [];
      setCustomers(nextCustomers);
      setDrafts(
        Object.fromEntries(
          nextCustomers.map((customer: Customer) => [
            customer._id,
            {
              websiteUrl: customer.websiteUrl || '',
              searchConsolePropertyUrl: customer.searchConsolePropertyUrl || '',
            },
          ])
        )
      );
    } catch (err: any) {
      console.error('Failed to fetch Search Console mappings', err);
      setError(err.response?.data?.error || 'Failed to fetch Search Console mappings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMappings();
    fetchStatus();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('search_console_connected') === 'true') {
      fetchStatus();
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const connectedCount = useMemo(
    () => customers.filter((customer) => !!customer.searchConsolePropertyUrl).length,
    [customers]
  );

  const managedWebsiteOptions = useMemo(() => {
    const seen = new Set<string>();
    return customers
      .map((customer) => normalizeWebsiteSuggestion(customer.websiteUrl))
      .filter((websiteUrl): websiteUrl is string => !!websiteUrl)
      .filter((websiteUrl) => {
        if (seen.has(websiteUrl)) return false;
        seen.add(websiteUrl);
        return true;
      })
      .sort((a, b) => a.localeCompare(b));
  }, [customers]);

  const handleDraftChange = (customerId: string, key: 'websiteUrl' | 'searchConsolePropertyUrl', value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [customerId]: {
        ...(prev[customerId] || { websiteUrl: '', searchConsolePropertyUrl: '' }),
        [key]: value,
      },
    }));
  };

  const handleConnectPortal = async () => {
    try {
      setConnecting(true);
      setError(null);

      const response = await axios.get(`${apiBaseUrl}/search-console/auth/admin-connect`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      window.location.href = response.data.authUrl;
    } catch (err: any) {
      console.error('Failed to start Search Console connection', err);
      setError(err.response?.data?.error || 'Failed to start Search Console connection.');
      setConnecting(false);
    }
  };

  const handleSave = async (customerId: string) => {
    try {
      setSavingId(customerId);
      setError(null);

      const draft = drafts[customerId] || { websiteUrl: '', searchConsolePropertyUrl: '' };
      const response = await axios.post(
        `${apiBaseUrl}/search-console/save-mapping`,
        {
          customerId,
          websiteUrl: draft.websiteUrl,
          searchConsolePropertyUrl: draft.searchConsolePropertyUrl,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setCustomers((prev) =>
        prev.map((customer) => (customer._id === customerId ? response.data.customer : customer))
      );
    } catch (err: any) {
      console.error('Failed to save Search Console mapping', err);
      setError(err.response?.data?.error || 'Failed to save Search Console mapping.');
    } finally {
      setSavingId(null);
    }
  };

  const handleDisconnect = async (customerId: string) => {
    try {
      setSavingId(customerId);
      setError(null);

      const response = await axios.patch(
        `${apiBaseUrl}/search-console/disconnect/${customerId}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setCustomers((prev) =>
        prev.map((customer) => (customer._id === customerId ? response.data.customer : customer))
      );
      setDrafts((prev) => ({
        ...prev,
        [customerId]: {
          ...(prev[customerId] || { websiteUrl: '', searchConsolePropertyUrl: '' }),
          searchConsolePropertyUrl: '',
        },
      }));
    } catch (err: any) {
      console.error('Failed to disconnect Search Console mapping', err);
      setError(err.response?.data?.error || 'Failed to disconnect Search Console property.');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-[#4285f4] mx-auto mb-4" />
          <p className="text-gray-600">Loading Search Console mappings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center">
            <FaGoogle className="text-4xl text-[#4285f4] mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Search Console Mapping</h1>
              <p className="text-gray-600">Map each clinic to the website and Search Console property we should query.</p>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm">
            <span className="font-semibold">{connectedCount}</span> of <span className="font-semibold">{customers.length}</span> clinics mapped
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-6 rounded-lg border border-blue-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Portal Search Console Connection</h2>
              <p className="text-sm text-gray-600 mt-1">
                This connects the portal to Google Search Console so customer dashboards and reports can pull live SEO data.
              </p>
              <div className="mt-3">
                {integrationStatus?.connected ? (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                    <FaCheckCircle className="mr-1" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800">
                    <FaSearch className="mr-1" />
                    Not connected yet
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={handleConnectPortal}
              disabled={connecting}
              className="inline-flex items-center rounded-lg bg-[#4285f4] px-4 py-2 text-sm font-medium text-white hover:bg-[#3367d6] disabled:opacity-60"
            >
              {connecting ? <FaSpinner className="mr-2 animate-spin" /> : <FaPlug className="mr-2" />}
              {integrationStatus?.connected ? 'Reconnect Search Console' : 'Connect Search Console'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Clinic Property Assignments</h2>
              <p className="text-sm text-gray-600 mt-1">
                Save the exact Search Console property string for each clinic, like `https://example.com/` or `sc-domain:example.com`.
              </p>
            </div>
            <button
              onClick={() => {
                fetchMappings();
                fetchStatus();
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clinic</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Website</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Search Console Property</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {customers.map((customer) => {
                  const draft = drafts[customer._id] || {
                    websiteUrl: customer.websiteUrl || '',
                    searchConsolePropertyUrl: customer.searchConsolePropertyUrl || '',
                  };
                  const isSaving = savingId === customer._id;
                  const isConnected = !!customer.searchConsolePropertyUrl;
                  const websiteSuggestions = Array.from(
                    new Set(
                      [
                        normalizeWebsiteSuggestion(customer.websiteUrl),
                        normalizeWebsiteSuggestion(draft.websiteUrl),
                        ...managedWebsiteOptions,
                      ].filter((value): value is string => !!value)
                    )
                  );
                  const propertySuggestions = buildPropertySuggestions(draft.websiteUrl);

                  return (
                    <tr key={customer._id} className="hover:bg-gray-50 align-top">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                        <div className="text-sm text-gray-500">{customer.email}</div>
                        <div className="text-xs text-gray-400 mt-1">{customer.location || 'No location set'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2 min-w-[260px]">
                          <select
                            value={draft.websiteUrl}
                            onChange={(event) => handleDraftChange(customer._id, 'websiteUrl', event.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white"
                          >
                            <option value="">Select a managed website</option>
                            {websiteSuggestions.map((website) => (
                              <option key={website} value={website}>
                                {website}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={draft.websiteUrl}
                            onChange={(event) => handleDraftChange(customer._id, 'websiteUrl', event.target.value)}
                            placeholder="https://clinicwebsite.com/"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2 min-w-[320px]">
                          <select
                            value={propertySuggestions.includes(draft.searchConsolePropertyUrl) ? draft.searchConsolePropertyUrl : ''}
                            onChange={(event) => {
                              if (event.target.value) {
                                handleDraftChange(customer._id, 'searchConsolePropertyUrl', event.target.value);
                              }
                            }}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white"
                          >
                            <option value="">Choose a suggested property</option>
                            {propertySuggestions.map((property) => (
                              <option key={property} value={property}>
                                {property}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={draft.searchConsolePropertyUrl}
                            onChange={(event) => handleDraftChange(customer._id, 'searchConsolePropertyUrl', event.target.value)}
                            placeholder="https://clinicwebsite.com/ or sc-domain:clinicwebsite.com"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {isConnected ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                            <FaCheckCircle className="mr-1" />
                            Connected
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                            <FaSearch className="mr-1" />
                            Not mapped
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSave(customer._id)}
                            disabled={isSaving}
                            className="inline-flex items-center rounded-lg bg-[#4285f4] px-3 py-2 text-sm font-medium text-white hover:bg-[#3367d6] disabled:opacity-60"
                          >
                            {isSaving ? <FaSpinner className="mr-2 animate-spin" /> : <FaSave className="mr-2" />}
                            Save
                          </button>
                          {isConnected && (
                            <button
                              onClick={() => handleDisconnect(customer._id)}
                              disabled={isSaving}
                              className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                            >
                              <FaUnlink className="mr-2" />
                              Disconnect
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">What to put here</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>- For URL-prefix properties, use the exact property string, like `https://www.hamiltoncitydental.ca/`.</p>
            <p>- For domain properties, use the Search Console domain-property format, like `sc-domain:sevenstoneslandscape.ca`.</p>
            <p>- The website dropdown pulls from managed sites already stored in the portal, and the property dropdown suggests valid Search Console formats from that website.</p>
            <p>- The website field is just your clinic's main website link. The Search Console property field is the property we&apos;ll query in the API.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchConsoleManagementPage;
