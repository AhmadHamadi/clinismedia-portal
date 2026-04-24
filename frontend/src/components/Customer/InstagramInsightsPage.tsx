import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  FaChartLine,
  FaExclamationTriangle,
  FaEye,
  FaGlobe,
  FaHashtag,
  FaImages,
  FaInstagram,
  FaMousePointer,
  FaSpinner,
  FaUsers,
} from 'react-icons/fa';
import { format, subDays } from 'date-fns';

interface InstagramTopPost {
  media_id: string;
  caption: string;
  permalink: string;
  posted_at: string;
  metrics: {
    reach?: number;
    impressions?: number;
    likes?: number;
    comments?: number;
    saves?: number;
    engagement?: number;
    plays?: number;
  };
}

interface InstagramInsightsResponse {
  totalReach: number;
  totalImpressions: number;
  totalProfileViews: number;
  totalWebsiteClicks: number;
  followerCount: number;
  avgEngagement: number;
  topPosts: InstagramTopPost[];
  periodComparison: {
    reachChange: number;
    impressionsChange: number;
    profileViewsChange: number;
    engagementChange: number;
  };
  connection?: {
    instagramAccountId?: string | null;
    instagramAccountName?: string | null;
    instagramUsername?: string | null;
    facebookPageName?: string | null;
  };
  syncStatus?: {
    synced?: boolean;
    reason?: string;
    error?: string;
    userMetricsUpserted?: number;
    mediaUpserted?: number;
  };
}

const metricCardClasses = 'rounded-lg border border-gray-200 bg-white p-4';

interface InsightRangeOption {
  key: string;
  label: string;
  start: Date;
  end: Date;
}

const InstagramInsightsPage: React.FC = () => {
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRangeKey, setSelectedRangeKey] = useState<string>('last30Days');
  const [insights, setInsights] = useState<InstagramInsightsResponse | null>(null);

  const now = new Date(Date.now());
  const rangeOptions = useMemo<InsightRangeOption[]>(() => ([
    {
      key: 'last7Days',
      label: 'Last 7 days',
      start: subDays(now, 6),
      end: now,
    },
    {
      key: 'last30Days',
      label: 'Last 30 days',
      start: subDays(now, 29),
      end: now,
    },
    {
      key: 'last90Days',
      label: 'Last 90 days',
      start: subDays(now, 89),
      end: now,
    },
  ]), [now]);

  const selectedRange = rangeOptions.find((range) => range.key === selectedRangeKey) || rangeOptions[1];
  useEffect(() => {
    void fetchInsights(selectedRange.key);
  }, [selectedRange.key]);

  const getCustomerToken = () => localStorage.getItem('customerToken');

  const fetchInsights = async (rangeKey: string) => {
    setInsightsLoading(true);
    setError(null);

    try {
      const token = getCustomerToken();
      const range = rangeOptions.find((item) => item.key === rangeKey) || rangeOptions[1];
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/instagram-insights/my-insights`,
        {
          params: {
            from: format(range.start, 'yyyy-MM-dd'),
            to: format(range.end, 'yyyy-MM-dd'),
          },
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setInsights(response.data);
    } catch (err: any) {
      console.error('Error fetching Instagram metrics:', err);
      setError(err.response?.data?.error || 'Failed to fetch Instagram metrics');
      setInsights(null);
    } finally {
      setInsightsLoading(false);
    }
  };

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      await fetchInsights(selectedRange.key);
    } finally {
      setRefreshing(false);
    }
  };

  const formatDate = (value: string) => new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const formatSignedChange = (value: number) => {
    if (!Number.isFinite(value)) return '0%';
    const rounded = Math.round(value);
    if (rounded > 0) return `+${rounded}%`;
    return `${rounded}%`;
  };

  const hasAnyNumericData = Boolean(
    insights
    && (
      insights.totalReach
      || insights.totalImpressions
      || insights.totalProfileViews
      || insights.totalWebsiteClicks
      || insights.followerCount
      || insights.topPosts.length
    )
  );

  return (
    <div className="customer-page p-4 sm:p-6 md:p-8 min-h-screen overflow-x-hidden">
      <div className="w-full mx-auto max-w-full xl:max-w-7xl 2xl:max-w-7xl">
        <div className="cm-page-hero mb-6 px-5 py-4">
          <h1 className="text-2xl font-bold flex items-center mb-2">
            <FaInstagram className="mr-3 text-blue-600" />
            Instagram Insights
          </h1>
          <p>
            Live Instagram metrics for your connected Instagram professional account.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-6">
          <div className="space-y-6">
            <div className="cm-panel-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Timeframe</h2>
                <button
                  onClick={refreshAll}
                  disabled={refreshing}
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                >
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {rangeOptions.map((range) => {
                  const isSelected = selectedRangeKey === range.key;

                  return (
                    <button
                      key={range.key}
                      className={`text-left px-4 py-3 rounded-lg font-medium border transition-all ${
                        isSelected
                          ? 'bg-blue-100 border-blue-400 text-blue-900'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-blue-50'
                      }`}
                      onClick={() => setSelectedRangeKey(range.key)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span>{range.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="cm-panel-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Connection</h2>
              <div className="space-y-3 text-sm text-gray-700">
                <div>
                  <p className="text-gray-500">Instagram account</p>
                  <p className="font-semibold">
                    {insights?.connection?.instagramUsername
                      ? `@${insights.connection.instagramUsername}`
                      : insights?.connection?.instagramAccountName || 'Not linked'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Facebook page</p>
                  <p className="font-semibold">{insights?.connection?.facebookPageName || 'Not connected'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Sync status</p>
                  <p className="font-semibold">
                    {insights?.syncStatus?.synced
                      ? 'Meta sync completed'
                      : insights?.syncStatus?.reason || 'Waiting for sync'}
                  </p>
                  {typeof insights?.syncStatus?.userMetricsUpserted === 'number' && (
                    <p className="text-xs text-gray-500 mt-1">
                      {insights.syncStatus.userMetricsUpserted} user metric rows, {insights.syncStatus.mediaUpserted || 0} media rows updated
                    </p>
                  )}
                </div>
              </div>
            </div>

          </div>

          <div className="space-y-6">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 flex items-start gap-3">
                <FaExclamationTriangle className="mt-1 shrink-0" />
                <div>{error}</div>
              </div>
            )}

            <div className="cm-panel-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedRange.label}</h2>
                  <p className="text-sm text-gray-600">
                    Live Meta data for {format(selectedRange.start, 'MMM d')} to {format(selectedRange.end, 'MMM d, yyyy')}
                  </p>
                </div>
                {insightsLoading && (
                  <div className="flex items-center text-sm text-gray-500">
                    <FaSpinner className="animate-spin mr-2" />
                    Syncing and loading
                  </div>
                )}
              </div>

              {insightsLoading ? (
                <div className="flex items-center justify-center min-h-64 text-gray-500">
                  <FaSpinner className="animate-spin mr-2" />
                  Loading Instagram metrics...
                </div>
              ) : hasAnyNumericData && insights ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <div className={metricCardClasses}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500">Reach</span>
                        <FaUsers className="text-blue-600" />
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{insights.totalReach.toLocaleString()}</p>
                      <p className="text-sm text-gray-500 mt-1">{formatSignedChange(insights.periodComparison.reachChange)} vs prior period</p>
                    </div>
                    <div className={metricCardClasses}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500">Impressions</span>
                        <FaEye className="text-blue-600" />
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{insights.totalImpressions.toLocaleString()}</p>
                      <p className="text-sm text-gray-500 mt-1">{formatSignedChange(insights.periodComparison.impressionsChange)} vs prior period</p>
                    </div>
                    <div className={metricCardClasses}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500">Profile Views</span>
                        <FaInstagram className="text-blue-600" />
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{insights.totalProfileViews.toLocaleString()}</p>
                      <p className="text-sm text-gray-500 mt-1">{formatSignedChange(insights.periodComparison.profileViewsChange)} vs prior period</p>
                    </div>
                    <div className={metricCardClasses}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500">Website Clicks</span>
                        <FaGlobe className="text-blue-600" />
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{insights.totalWebsiteClicks.toLocaleString()}</p>
                      <p className="text-sm text-gray-500 mt-1">Traffic from profile actions</p>
                    </div>
                    <div className={metricCardClasses}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500">Follower Count</span>
                        <FaHashtag className="text-blue-600" />
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{insights.followerCount.toLocaleString()}</p>
                      <p className="text-sm text-gray-500 mt-1">Latest stored follower count</p>
                    </div>
                    <div className={metricCardClasses}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500">Avg Engagement</span>
                        <FaChartLine className="text-blue-600" />
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{insights.avgEngagement.toFixed(1)}</p>
                      <p className="text-sm text-gray-500 mt-1">{formatSignedChange(insights.periodComparison.engagementChange)} vs prior period</p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center mb-4">
                      <FaImages className="text-blue-600 mr-2" />
                      <h3 className="text-lg font-semibold text-gray-900">Top Posts</h3>
                    </div>

                    {insights.topPosts.length ? (
                      <div className="space-y-3">
                        {insights.topPosts.slice(0, 5).map((post) => (
                          <div key={post.media_id} className="rounded-lg border border-gray-200 p-4 bg-white">
                            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-sm text-gray-500 mb-2">{formatDate(post.posted_at)}</p>
                                <p className="text-sm text-gray-800 line-clamp-3">
                                  {post.caption || 'No caption'}
                                </p>
                                {post.permalink && (
                                  <a
                                    href={post.permalink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700"
                                  >
                                    <FaMousePointer className="mr-2" />
                                    View post
                                  </a>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm min-w-[220px]">
                                <div className="rounded-md bg-gray-50 p-3">
                                  <p className="text-gray-500">Engagement</p>
                                  <p className="font-semibold text-gray-900">{Number(post.metrics.engagement || 0).toLocaleString()}</p>
                                </div>
                                <div className="rounded-md bg-gray-50 p-3">
                                  <p className="text-gray-500">Reach</p>
                                  <p className="font-semibold text-gray-900">{Number(post.metrics.reach || 0).toLocaleString()}</p>
                                </div>
                                <div className="rounded-md bg-gray-50 p-3">
                                  <p className="text-gray-500">Saves</p>
                                  <p className="font-semibold text-gray-900">{Number(post.metrics.saves || 0).toLocaleString()}</p>
                                </div>
                                <div className="rounded-md bg-gray-50 p-3">
                                  <p className="text-gray-500">Plays</p>
                                  <p className="font-semibold text-gray-900">{Number(post.metrics.plays || 0).toLocaleString()}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
                        No post-level metrics were returned for this month yet.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                  <FaInstagram className="text-5xl text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Live Metrics Yet</h3>
                  <p className="text-gray-600 max-w-xl mx-auto">
                    We do not have live Instagram metrics for {selectedRange.label} yet. This usually means the Instagram professional account is not fully linked to the connected Facebook Page, the account was converted recently, or Meta did not return insights for this period.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default InstagramInsightsPage;
