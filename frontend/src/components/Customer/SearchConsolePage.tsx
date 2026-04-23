import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { FaSearch, FaSpinner, FaCheckCircle, FaExclamationTriangle, FaLink, FaGlobe, FaMousePointer, FaEye, FaChartLine } from 'react-icons/fa';
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  BarChart,
  Bar,
} from 'recharts';

interface SearchConsoleOverview {
  customer: {
    _id: string;
    name: string;
    websiteUrl: string | null;
    searchConsolePropertyUrl: string | null;
    searchConsoleConnected: boolean;
  };
  apiReady: boolean;
  message: string;
}

interface SearchConsolePerformance {
  customer: {
    name: string;
    websiteUrl: string | null;
    searchConsolePropertyUrl: string;
  };
  period: {
    start: string;
    end: string;
  };
  summary: {
    totalClicks: number;
    totalImpressions: number;
    avgCtr: number;
    avgPosition: number;
  };
  trend: Array<{
    date: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  topQueries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  topPages: Array<{
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  devices: Array<{
    device: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  countries: Array<{
    country: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}

const SearchConsolePage: React.FC = () => {
  const [overview, setOverview] = useState<SearchConsoleOverview | null>(null);
  const [performance, setPerformance] = useState<SearchConsolePerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('30');

  const token = localStorage.getItem('customerToken');

  const fetchOverview = async () => {
    const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/search-console/my-overview`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return response.data;
  };

  const fetchPerformance = async (days: string) => {
    const end = new Date();
    const start = new Date(end.getTime() - (Number(days) - 1) * 24 * 60 * 60 * 1000);

    const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/search-console/my-performance`, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        from: start.toISOString().split('T')[0],
        to: end.toISOString().split('T')[0],
      },
    });

    return response.data;
  };

  const loadData = async (days: string) => {
    try {
      setLoading(true);
      setError(null);

      const nextOverview = await fetchOverview();
      setOverview(nextOverview);

      if (nextOverview.apiReady && nextOverview.customer?.searchConsolePropertyUrl) {
        const nextPerformance = await fetchPerformance(days);
        setPerformance(nextPerformance);
      } else {
        setPerformance(null);
      }
    } catch (err: any) {
      console.error('Failed to fetch Search Console data:', err);
      setError(err.response?.data?.error || err.response?.data?.details || 'Failed to load Search Console details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(dateRange);
  }, [dateRange]);

  const trendData = useMemo(
    () =>
      (performance?.trend || []).map((row) => ({
        ...row,
        shortDate: new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      })),
    [performance]
  );

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

  if (loading) {
    return (
      <div className="customer-page min-h-screen p-4 sm:p-6 md:p-8 overflow-x-hidden">
        <div className="max-w-6xl xl:max-w-7xl 2xl:max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <FaSpinner className="animate-spin text-4xl text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading Search Console details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="customer-page min-h-screen p-4 sm:p-6 md:p-8 overflow-x-hidden">
        <div className="max-w-6xl xl:max-w-7xl 2xl:max-w-7xl mx-auto">
          <div className="cm-page-hero mb-6 px-5 py-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center mb-2">
              <FaSearch className="mr-3 text-blue-600" />
              Search Console
            </h1>
            <p className="text-gray-600">View your organic search performance</p>
          </div>

          <div className="cm-panel p-6 text-center">
            <FaExclamationTriangle className="text-4xl text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Couldn&apos;t load Search Console</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => loadData(dateRange)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const customer = overview?.customer;
  const isConnected = !!customer?.searchConsoleConnected;

  return (
    <div className="customer-page min-h-screen p-4 sm:p-6 md:p-8 overflow-x-hidden">
      <div className="max-w-6xl xl:max-w-7xl 2xl:max-w-7xl mx-auto">
        <div className="cm-page-hero mb-6 px-5 py-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center mb-2">
            <FaSearch className="mr-3 text-blue-600" />
            Search Console
          </h1>
          <p className="text-gray-600">
            {performance ? 'Google Search performance for your clinic website' : 'Connection status for your clinic&apos;s Search Console property'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="cm-panel p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Property Status</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{isConnected ? 'Mapped' : 'Not Mapped'}</p>
              </div>
              {isConnected ? <FaCheckCircle className="text-2xl text-green-600" /> : <FaExclamationTriangle className="text-2xl text-yellow-500" />}
            </div>
          </div>

          <div className="cm-panel p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Website</p>
                <p className="text-sm font-semibold text-gray-900 mt-2 break-all">{customer?.websiteUrl || 'Not set yet'}</p>
              </div>
              <FaGlobe className="text-2xl text-indigo-600" />
            </div>
          </div>

          <div className="cm-panel p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Property</p>
                <p className="text-sm font-semibold text-gray-900 mt-2 break-all">{customer?.searchConsolePropertyUrl || 'Not set yet'}</p>
              </div>
              <FaLink className="text-2xl text-blue-600" />
            </div>
          </div>
        </div>

        {!overview?.apiReady && (
          <div className="cm-panel p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">What this means right now</h3>
            <p className="text-sm text-gray-700">{overview?.message}</p>
          </div>
        )}

        {performance && (
          <>
            <div className="cm-panel p-5 mb-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Performance Overview</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {performance.period.start} to {performance.period.end}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {['7', '30', '90'].map((days) => (
                    <button
                      key={days}
                      onClick={() => setDateRange(days)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                        dateRange === days
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50'
                      }`}
                    >
                      Last {days} days
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="cm-panel p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Clicks</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">{formatNumber(performance.summary.totalClicks)}</p>
                  </div>
                  <FaMousePointer className="text-2xl text-blue-600" />
                </div>
              </div>
              <div className="cm-panel p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Impressions</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">{formatNumber(performance.summary.totalImpressions)}</p>
                  </div>
                  <FaEye className="text-2xl text-indigo-600" />
                </div>
              </div>
              <div className="cm-panel p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">CTR</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">{formatPercent(performance.summary.avgCtr)}</p>
                  </div>
                  <FaChartLine className="text-2xl text-green-600" />
                </div>
              </div>
              <div className="cm-panel p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Avg Position</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">{performance.summary.avgPosition.toFixed(2)}</p>
                  </div>
                  <FaSearch className="text-2xl text-orange-500" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
              <div className="cm-panel p-6 xl:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Trend</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="shortDate" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#2563eb" strokeWidth={3} dot={false} name="Clicks" />
                    <Line yAxisId="right" type="monotone" dataKey="impressions" stroke="#7c3aed" strokeWidth={3} dot={false} name="Impressions" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="cm-panel p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Devices</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={performance.devices}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="device" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="clicks" fill="#2563eb" radius={[6, 6, 0, 0]} name="Clicks" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
              <div className="cm-panel p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Queries</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Query</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Clicks</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Impressions</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">CTR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {performance.topQueries.map((row) => (
                        <tr key={row.query}>
                          <td className="px-4 py-3 text-sm text-gray-900">{row.query}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{formatNumber(row.clicks)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{formatNumber(row.impressions)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{formatPercent(row.ctr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="cm-panel p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Pages</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Page</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Clicks</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Impressions</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">CTR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {performance.topPages.map((row) => (
                        <tr key={row.page}>
                          <td className="px-4 py-3 text-sm text-gray-900 break-all">{row.page}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{formatNumber(row.clicks)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{formatNumber(row.impressions)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{formatPercent(row.ctr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="cm-panel p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Countries</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Country</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Clicks</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Impressions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {performance.countries.map((row) => (
                        <tr key={row.country}>
                          <td className="px-4 py-3 text-sm text-gray-900 uppercase">{row.country}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{formatNumber(row.clicks)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{formatNumber(row.impressions)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="cm-panel p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Read This Like Search Console</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li><strong>Clicks:</strong> how many times people clicked your result from Google Search.</li>
                  <li><strong>Impressions:</strong> how often your site appeared in search results.</li>
                  <li><strong>CTR:</strong> clicks divided by impressions.</li>
                  <li><strong>Average position:</strong> lower is generally better.</li>
                  <li><strong>Top queries:</strong> the searches driving the most traffic.</li>
                  <li><strong>Top pages:</strong> the landing pages getting visibility in Google.</li>
                </ul>
              </div>
            </div>
          </>
        )}

        {!isConnected && (
          <div className="cm-panel p-6 border border-yellow-200 bg-yellow-50 mt-6">
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">Waiting for admin mapping</h3>
            <p className="text-sm text-yellow-800">
              Your clinic does not have a Search Console property mapped yet. Once the admin adds the correct property, it will show up here automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchConsolePage;
