import React, { useState, useEffect, useMemo } from 'react';
import { FaFacebook, FaChartLine, FaUsers, FaEye, FaHeart, FaComment, FaSpinner, FaExclamationTriangle } from 'react-icons/fa';
import axios from 'axios';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
} from 'recharts';

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
        headers: { Authorization: `Bearer ${token}` },
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
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatComparison = (change: number) => {
    const isPositive = change > 0;
    const isNegative = change < 0;
    return {
      value: Math.abs(change),
      color: isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600',
      bgColor: isPositive ? 'bg-green-100' : isNegative ? 'bg-red-100' : 'bg-gray-100',
      icon: isPositive ? '?' : isNegative ? '?' : '?',
    };
  };

  const formatShortDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const trendData = useMemo(() => {
    if (!insights) return [];
    const base = insights.metrics.impressions || [];
    return base.map((row, idx) => ({
      date: formatShortDate(row.end_time),
      impressions: row.value || 0,
      reach: insights.metrics.reach?.[idx]?.value || 0,
      engagements: insights.metrics.engagements?.[idx]?.value || 0,
      followers: insights.metrics.followers?.[idx]?.value || 0,
      pageViews: insights.metrics.pageViews?.[idx]?.value || 0,
      videoViews: insights.metrics.videoViews?.[idx]?.value || 0,
    }));
  }, [insights]);

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
      <div className="customer-page p-4 sm:p-6 md:p-8 overflow-x-hidden w-full max-w-6xl xl:max-w-7xl 2xl:max-w-7xl mx-auto">
        <div className="cm-page-hero mb-6 px-5 py-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center mb-2">
            <FaFacebook className="mr-3 text-blue-600" />
            Meta Insights
          </h1>
          <p className="text-gray-600">View your Facebook page insights and analytics</p>
        </div>

        <div className="cm-panel p-6">
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
      <div className="customer-page p-4 sm:p-6 md:p-8 overflow-x-hidden w-full max-w-6xl xl:max-w-7xl 2xl:max-w-7xl mx-auto">
        <div className="cm-panel p-6 text-center">
          <p className="text-gray-600">No insights data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-page fbinsights-page p-4 sm:p-6 md:p-8 min-h-screen overflow-x-hidden">
      <div className="w-full mx-auto max-w-full xl:max-w-7xl 2xl:max-w-7xl">
        <div className="cm-page-hero mb-6 px-5 py-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center mb-2">
            <FaFacebook className="mr-3 text-blue-600" />
            Meta Insights
          </h1>
          <p className="text-gray-600">View your Facebook page insights and analytics for {insights.pageInfo.name}</p>
        </div>

        <div className="cm-panel p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Page: {insights.pageInfo.name}
              </span>
              <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                Period: {insights.period.start} - {insights.period.end}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {monthRanges.map((range) => (
                <button
                  key={range.label}
                  onClick={() => handleSelectRange(range)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    selectedRange?.label === range.label
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          {[
            {
              key: 'impressions',
              label: 'Impressions',
              value: insights.summary.totalImpressions,
              icon: <FaEye className="text-blue-600" />,
              delta: insights.comparisons.impressionsChange,
            },
            {
              key: 'reach',
              label: 'Reach',
              value: insights.summary.totalReach,
              icon: <FaUsers className="text-green-600" />,
              delta: insights.comparisons.reachChange,
            },
            {
              key: 'engagements',
              label: 'Engagements',
              value: insights.summary.totalEngagements,
              icon: <FaHeart className="text-red-600" />,
              delta: insights.comparisons.engagementsChange,
            },
            {
              key: 'followers',
              label: 'Followers',
              value: insights.summary.currentFollowers,
              icon: <FaChartLine className="text-purple-600" />,
              delta: insights.comparisons.followersChange,
            },
            {
              key: 'pageViews',
              label: 'Page Views',
              value: insights.summary.totalPageViews,
              icon: <FaEye className="text-indigo-600" />,
              delta: insights.comparisons.pageViewsChange,
            },
            {
              key: 'videoViews',
              label: 'Video Views',
              value: insights.summary.totalVideoViews,
              icon: <FaComment className="text-orange-600" />,
              delta: insights.comparisons.videoViewsChange,
            },
          ].map((item) => {
            const cmp = formatComparison(item.delta);
            return (
              <div key={item.key} className="cm-panel p-4">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{item.label}</span>
                  {item.icon}
                </div>
                <p className="text-2xl font-extrabold text-gray-900 mb-2">{formatNumber(item.value)}</p>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${cmp.bgColor} ${cmp.color}`}>
                  <span className="mr-1">{cmp.icon}</span>{cmp.value}% vs last month
                </span>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          <div className="cm-panel p-6 xl:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Audience Momentum</h3>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="imprGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1877f3" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#1877f3" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="reachGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #dbe7ff' }} />
                <Legend />
                <Area type="monotone" dataKey="impressions" stroke="#1877f3" fill="url(#imprGrad)" strokeWidth={2.5} name="Impressions" />
                <Area type="monotone" dataKey="reach" stroke="#16a34a" fill="url(#reachGrad)" strokeWidth={2.5} name="Reach" />
                <Line type="monotone" dataKey="engagements" stroke="#e63946" strokeWidth={2.5} dot={false} name="Engagements" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="cm-panel p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Behavior Snapshot</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" hide />
                <YAxis />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #dbe7ff' }} />
                <Legend />
                <Bar dataKey="pageViews" fill="#4f46e5" radius={[6, 6, 0, 0]} name="Page Views" />
                <Bar dataKey="videoViews" fill="#f97316" radius={[6, 6, 0, 0]} name="Video Views" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="cm-panel p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Followers Trend</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #dbe7ff' }} />
                <Line type="monotone" dataKey="followers" stroke="#8e44ad" strokeWidth={3} dot={false} name="Followers" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="cm-panel p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">How To Read This</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li><strong>Impressions:</strong> How often your content was shown.</li>
              <li><strong>Reach:</strong> Unique people who saw your content.</li>
              <li><strong>Engagements:</strong> Reactions, comments, and interactions.</li>
              <li><strong>Page / Video Views:</strong> Strong signal for intent and interest.</li>
              <li><strong>Tip:</strong> Compare spikes in engagements to posting days.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacebookInsightsPage;
