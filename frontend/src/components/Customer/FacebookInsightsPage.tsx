import React, { useState, useEffect } from 'react';
import { FaFacebook, FaEye, FaUsers, FaHeart, FaChartLine, FaSpinner, FaExclamationTriangle } from 'react-icons/fa';
import axios from 'axios';
import { API_BASE_URL } from '../../utils/api';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

interface FacebookInsights {
  pageInfo: {
    id: string;
    name: string;
  };
  period: {
    start: string;
    end: string;
  };
  metrics: {
    impressions: Array<{ value: number; end_time: string }>;
    reach: Array<{ value: number; end_time: string }>;
    engagements: Array<{ value: number; end_time: string }>;
    followers: Array<{ value: number; end_time: string }>;
  };
  summary: {
    totalImpressions: number;
    totalReach: number;
    totalEngagements: number;
    currentFollowers: number;
  };
}

const FacebookInsightsPage: React.FC = () => {
  const [insights, setInsights] = useState<FacebookInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ label: string; start: Date; end: Date } | null>(null);
  const [activeTab, setActiveTab] = useState<'facebook' | 'instagram'>('facebook');
  // Remove all Instagram-related state, effects, chart data, and tab UI. Only keep Facebook Insights logic and charts.

  // Always use real current date for month calculations
  const now = new Date(Date.now());
  const thisMonth = {
    label: `${format(now, 'MMMM yyyy')}`,
    start: startOfMonth(now),
    end: endOfMonth(now),
  };
  const lastMonth = {
    label: `${format(subMonths(now, 1), 'MMMM yyyy')}`,
    start: startOfMonth(subMonths(now, 1)),
    end: endOfMonth(subMonths(now, 1)),
  };
  const twoMonthsAgo = {
    label: `${format(subMonths(now, 2), 'MMMM yyyy')}`,
    start: startOfMonth(subMonths(now, 2)),
    end: endOfMonth(subMonths(now, 2)),
  };
  const monthRanges = [thisMonth, lastMonth, twoMonthsAgo];

  // Helper to check if selected month is in the future
  const isFutureMonth = selectedRange && selectedRange.start > now;
  // Helper to check if all metrics are zero
  const allZero = insights &&
    insights.summary.totalImpressions === 0 &&
    insights.summary.totalReach === 0 &&
    insights.summary.totalEngagements === 0 &&
    insights.summary.currentFollowers === 0;

  const fetchInsights = async (range?: { start: Date; end: Date }) => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('customerToken');
      const customerData = localStorage.getItem('customerData');
      const customer = customerData ? JSON.parse(customerData) : null;
      if (!customer?.id && !customer?._id) {
        throw new Error('Customer data not found');
      }
      const customerId = customer.id || customer._id;
      let url = `${API_BASE_URL}/facebook/insights/${customerId}`;
      if (range) {
        url += `?start=${format(range.start, 'yyyy-MM-dd')}&end=${format(range.end, 'yyyy-MM-dd')}`;
      }
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInsights(response.data);
    } catch (err: any) {
      console.error('Failed to fetch Facebook insights:', err);
      if (err.response?.status === 404) {
        setError('No Facebook page connected. Please contact your administrator to connect a Facebook page.');
      } else {
        setError('Failed to load Facebook insights. Please try again later.');
      }
      setInsights(null);
    } finally {
      setLoading(false);
    }
  };

  // On mount, load this month's report by default
  useEffect(() => {
    setSelectedRange(thisMonth);
    fetchInsights(thisMonth);
    // eslint-disable-next-line
  }, []);

  const handleSelectRange = (range: { label: string; start: Date; end: Date }) => {
    setSelectedRange(range);
    fetchInsights(range);
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
      month: 'short',
      day: 'numeric'
    });
  };

  // Prepare chart data for each metric
  const impressionsData = insights?.metrics.impressions.map(item => ({
    date: formatDate(item.end_time),
    value: item.value,
  })) || [];
  const reachData = insights?.metrics.reach.map(item => ({
    date: formatDate(item.end_time),
    value: item.value,
  })) || [];
  const engagementsData = insights?.metrics.engagements.map(item => ({
    date: formatDate(item.end_time),
    value: item.value,
  })) || [];
  const followersData = insights?.metrics.followers.map(item => ({
    date: formatDate(item.end_time),
    value: item.value,
  })) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-[#98c6d5] mx-auto mb-4" />
          <p className="text-gray-600">Loading Facebook insights...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <FaExclamationTriangle className="text-4xl text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Insights</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-[#98c6d5] hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No insights data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Tab Switcher */}
      <div className="flex gap-4 mb-6">
        <button
          className={`px-4 py-2 rounded ${activeTab === 'facebook' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveTab('facebook')}
        >
          Facebook Insights
        </button>
        <button
          className={`px-4 py-2 rounded ${activeTab === 'instagram' ? 'bg-pink-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveTab('instagram')}
        >
          Instagram Insights
        </button>
      </div>
      {/* Facebook Insights */}
      {activeTab === 'facebook' && (
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
          {/* Sidebar: Month History */}
          <div className="w-full lg:w-1/4 mb-8 lg:mb-0">
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Report History</h3>
              <div className="flex flex-col gap-2">
                {monthRanges.map((range) => (
                  <button
                    key={range.label}
                    className={`text-left px-4 py-2 rounded-lg font-medium border transition-all ${selectedRange?.label === range.label ? 'bg-blue-100 border-blue-400 text-blue-900' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-blue-50'}`}
                    onClick={() => handleSelectRange(range)}
                    disabled={loading}
                  >
                    {range.label} {selectedRange?.label === range.label && <span className="ml-2 text-xs">(Selected)</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Main Content */}
          <div className="flex-1">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center mb-4">
                <FaFacebook className="text-4xl text-[#1877f3] mr-3" />
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Facebook Insights</h1>
                  <p className="text-gray-600">
                    Analytics for {insights?.pageInfo.name} • {insights?.period.start} to {insights?.period.end}
                  </p>
                  {isFutureMonth && (
                    <p className="text-yellow-600 text-sm mt-1">Selected month is in the future. Facebook will not return data for future dates.</p>
                  )}
                </div>
              </div>
              <button
                className="bg-[#1877f3] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#145db2]"
                onClick={() => handleSelectRange(thisMonth)}
                disabled={loading || selectedRange?.label === thisMonth.label}
              >
                View This Month's Report
              </button>
            </div>
            {/* Zero data warning */}
            {allZero && !isFutureMonth && (
              <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 rounded">
                No data found for this period. This may be because the Facebook Page has no activity, or the app does not have the required permissions. Try another month or check with your admin.
              </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <FaEye className="text-2xl text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Impressions</p>
                    <p className="text-2xl font-bold text-gray-900">{formatNumber(insights.summary.totalImpressions)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <FaUsers className="text-2xl text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Reach</p>
                    <p className="text-2xl font-bold text-gray-900">{formatNumber(insights.summary.totalReach)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-red-100 rounded-lg">
                    <FaHeart className="text-2xl text-red-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Engagements</p>
                    <p className="text-2xl font-bold text-gray-900">{formatNumber(insights.summary.totalEngagements)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <FaChartLine className="text-2xl text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Current Followers</p>
                    <p className="text-2xl font-bold text-gray-900">{formatNumber(insights.summary.currentFollowers)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Impressions Chart */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Impressions</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={impressionsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke="#1877f3" strokeWidth={2} name="Impressions" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {/* Reach Chart */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Reach</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={reachData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke="#34a853" strokeWidth={2} name="Reach" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {/* Engagements Chart */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Engagements</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={engagementsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke="#e63946" strokeWidth={2} name="Engagements" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {/* Followers Chart */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Followers</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={followersData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke="#8e44ad" strokeWidth={2} name="Followers" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Info Section */}
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">About These Insights</h3>
              <div className="space-y-2 text-sm text-blue-800">
                <p>• <strong>Impressions:</strong> Number of times your page was seen</p>
                <p>• <strong>Reach:</strong> Number of unique people who saw your page</p>
                <p>• <strong>Engagements:</strong> Total interactions with your page content</p>
                <p>• <strong>Followers:</strong> Number of people following your page</p>
                <p>• Data is updated daily and shows the last 30 days of activity</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Instagram Insights */}
      {activeTab === 'instagram' && (
        <div className="max-w-7xl mx-auto flex flex-col gap-8">
          <div className="mb-8 flex items-center">
            <span className="text-3xl font-bold text-pink-600 mr-3">📸</span>
            <h1 className="text-3xl font-bold text-gray-900">Instagram Insights</h1>
          </div>
          {/* Instagram Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Impressions Chart */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Impressions</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={igImpressionsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="value" stroke="#e1306c" strokeWidth={2} name="Impressions" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Reach Chart */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Reach</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={igReachData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="value" stroke="#fdc800" strokeWidth={2} name="Reach" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Profile Views Chart */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Profile Views</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={igProfileViewsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="value" stroke="#0095f6" strokeWidth={2} name="Profile Views" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Followers Chart */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Followers</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={igFollowersData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="value" stroke="#8e44ad" strokeWidth={2} name="Followers" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacebookInsightsPage; 