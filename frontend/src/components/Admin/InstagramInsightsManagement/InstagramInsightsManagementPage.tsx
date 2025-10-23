import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaInstagram, FaSpinner, FaSyncAlt, FaChartLine, FaUsers, FaHeart, FaComment, FaEye, FaSave } from 'react-icons/fa';

interface Customer {
  _id: string;
  name: string;
  email: string;
  instagramAccountId?: string;
  instagramUsername?: string;
}

interface InstagramInsights {
  totalReach: number;
  totalImpressions: number;
  totalProfileViews: number;
  totalWebsiteClicks: number;
  followerCount: number;
  avgEngagement: number;
  topPosts: Array<{
    media_id: string;
    caption: string;
    permalink: string;
    posted_at: string;
    metrics: {
      reach: number;
      impressions: number;
      likes: number;
      comments: number;
      saves: number;
      engagement: number;
    };
  }>;
}

const InstagramInsightsManagementPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [insights, setInsights] = useState<InstagramInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomers(response.data);
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  };

  const fetchInstagramInsights = async (customerId: string) => {
    if (!customerId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/instagram-insights/customer/${customerId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            from: dateRange.from,
            to: dateRange.to
          }
        }
      );
      
      setInsights(response.data);
    } catch (err: any) {
      console.error('Error fetching Instagram insights:', err);
      setError(err.response?.data?.error || 'Failed to fetch Instagram insights');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomer(customerId);
    if (customerId) {
      fetchInstagramInsights(customerId);
    } else {
      setInsights(null);
    }
  };

  const refreshInsights = () => {
    if (selectedCustomer) {
      fetchInstagramInsights(selectedCustomer);
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

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FaInstagram className="text-pink-600 text-3xl mr-3" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Instagram Insights Management</h1>
                <p className="text-gray-600 mt-1">Monitor Instagram performance and engagement metrics</p>
              </div>
            </div>
            <button
              onClick={refreshInsights}
              disabled={loading || !selectedCustomer}
              className="flex items-center px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaSyncAlt className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Customer
              </label>
              <select
                value={selectedCustomer}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              >
                <option value="">Choose a customer...</option>
                {customers.map((customer) => (
                  <option key={customer._id} value={customer._id}>
                    {customer.name} {customer.instagramUsername && `(@${customer.instagramUsername})`}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Date
              </label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Date
              </label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <FaSpinner className="animate-spin text-pink-600 text-4xl mx-auto mb-4" />
            <p className="text-gray-600">Loading Instagram insights...</p>
          </div>
        )}

        {/* Insights Display */}
        {insights && !loading && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center">
                  <FaEye className="text-blue-600 text-2xl mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Reach</p>
                    <p className="text-2xl font-bold text-gray-900">{formatNumber(insights.totalReach)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center">
                  <FaChartLine className="text-green-600 text-2xl mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Impressions</p>
                    <p className="text-2xl font-bold text-gray-900">{formatNumber(insights.totalImpressions)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center">
                  <FaUsers className="text-purple-600 text-2xl mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Profile Views</p>
                    <p className="text-2xl font-bold text-gray-900">{formatNumber(insights.totalProfileViews)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center">
                  <FaHeart className="text-red-600 text-2xl mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Followers</p>
                    <p className="text-2xl font-bold text-gray-900">{formatNumber(insights.followerCount)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center">
                  <FaComment className="text-orange-600 text-2xl mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Avg Engagement</p>
                    <p className="text-2xl font-bold text-gray-900">{insights.avgEngagement.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Posts */}
            {insights.topPosts.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Top Performing Posts</h3>
                <div className="space-y-4">
                  {insights.topPosts.map((post, index) => (
                    <div key={post.media_id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <span className="bg-pink-100 text-pink-800 text-xs font-medium px-2 py-1 rounded-full mr-3">
                              #{index + 1}
                            </span>
                            <span className="text-sm text-gray-500">{formatDate(post.posted_at)}</span>
                          </div>
                          <p className="text-gray-900 mb-3 line-clamp-2">{post.caption}</p>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                            <div className="flex items-center">
                              <FaEye className="text-blue-500 mr-1" />
                              <span className="text-gray-600">Reach: {formatNumber(post.metrics.reach)}</span>
                            </div>
                            <div className="flex items-center">
                              <FaChartLine className="text-green-500 mr-1" />
                              <span className="text-gray-600">Impressions: {formatNumber(post.metrics.impressions)}</span>
                            </div>
                            <div className="flex items-center">
                              <FaHeart className="text-red-500 mr-1" />
                              <span className="text-gray-600">Likes: {formatNumber(post.metrics.likes)}</span>
                            </div>
                            <div className="flex items-center">
                              <FaComment className="text-orange-500 mr-1" />
                              <span className="text-gray-600">Comments: {formatNumber(post.metrics.comments)}</span>
                            </div>
                            <div className="flex items-center">
                              <FaSave className="text-purple-500 mr-1" />
                              <span className="text-gray-600">Saves: {formatNumber(post.metrics.saves)}</span>
                            </div>
                          </div>
                        </div>
                        {post.permalink && (
                          <a
                            href={post.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-4 px-3 py-1 bg-pink-600 text-white text-sm rounded-lg hover:bg-pink-700"
                          >
                            View Post
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* No Data State */}
        {!insights && !loading && selectedCustomer && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <FaInstagram className="text-pink-600 text-6xl mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Instagram Insights Found</h3>
            <p className="text-gray-600">
              No Instagram insights data found for the selected customer and date range.
              Make sure the Instagram account is connected and data is being synced via Make.com.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstagramInsightsManagementPage;
