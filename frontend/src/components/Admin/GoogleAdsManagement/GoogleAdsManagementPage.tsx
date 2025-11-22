import React, { useState } from 'react';
import axios from 'axios';
import { 
  FaGoogle, 
  FaSpinner, 
  FaSyncAlt, 
  FaChartLine, 
  FaEye, 
  FaMousePointer, 
  FaDollarSign,
  FaPercentage,
  FaCalendarAlt,
  FaFilter,
  FaDownload,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaPlay,
  FaPause,
  FaStop
} from 'react-icons/fa';
import { useGoogleAdsManagement, Customer, GoogleAdsAccount, GoogleAdsInsights, GoogleAdsCampaign } from './GoogleAdsManagementLogic';

const GoogleAdsManagementPage: React.FC = () => {
  const {
    customers,
    loading,
    error,
    selectedCustomer,
    accounts,
    selectedAccount,
    insights,
    campaigns,
    oauthStatus,
    oauthError,
    refreshing,
    dateRange,
    customDateRange,
    setSelectedAccount,
    setSelectedCustomer,
    setDateRange,
    setCustomDateRange,
    handleConnectGoogleAds,
    handleSaveAccount,
    handleDisconnectGoogleAds,
    getGoogleAdsStatus,
    fetchCustomers,
    assignGoogleAdsAccount,
    fetchGoogleAdsInsights,
    fetchGoogleAdsCampaigns,
    fetchGoogleAdsAccounts,
    setOauthStatus,
    setOauthError,
  } = useGoogleAdsManagement();

  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<{ [customerId: string]: string }>({});
  const [showCustomDateRange, setShowCustomDateRange] = useState(false);
  const [selectedCustomerForInsights, setSelectedCustomerForInsights] = useState<Customer | null>(null);

  // Handle dropdown change
  const handleAssignAccount = async (customer: Customer, accountId: string) => {
    setAssigning(customer._id);
    setSelectedAccounts(prev => ({ ...prev, [customer._id]: accountId }));
    const selectedAccount = accounts.find(a => a.id === accountId);
    if (!selectedAccount) {
      setAssigning(null);
      return;
    }
    await assignGoogleAdsAccount(customer, selectedAccount);
    setAssigning(null);
  };

  // Top-level Connect Google Ads button - Connect as ADMIN
  const handleTopConnect = async () => {
    try {
      setOauthStatus('loading');
      setOauthError(null);
      
      const token = localStorage.getItem('adminToken');
      console.log('🔍 Attempting to connect Google Ads...');
      console.log('🔍 Token present:', !!token);
      console.log('🔍 API URL:', import.meta.env.VITE_API_BASE_URL);
      
      if (!token) {
        setOauthError('No admin token found. Please log in again.');
        setOauthStatus('error');
        return;
      }
      
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
      console.log('🔍 Calling:', `${apiUrl}/google-ads/auth/admin`);
      
      const response = await axios.get(`${apiUrl}/google-ads/auth/admin`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('🔍 Auth URL received:', response.data.authUrl);
      
      // Redirect to Google OAuth URL
      window.location.href = response.data.authUrl;
    } catch (err: any) {
      console.error("❌ Failed to get Google Ads auth URL", err);
      console.error("❌ Error details:", err.response?.data || err.message);
      setOauthError(`Failed to initiate Google Ads connection: ${err.response?.data?.error || err.message}`);
      setOauthStatus('error');
    }
  };

  // Format currency
  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Format number with commas
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  // Format percentage
  const formatPercentage = (num: number) => {
    return `${num.toFixed(2)}%`;
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'enabled':
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'paused':
        return 'text-yellow-600 bg-yellow-100';
      case 'removed':
      case 'disabled':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'enabled':
      case 'active':
        return <FaPlay className="w-3 h-3" />;
      case 'paused':
        return <FaPause className="w-3 h-3" />;
      case 'removed':
      case 'disabled':
        return <FaStop className="w-3 h-3" />;
      default:
        return <FaTimesCircle className="w-3 h-3" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-[#4285f4] mx-auto mb-4" />
          <p className="text-gray-600">Loading Google Ads management...</p>
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
            className="bg-[#4285f4] hover:bg-blue-700 text-white px-4 py-2 rounded"
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
            <FaGoogle className="text-4xl text-[#4285f4] mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Google Ads Management</h1>
              <p className="text-gray-600">Connect and manage Google Ads accounts for each clinic</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleTopConnect}
              className="flex items-center px-4 py-2 bg-[#4285f4] text-white rounded-lg font-semibold hover:bg-[#3367d6]"
            >
              <FaGoogle className="mr-2" /> Connect Google Ads
            </button>
            <button
              onClick={() => {
                fetchCustomers();
                fetchGoogleAdsAccounts();
              }}
              className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
              title="Refresh customer list and Google Ads accounts"
            >
              <FaSyncAlt className="mr-2" /> Refresh
            </button>
          </div>
        </div>

        {/* Date Range Selector */}
        <div className="mb-6 bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <FaCalendarAlt className="mr-2" /> Date Range
            </h3>
            <div className="flex items-center gap-3">
              <select
                value={dateRange}
                onChange={(e) => {
                  const value = e.target.value as '7d' | '30d' | 'custom';
                  setDateRange(value);
                  setShowCustomDateRange(value === 'custom');
                }}
                className="border rounded px-3 py-2"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="custom">Custom range</option>
              </select>
              {showCustomDateRange && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customDateRange.start}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="border rounded px-2 py-1"
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={customDateRange.end}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="border rounded px-2 py-1"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* OAuth Error */}
        {oauthError && (
          <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50">
            {oauthError}
          </div>
        )}

        {/* Success Message */}
        {oauthStatus === 'success' && (
          <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50">
            <FaCheckCircle className="inline mr-2" />
            Google Ads account connected successfully!
          </div>
        )}

        {/* Customers Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Clinic Google Ads Assignments</h2>
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
                    Google Ads Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {customers.map((customer) => {
                  const googleAdsStatus = getGoogleAdsStatus(customer);
                  const assignedAccountId = customer.googleAdsCustomerId;
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
                        {googleAdsStatus.connected ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <FaCheckCircle className="w-3 h-3 mr-1" />
                            Connected
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            <FaTimesCircle className="w-3 h-3 mr-1" />
                            Not Connected
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <select
                          className="border rounded px-2 py-1 w-full"
                          value={selectedAccounts[customer._id] || assignedAccountId || ''}
                          onChange={e => handleAssignAccount(customer, e.target.value)}
                          disabled={assigning === customer._id || accounts.length === 0}
                        >
                          <option value="">No account assigned</option>
                          {accounts.map((account: GoogleAdsAccount) => (
                            <option key={account.id} value={account.id}>
                              {account.name} ({account.currency})
                            </option>
                          ))}
                        </select>
                        {assigning === customer._id && (
                          <span className="ml-2 text-xs text-blue-600">
                            <FaSpinner className="inline animate-spin" /> Assigning...
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex gap-2">
                          {googleAdsStatus.connected ? (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedCustomerForInsights(customer);
                                  fetchGoogleAdsInsights(customer._id);
                                  fetchGoogleAdsCampaigns(customer._id);
                                }}
                                className="text-blue-600 hover:text-blue-800"
                                title="View Insights"
                              >
                                <FaChartLine />
                              </button>
                              <button
                                onClick={() => handleDisconnectGoogleAds(customer)}
                                className="text-red-600 hover:text-red-800"
                                title="Disconnect"
                              >
                                <FaTimesCircle />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleConnectGoogleAds(customer)}
                              className="text-green-600 hover:text-green-800"
                              title="Connect"
                            >
                              <FaGoogle />
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

          {customers.length === 0 && (
            <div className="text-center py-12">
              <FaGoogle className="text-4xl text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No clinics found</h3>
              <p className="text-gray-500">Add some clinics first to manage their Google Ads connections.</p>
            </div>
          )}
        </div>

        {/* Insights Dashboard */}
        {selectedCustomerForInsights && insights && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Google Ads Insights - {selectedCustomerForInsights.name} ({dateRange === 'custom' ? 'Selected Period' : `Last ${dateRange} Days`})
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchGoogleAdsInsights(selectedCustomerForInsights._id, true)}
                  disabled={refreshing === selectedCustomerForInsights._id}
                  className="flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                >
                  {refreshing === selectedCustomerForInsights._id ? (
                    <FaSpinner className="animate-spin mr-1" />
                  ) : (
                    <FaSyncAlt className="mr-1" />
                  )}
                  Refresh
                </button>
                <button className="flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                  <FaDownload className="mr-1" />
                  Export
                </button>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600">Total Impressions</p>
                      <p className="text-2xl font-bold text-blue-900">{formatNumber(insights.totalImpressions)}</p>
                    </div>
                    <FaEye className="text-2xl text-blue-500" />
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-600">Total Clicks</p>
                      <p className="text-2xl font-bold text-green-900">{formatNumber(insights.totalClicks)}</p>
                    </div>
                    <FaMousePointer className="text-2xl text-green-500" />
                  </div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-600">Total Cost</p>
                      <p className="text-2xl font-bold text-purple-900">{formatCurrency(insights.totalCost)}</p>
                    </div>
                    <FaDollarSign className="text-2xl text-purple-500" />
                  </div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-600">CTR</p>
                      <p className="text-2xl font-bold text-orange-900">{formatPercentage(insights.ctr)}</p>
                    </div>
                    <FaPercentage className="text-2xl text-orange-500" />
                  </div>
                </div>
              </div>

              {/* Additional Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Performance Metrics</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Conversion Rate:</span>
                      <span className="font-medium">{formatPercentage(insights.conversionRate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Conversions:</span>
                      <span className="font-medium">{insights.conversions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Cost per Conversion:</span>
                      <span className="font-medium">{formatCurrency(insights.costPerConversion)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Avg. CPC:</span>
                      <span className="font-medium">{formatCurrency(insights.averageCpc)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Impression Share</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Search Impression Share:</span>
                      <span className="font-medium">{formatPercentage(insights.searchImpressionShare)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Display Impression Share:</span>
                      <span className="font-medium">{formatPercentage(insights.displayImpressionShare)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Quality Score:</span>
                      <span className="font-medium">{insights.qualityScore.toFixed(1)}/10</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Video Metrics</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Video Views:</span>
                      <span className="font-medium">{formatNumber(insights.videoViews)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Video View Rate:</span>
                      <span className="font-medium">{formatPercentage(insights.videoViewRate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">25% Complete:</span>
                      <span className="font-medium">{formatPercentage(insights.videoQuartile25Rate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">100% Complete:</span>
                      <span className="font-medium">{formatPercentage(insights.videoQuartile100Rate)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 text-sm text-gray-500">
                Last updated: {new Date(insights.lastUpdated).toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {/* Campaigns Table */}
        {selectedCustomerForInsights && campaigns.length > 0 && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Campaign Performance - {dateRange === 'custom' ? 'Selected Period' : `Last ${dateRange} Days`}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} found
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Campaign
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Impressions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Clicks
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cost
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CTR
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Conversions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{campaign.name}</div>
                        <div className="text-sm text-gray-500">ID: {campaign.id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                          {getStatusIcon(campaign.status)}
                          <span className="ml-1">{campaign.status}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {campaign.type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(campaign.impressions)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(campaign.clicks)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(campaign.cost)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatPercentage(campaign.ctr)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {campaign.conversions}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">How it works</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>• <strong>Connect Google Ads:</strong> Use the button above to authorize and fetch all accounts you manage.</p>
            <p>• <strong>Assign Accounts:</strong> Use the dropdown to assign a Google Ads account to each clinic.</p>
            <p>• <strong>View Insights:</strong> Click the chart icon to view detailed performance metrics and campaign data.</p>
            <p>• <strong>Real-time Updates:</strong> Data refreshes automatically every 5 minutes for connected accounts.</p>
            <p>• <strong>Date Range:</strong> Use the date selector to view data for different time periods.</p>
            <p>• <strong>Export Data:</strong> Use the export button to download insights data.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleAdsManagementPage;
