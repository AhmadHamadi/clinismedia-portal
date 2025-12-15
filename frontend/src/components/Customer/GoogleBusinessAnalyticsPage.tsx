import React, { useState, useEffect } from 'react';
import { FaGoogle, FaSpinner, FaSyncAlt, FaEye, FaSearch, FaPhone, FaDirections, FaMousePointer, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import axios from 'axios';

interface ComparisonMetric {
  current: number;
  previous: number;
  change: number;
  changePercent: string;
}

interface GoogleBusinessInsights {
  businessProfileName: string;
  period: {
    start: string;
    end: string;
  };
  summary: {
    totalViews: number;
    totalSearches: number;
    totalCalls: number;
    totalDirections: number;
    totalWebsiteClicks: number;
    // Removed totalConversations - deprecated by Google
  };
  comparison?: {
    totalViews: ComparisonMetric;
    totalSearches: ComparisonMetric;
    totalCalls: ComparisonMetric;
    totalDirections: ComparisonMetric;
    totalWebsiteClicks: ComparisonMetric;
  };
  dailyData: Array<{
    date: string;
    views: number;
    searches: number;
    calls: number;
    directions: number;
    websiteClicks: number;
    // Removed conversations - deprecated by Google
  }>;
  dataSource?: 'stored' | 'live';
  lastUpdated?: string;
}

const GoogleBusinessAnalyticsPage: React.FC = () => {
  const [status, setStatus] = useState('loading');
  const [insights, setInsights] = useState<GoogleBusinessInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('30'); // Default to 30 days
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customer, setCustomer] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchGoogleBusinessData();
  }, []);

  useEffect(() => {
    if (dateRange !== 'custom') {
      fetchGoogleBusinessData();
    }
  }, [dateRange]);

  // Also fetch data when custom date range is applied
  useEffect(() => {
    if (dateRange === 'custom' && customStartDate && customEndDate) {
      fetchGoogleBusinessData();
    }
  }, [customStartDate, customEndDate]);

  const fetchGoogleBusinessData = async (forceRefresh: boolean = false) => {
    try {
      setStatus('loading');
      setError(null);
      
      const token = localStorage.getItem('customerToken');
      if (!token) {
        setError('No authentication token found. Please log in again.');
        setStatus('loaded');
        return;
      }

      console.log('🔍 Fetching customer Google Business Profile data...');
      
      // First, get customer profile to check if they have Google Business Profile assigned
      const profileResponse = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/customers/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const customer = profileResponse.data;
      console.log('🔍 Customer profile:', customer);
      console.log('🔍 Google Business Profile ID:', customer.googleBusinessProfileId);
      console.log('🔍 Google Business Profile Name:', customer.googleBusinessProfileName);
      console.log('🔍 Google Business Access Token:', customer.googleBusinessAccessToken ? 'EXISTS' : 'MISSING');
      
      // Store customer data for header display
      setCustomer(customer);
      
      if (!customer.googleBusinessProfileId) {
        setError('No Google Business Profile connected. Please contact your administrator to connect a Google Business Profile.');
        setStatus('loaded');
        return;
      }

      // Build URL with date range parameters
      let url = `${import.meta.env.VITE_API_BASE_URL}/google-business/business-insights/${customer._id}`;
      const params = new URLSearchParams();
      
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        params.append('start', customStartDate);
        params.append('end', customEndDate);
      } else if (dateRange !== 'custom') {
        params.append('days', dateRange);
      }
      
      // Add forceRefresh parameter to bypass cache when user clicks refresh button
      if (forceRefresh) {
        params.append('forceRefresh', 'true');
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setInsights(response.data);
      setStatus('loaded');
    } catch (err: any) {
      console.error('Failed to fetch Google Business Profile insights:', err);
      console.error('Error response:', err.response?.data);
      
      // Show more specific error messages from backend
      if (err.response?.data?.error) {
        const backendError = err.response.data.error;
        const backendDetails = err.response.data.details;
        const requiresReauth = err.response.data.requiresReauth;
        
        // Check if it's a missing profile/token issue
        if (backendError.includes('Missing customer') || backendError.includes('Missing') || backendError.includes('No access_token')) {
          setError('No Google Business Profile connected. Please contact your administrator to connect a Google Business Profile.');
        } else if (backendError.includes('expired') || backendError.includes('reconnect') || requiresReauth) {
          setError('Google Business Profile connection expired. Please contact your administrator to reconnect.');
        } else if (backendError.includes('token expired') && backendError.includes('refresh the page')) {
          // Token was refreshed, auto-retry immediately
          setError(null); // Clear error
          setTimeout(() => {
            fetchGoogleBusinessData(forceRefresh);
          }, 1000);
        } else {
          // Show the actual backend error message
          setError(backendError + (backendDetails ? ` (${backendDetails})` : ''));
        }
      } else if (err.response?.status === 404) {
        setError('No Google Business Profile connected. Please contact your administrator to connect a Google Business Profile.');
      } else if (err.response?.status === 400) {
        setError('No Google Business Profile connected. Please contact your administrator to connect a Google Business Profile.');
      } else if (err.response?.status === 401) {
        // Authentication error - might be token expiry
        const backendError = err.response?.data?.error || '';
        const requiresReauth = err.response?.data?.requiresReauth;
        
        if (requiresReauth || backendError.includes('expired') || backendError.includes('reconnect')) {
          setError('Google Business Profile connection expired. Please contact your administrator to reconnect.');
        } else if (backendError.includes('refresh the page')) {
          // Token was refreshed, auto-retry
          setError(null);
          setTimeout(() => {
            fetchGoogleBusinessData(forceRefresh);
          }, 1000);
        } else {
          setError('Authentication failed. Please refresh the page and try again.');
        }
      } else if (err.response?.status === 500) {
        // Server error - might be temporary
        setError('Server error occurred. Please try again in a moment or contact support if the issue persists.');
      } else if (!err.response) {
        // Network error
        setError('Network error. Please check your internet connection and try again.');
      } else {
        setError('Failed to load Google Business Profile insights. Please try again later.');
      }
      setStatus('loaded');
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const renderComparisonIndicator = (metric: string) => {
    if (!insights?.comparison || !insights.comparison[metric as keyof typeof insights.comparison]) {
      return null;
    }
    
    const comparison = insights.comparison[metric as keyof typeof insights.comparison];
    const isPositive = comparison.change >= 0;
    const changePercent = Math.abs(parseFloat(comparison.changePercent));
    
    return (
      <div className={`flex items-center text-xs mt-1 ${
        isPositive ? 'text-green-600' : 'text-red-600'
      }`}>
        {isPositive ? (
          <FaCheckCircle className="mr-1" />
        ) : (
          <FaExclamationTriangle className="mr-1" />
        )}
        <span>{changePercent}% vs previous period</span>
      </div>
    );
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDateRangeLabel = () => {
    if (dateRange === 'custom' && customStartDate && customEndDate) {
      return `${formatDate(customStartDate)} - ${formatDate(customEndDate)}`;
    } else if (dateRange === '7') {
      return 'Last 7 days';
    } else if (dateRange === '30') {
      return 'Last 30 days';
    } else if (dateRange === '90') {
      return 'Last 90 days';
    }
    return 'Last 30 days';
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-3">
              <FaSpinner className="animate-spin text-blue-600 text-2xl" />
              <span className="text-lg text-gray-600">Loading Google Business Profile insights...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <FaExclamationTriangle className="text-yellow-500 text-4xl mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Google Business Profile Not Connected</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                  onClick={fetchGoogleBusinessData}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <FaSyncAlt className="mr-2" />
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 md:p-8 overflow-x-hidden">
      <div className="max-w-7xl xl:max-w-7xl 2xl:max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {/* Google Business Logo */}
              <div className="mr-4">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#4285F4"/>
                  <path d="M2 17L12 22L22 17" stroke="#4285F4" strokeWidth="2" fill="none"/>
                  <path d="M2 12L12 17L22 12" stroke="#4285F4" strokeWidth="2" fill="none"/>
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {insights?.businessProfileName || customer?.googleBusinessProfileName || 'Google Business Profile Analytics'}
                </h1>
                <p className="text-gray-600 text-lg">
                  Last updated: {insights?.lastUpdated ? 
                    new Date(insights.lastUpdated).toLocaleString() : 
                    new Date().toLocaleString()
                  }
                  {insights?.dataSource === 'stored' && (
                    <span className="ml-2 text-green-600 text-sm bg-green-100 px-2 py-1 rounded">📊 Stored Data</span>
                  )}
                </p>
              </div>
            </div>
            
            <button
              onClick={() => {
                setIsRefreshing(true);
                fetchGoogleBusinessData(true).finally(() => {
                  setIsRefreshing(false);
                });
              }}
              disabled={isRefreshing || status === 'loading'}
              className={`flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105 font-semibold text-lg border-2 border-blue-500 ${
                isRefreshing || status === 'loading' ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <FaSyncAlt className={`mr-2 text-lg ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>
        </div>

        {/* Date Range Picker */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <h3 className="text-xl font-semibold text-gray-900">Time Period</h3>
            
            <div className="flex flex-wrap items-center gap-4">
              {/* Quick date buttons */}
              <div className="flex gap-3">
                {['7', '30', '90'].map((days) => (
                  <button
                    key={days}
                    onClick={() => setDateRange(days)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      dateRange === days
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200 hover:shadow-md border border-gray-300'
                    }`}
                  >
                    Last {days} days
                  </button>
                ))}
              </div>

              {/* Custom date range */}
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                <span className="text-sm font-semibold text-gray-800">Custom Range:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-2 border-2 border-gray-400 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                />
                <span className="text-gray-700 font-semibold">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-2 border-2 border-gray-400 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                />
                <button
                  onClick={() => {
                    if (customStartDate && customEndDate) {
                      setDateRange('custom');
                      fetchGoogleBusinessData();
                    }
                  }}
                  disabled={!customStartDate || !customEndDate}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-semibold hover:from-blue-700 hover:to-blue-800 disabled:bg-gray-400 disabled:text-gray-600 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
          
        </div>

        {/* Period Info */}
        {insights && (
          <div className="mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <FaCheckCircle className="text-blue-600 mr-2" />
                <span className="text-sm text-blue-800">
                  Data for {insights.period?.start ? formatDate(insights.period.start) : ''} - {insights.period?.end ? formatDate(insights.period.end) : ''} • Last updated: {insights?.lastUpdated ? 
                    new Date(insights.lastUpdated).toLocaleString() : 
                    new Date().toLocaleString()
                  }
                  {insights?.dataSource === 'stored' && (
                    <span className="ml-2 text-green-700">📊 Stored Data</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        {insights && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            {/* Total Views */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-blue-200 transform hover:scale-105 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-semibold">Total Views</p>
                  <p className="text-3xl font-bold text-gray-900">{formatNumber(insights.summary.totalViews)}</p>
                  {renderComparisonIndicator('totalViews')}
                </div>
                <FaEye className="text-3xl text-blue-600" />
              </div>
            </div>

            {/* Total Searches */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-green-200 transform hover:scale-105 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-semibold">Total Searches</p>
                  <p className="text-3xl font-bold text-gray-900">{formatNumber(insights.summary.totalSearches)}</p>
                  {renderComparisonIndicator('totalSearches')}
                </div>
                <FaSearch className="text-3xl text-green-600" />
              </div>
            </div>

            {/* Total Calls */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-purple-200 transform hover:scale-105 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-semibold">Total Calls</p>
                  <p className="text-3xl font-bold text-gray-900">{formatNumber(insights.summary.totalCalls)}</p>
                  {renderComparisonIndicator('totalCalls')}
                </div>
                <FaPhone className="text-3xl text-purple-600" />
              </div>
            </div>

            {/* Total Directions */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-orange-200 transform hover:scale-105 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-semibold">Total Directions</p>
                  <p className="text-3xl font-bold text-gray-900">{formatNumber(insights.summary.totalDirections)}</p>
                  {renderComparisonIndicator('totalDirections')}
                </div>
                <FaDirections className="text-3xl text-orange-600" />
              </div>
            </div>

            {/* Website Clicks */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-indigo-200 transform hover:scale-105 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-semibold">Website Clicks</p>
                  <p className="text-3xl font-bold text-gray-900">{formatNumber(insights.summary.totalWebsiteClicks)}</p>
                  {renderComparisonIndicator('totalWebsiteClicks')}
                </div>
                <FaMousePointer className="text-3xl text-indigo-600" />
              </div>
            </div>
          </div>
        )}

        {/* Daily Performance Table */}
        {insights && insights.dailyData && insights.dailyData.length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Daily Performance</h3>
              <p className="text-sm text-gray-600 mt-1">Day-by-day breakdown of your Google Business Profile performance</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Views</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Searches</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Calls</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Directions</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Website Clicks</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {insights.dailyData.map((day, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatDate(day.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(day.views)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(day.searches)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(day.calls)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(day.directions)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(day.websiteClicks)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : insights && insights.dailyData && insights.dailyData.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="text-center">
              <FaExclamationTriangle className="text-yellow-500 text-4xl mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Daily Data Available</h3>
              <p className="text-gray-600 mb-4">
                No daily performance data is available for the selected time period. This may be because the Google Business Profile was recently connected or there was no activity during this period.
              </p>
              <button
                onClick={() => fetchGoogleBusinessData(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <FaSyncAlt className="mr-2" />
                Refresh Data
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default GoogleBusinessAnalyticsPage;