import React, { useState, useEffect } from 'react';
import { FaFacebook, FaChartLine, FaUsers, FaEye, FaHeart, FaComment, FaShare, FaSpinner, FaExclamationTriangle } from 'react-icons/fa';
import axios from 'axios';
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
    pageViews: Array<{ value: number; end_time: string }>;
    videoViews: Array<{ value: number; end_time: string }>;
  };
  summary: {
    totalImpressions: number;
    totalReach: number;
    totalEngagements: number;
    currentFollowers: number;
    totalPageViews: number;
    totalVideoViews: number;
  };
  previousSummary: {
    totalImpressions: number;
    totalReach: number;
    totalEngagements: number;
    currentFollowers: number;
    totalPageViews: number;
    totalVideoViews: number;
  };
  comparisons: {
    impressionsChange: number;
    reachChange: number;
    engagementsChange: number;
    followersChange: number;
    pageViewsChange: number;
    videoViewsChange: number;
  };
}

const FacebookInsightsPage: React.FC = () => {
  const [insights, setInsights] = useState<FacebookInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ label: string; start: Date; end: Date } | null>(null);
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
    insights.summary.currentFollowers === 0 &&
    insights.summary.totalPageViews === 0 &&
    insights.summary.totalVideoViews === 0;

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
      let url = `${import.meta.env.VITE_API_BASE_URL}/facebook/insights/${customerId}`;
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

  // Helper function to format comparison data
  const formatComparison = (change: number) => {
    const isPositive = change > 0;
    const isNegative = change < 0;
    const isNeutral = change === 0;
    
    return {
      value: Math.abs(change),
      isPositive,
      isNegative,
      isNeutral,
      color: isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600',
      bgColor: isPositive ? 'bg-green-100' : isNegative ? 'bg-red-100' : 'bg-gray-100',
      icon: isPositive ? '↗' : isNegative ? '↘' : '→',
      text: isPositive ? 'up' : isNegative ? 'down' : 'same'
    };
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
  const pageViewsData = insights?.metrics.pageViews.map(item => ({
    date: formatDate(item.end_time),
    value: item.value,
  })) || [];
  const videoViewsData = insights?.metrics.videoViews.map(item => ({
    date: formatDate(item.end_time),
    value: item.value,
  })) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading Facebook insights...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 md:p-8 overflow-x-hidden w-full max-w-6xl xl:max-w-7xl 2xl:max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center mb-2">
            <FaFacebook className="mr-3 text-blue-600" />
            Meta Insights
          </h1>
          <p className="text-gray-600">
            View your Facebook page insights and analytics
          </p>
        </div>

        {/* Error Card */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <FaExclamationTriangle className="text-4xl text-red-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Insights</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="p-4 sm:p-6 md:p-8 overflow-x-hidden w-full max-w-6xl xl:max-w-7xl 2xl:max-w-7xl mx-auto">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <p className="text-gray-600">No insights data available.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 overflow-x-hidden w-full max-w-6xl xl:max-w-7xl 2xl:max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center mb-2">
          <FaFacebook className="mr-3 text-blue-600" />
          Meta Insights
        </h1>
        <p className="text-gray-600">
          View your Facebook page insights and analytics for {insights?.pageInfo.name}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 md:gap-10 w-full">
        {/* Sidebar: Month History */}
        <div className="w-full lg:w-1/4 mb-8 lg:mb-0">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
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
            <button
              className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              onClick={() => handleSelectRange(thisMonth)}
              disabled={loading || selectedRange?.label === thisMonth.label}
            >
              View This Month
            </button>
          </div>
        </div>
        {/* Main Content */}
        <div className="flex-1">
            {/* Period Info */}
            <div className="mb-6">
              <p className="text-gray-600">
                Period: {insights?.period.start} to {insights?.period.end}
              </p>
              {isFutureMonth && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-800 text-sm">Selected month is in the future. Facebook will not return data for future dates.</p>
                </div>
              )}
            </div>
            {/* Zero data warning */}
            {allZero && !isFutureMonth && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800">No data found for this period. This may be because the Facebook Page has no activity, or the app does not have the required permissions. Try another month or check with your admin.</p>
              </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
                <div className="flex items-center">
                  <div className="bg-blue-100 p-3 rounded-lg mr-3">
                    <FaEye className="text-xl text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-600">Total Impressions</p>
                    <p className="text-lg font-bold text-gray-900">{formatNumber(insights.summary.totalImpressions)}</p>
                    {insights.comparisons && (
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${formatComparison(insights.comparisons.impressionsChange).bgColor} ${formatComparison(insights.comparisons.impressionsChange).color}`}>
                        <span className="mr-1">{formatComparison(insights.comparisons.impressionsChange).icon}</span>
                        {formatComparison(insights.comparisons.impressionsChange).value}% vs last month
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <FaUsers className="text-xl text-green-600" />
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-xs font-medium text-gray-600">Total Reach</p>
                    <p className="text-lg font-bold text-gray-900">{formatNumber(insights.summary.totalReach)}</p>
                    {insights.comparisons && (
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${formatComparison(insights.comparisons.reachChange).bgColor} ${formatComparison(insights.comparisons.reachChange).color}`}>
                        <span className="mr-1">{formatComparison(insights.comparisons.reachChange).icon}</span>
                        {formatComparison(insights.comparisons.reachChange).value}% vs last month
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <FaHeart className="text-xl text-red-600" />
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-xs font-medium text-gray-600">Total Engagements</p>
                    <p className="text-lg font-bold text-gray-900">{formatNumber(insights.summary.totalEngagements)}</p>
                    {insights.comparisons && (
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${formatComparison(insights.comparisons.engagementsChange).bgColor} ${formatComparison(insights.comparisons.engagementsChange).color}`}>
                        <span className="mr-1">{formatComparison(insights.comparisons.engagementsChange).icon}</span>
                        {formatComparison(insights.comparisons.engagementsChange).value}% vs last month
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <FaChartLine className="text-xl text-purple-600" />
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-xs font-medium text-gray-600">Current Followers</p>
                    <p className="text-lg font-bold text-gray-900">{formatNumber(insights.summary.currentFollowers)}</p>
                    {insights.comparisons && (
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${formatComparison(insights.comparisons.followersChange).bgColor} ${formatComparison(insights.comparisons.followersChange).color}`}>
                        <span className="mr-1">{formatComparison(insights.comparisons.followersChange).icon}</span>
                        {formatComparison(insights.comparisons.followersChange).value}% vs last month
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Metrics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <FaEye className="text-xl text-indigo-600" />
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-xs font-medium text-gray-600">Page Views</p>
                    <p className="text-lg font-bold text-gray-900">{formatNumber(insights.summary.totalPageViews)}</p>
                    {insights.comparisons && (
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${formatComparison(insights.comparisons.pageViewsChange).bgColor} ${formatComparison(insights.comparisons.pageViewsChange).color}`}>
                        <span className="mr-1">{formatComparison(insights.comparisons.pageViewsChange).icon}</span>
                        {formatComparison(insights.comparisons.pageViewsChange).value}% vs last month
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <FaComment className="text-xl text-orange-600" />
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-xs font-medium text-gray-600">Video Views</p>
                    <p className="text-lg font-bold text-gray-900">{formatNumber(insights.summary.totalVideoViews)}</p>
                    {insights.comparisons && (
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${formatComparison(insights.comparisons.videoViewsChange).bgColor} ${formatComparison(insights.comparisons.videoViewsChange).color}`}>
                        <span className="mr-1">{formatComparison(insights.comparisons.videoViewsChange).icon}</span>
                        {formatComparison(insights.comparisons.videoViewsChange).value}% vs last month
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Impressions Chart */}
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
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
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
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
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
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
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
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
              {/* Page Views Chart */}
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Page Views</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={pageViewsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} name="Page Views" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {/* Video Views Chart */}
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Video Views</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={videoViewsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} name="Video Views" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Info Section */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">About These Insights</h3>
              <div className="space-y-2 text-sm text-blue-800">
                <p>• <strong>Impressions:</strong> Number of times your page was seen</p>
                <p>• <strong>Reach:</strong> Number of unique people who saw your page</p>
                <p>• <strong>Engagements:</strong> Total interactions with your page content</p>
                <p>• <strong>Followers:</strong> Number of people following your page</p>
                <p>• <strong>Page Views:</strong> Total number of times your page was viewed</p>
                <p>• <strong>Video Views:</strong> Number of times your videos were viewed</p>
                <p>• Data is updated daily and shows the last 30 days of activity</p>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
};

export default FacebookInsightsPage; 