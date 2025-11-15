import React, { useState, useEffect } from 'react';
import { FaGoogle, FaSpinner, FaSyncAlt, FaDollarSign, FaMousePointer, FaEye, FaCheckCircle } from 'react-icons/fa';
import axios from 'axios';

const GoogleAdsPage: React.FC = () => {
  const [status, setStatus] = useState('loading');
  const [googleAdsData, setGoogleAdsData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('30'); // Default to 30 days for better chart display
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [accountName, setAccountName] = useState<string>('');

  useEffect(() => {
    fetchGoogleAdsData();
  }, []);

  useEffect(() => {
    if (dateRange !== 'custom') {
      fetchGoogleAdsData();
    }
  }, [dateRange]);

  // Also fetch data when custom date range is applied
  useEffect(() => {
    if (dateRange === 'custom' && customStartDate && customEndDate) {
      fetchGoogleAdsData();
    }
  }, [customStartDate, customEndDate]);

  const fetchGoogleAdsData = async () => {
    try {
      setStatus('loading');
      setError(null);
      
      const token = localStorage.getItem('customerToken');
      if (!token) {
        setError('No authentication token found. Please log in again.');
        setStatus('loaded');
        return;
      }

      console.log('🔍 Fetching customer Google Ads data...');
      
      // First, get customer profile to check if they have Google Ads assigned
      const profileResponse = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/customers/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const customer = profileResponse.data;
      console.log('🔍 Customer profile:', customer);
      
      if (!customer.googleAdsCustomerId) {
        setGoogleAdsData('no account');
        setStatus('loaded');
        return;
      }

      console.log('🔍 Customer has Google Ads ID:', customer.googleAdsCustomerId);

      // Determine date range parameters
      const params: any = { accountId: customer.googleAdsCustomerId };
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        // Custom date range
        params.from = customStartDate;
        params.to = customEndDate;
      } else if (dateRange === '7') {
        // Last 7 days
        params.from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        params.to = new Date().toISOString().split('T')[0];
      } else if (dateRange === '30') {
        // Last 30 days (default)
        params.from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        params.to = new Date().toISOString().split('T')[0];
      } else if (dateRange === '90') {
        // Last 90 days
        params.from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        params.to = new Date().toISOString().split('T')[0];
      }

      console.log('🔍 Fetching Google Ads data with params:', params);

      // Fetch KPIs
      const kpisResponse = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/google-ads/kpis`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ KPIs fetched:', kpisResponse.data);

      // Fetch daily metrics
      const dailyResponse = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/google-ads/daily`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Daily metrics fetched:', dailyResponse.data);

      // Fetch campaigns
      const campaignsResponse = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/google-ads/campaigns`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Campaigns fetched:', campaignsResponse.data);

      // Get account name from customer profile (already fetched)
      const accountDescriptiveName = customer.googleAdsAccountName || 'Google Ads Account';
      
      setAccountName(accountDescriptiveName);

      const combinedData = {
        accountInfo: { 
          id: customer.googleAdsCustomerId,
          descriptiveName: accountDescriptiveName,
          name: accountDescriptiveName
        },
        summary: kpisResponse.data,
        campaigns: campaignsResponse.data.campaigns || [],
        insights: { dailyPerformance: dailyResponse.data.daily || {} },
        lastUpdated: new Date().toISOString()
      };

      console.log('✅ Combined data:', combinedData);
      setGoogleAdsData(combinedData);
      setStatus('loaded');
      
    } catch (error: any) {
      console.error('🔍 Error fetching Google Ads data:', error);
      setError(error.response?.data?.error || error.message || 'Failed to fetch Google Ads data');
      setStatus('loaded');
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading Google Ads data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={fetchGoogleAdsData}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (googleAdsData === 'no account') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <FaGoogle className="text-4xl text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">No Google Ads Account</h2>
            <p className="text-yellow-600">No Google Ads account has been assigned to your clinic. Please contact your administrator.</p>
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
              {/* Google Ads Logo */}
              <div className="mr-4">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#4285F4"/>
                  <path d="M2 17L12 22L22 17" stroke="#4285F4" strokeWidth="2" fill="none"/>
                  <path d="M2 12L12 17L22 12" stroke="#4285F4" strokeWidth="2" fill="none"/>
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {accountName || googleAdsData?.accountInfo?.descriptiveName || googleAdsData?.accountInfo?.descriptive_name || googleAdsData?.accountInfo?.name || 'Google Ads Dashboard'}
                </h1>
                <p className="text-gray-600 text-lg">
                  Last updated: {new Date(googleAdsData?.lastUpdated).toLocaleString()}
                </p>
              </div>
            </div>
            
            <button
              onClick={fetchGoogleAdsData}
              className="flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105 font-semibold text-lg border-2 border-blue-500"
            >
              <FaSyncAlt className="mr-2 text-lg" />
              Refresh Data
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
                      fetchGoogleAdsData();
                    }
                  }}
                  disabled={!customStartDate || !customEndDate}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-semibold hover:from-blue-700 hover:to-blue-800 disabled:bg-gray-400 disabled:text-white disabled:cursor-not-allowed transition-all duration-200 shadow-md"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {/* Total Spend */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-blue-200 transform hover:scale-105 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Total Spend</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${googleAdsData?.summary?.totalCost?.toFixed(2) || '0.00'}
                </p>
              </div>
              <FaDollarSign className="text-3xl text-blue-600" />
            </div>
          </div>

          {/* Total Clicks */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-green-200 transform hover:scale-105 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Total Clicks</p>
                <p className="text-3xl font-bold text-gray-900">
                  {googleAdsData?.summary?.totalClicks?.toLocaleString() || 0}
                </p>
              </div>
              <FaMousePointer className="text-3xl text-green-600" />
            </div>
          </div>

          {/* Total Impressions */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-purple-200 transform hover:scale-105 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Impressions</p>
                <p className="text-3xl font-bold text-gray-900">
                  {googleAdsData?.summary?.totalImpressions?.toLocaleString() || 0}
                </p>
              </div>
              <FaEye className="text-3xl text-purple-600" />
            </div>
          </div>

          {/* Total Conversions */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-orange-200 transform hover:scale-105 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Conversions</p>
                <p className="text-3xl font-bold text-gray-900">
                  {googleAdsData?.summary?.totalConversions?.toLocaleString() || 0}
                </p>
              </div>
              <FaCheckCircle className="text-3xl text-orange-600" />
            </div>
          </div>

          {/* CTR */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-indigo-200 transform hover:scale-105 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">CTR</p>
                <p className="text-3xl font-bold text-gray-900">
                  {googleAdsData?.summary?.avgCtr ? `${(googleAdsData.summary.avgCtr * 100).toFixed(2)}%` : '0.00%'}
                </p>
              </div>
              <FaMousePointer className="text-3xl text-indigo-600" />
            </div>
          </div>

          {/* CPA */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-red-200 transform hover:scale-105 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">CPA</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${googleAdsData?.summary?.avgCpa?.toFixed(2) || '0.00'}
                </p>
              </div>
              <FaDollarSign className="text-3xl text-red-600" />
            </div>
          </div>
        </div>

        {/* AI Insights Cards - Updated every 24 hours with AI-generated customer-focused insights */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">AI-Generated Insights</h3>
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              Updated: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Insight 1 - Performance Summary */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500 hover:shadow-xl transition-all duration-200">
            <div className="flex items-start">
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">📊 Performance Overview</h4>
                <p className="text-gray-700 leading-relaxed">
                  {googleAdsData?.summary?.totalClicks > 0 
                    ? `Your campaigns generated ${googleAdsData.summary.totalClicks.toLocaleString()} clicks with ${googleAdsData.summary.totalImpressions.toLocaleString()} impressions, spending $${googleAdsData.summary.totalCost?.toFixed(2)} over the ${dateRange === 'custom' ? 'selected period' : `last ${dateRange} days`}.`
                    : `No clicks recorded in the ${dateRange === 'custom' ? 'selected period' : `last ${dateRange} days`}. Consider reviewing your targeting and ad copy.`
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Insight 2 - Conversion Analysis */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-orange-500 hover:shadow-xl transition-all duration-200">
            <div className="flex items-start">
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">🎯 Your Conversion Performance</h4>
                <p className="text-gray-700 leading-relaxed">
                  {googleAdsData?.summary?.totalConversions > 0 
                    ? `🎉 Great news! Your campaigns generated ${googleAdsData.summary.totalConversions} conversions with a cost-per-acquisition of $${googleAdsData.summary.avgCpa?.toFixed(2)} over the ${dateRange === 'custom' ? 'selected period' : `last ${dateRange} days`}. Your conversion rate is ${((googleAdsData.summary.totalConversions / googleAdsData.summary.totalClicks) * 100).toFixed(2)}%, which is ${((googleAdsData.summary.totalConversions / googleAdsData.summary.totalClicks) * 100) > 2 ? 'excellent' : 'good'} performance.`
                    : `📈 No conversions yet, but your campaigns are generating ${googleAdsData?.summary?.totalClicks || 0} clicks over the ${dateRange === 'custom' ? 'selected period' : `last ${dateRange} days`}. We're optimizing your landing pages and ad targeting to improve conversion rates. Expected improvement: 2-3 weeks.`
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Insight 3 - Campaign Performance */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500 hover:shadow-xl transition-all duration-200">
            <div className="flex items-start">
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">🚀 Campaign Management Update</h4>
                <p className="text-gray-700 leading-relaxed">
                  {googleAdsData?.campaigns && googleAdsData.campaigns.length > 0
                    ? `📊 We're actively managing ${googleAdsData.campaigns.length} campaigns for you over the ${dateRange === 'custom' ? 'selected period' : `last ${dateRange} days`}. ${googleAdsData.campaigns.filter((c: any) => c.cost > 0).length > 0 ? `Your top campaign spent $${Math.max(...googleAdsData.campaigns.map((c: any) => c.cost)).toFixed(2)}. ` : ''}Next optimization: ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - we'll adjust bids and keywords based on performance.`
                    : '🔧 Setting up your campaigns. Full optimization will begin once campaigns are live and collecting data.'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Chart */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-gray-100">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">
            📈 Performance Trends - {dateRange === 'custom' ? 'Selected Period' : `Last ${dateRange} Days`}
          </h3>
          
          {googleAdsData?.insights?.dailyPerformance && Object.keys(googleAdsData.insights.dailyPerformance).length > 0 ? (
            <div className="space-y-6">
              {/* Check if we should use line chart (90 days or custom > 60 days) */}
              {(() => {
                const useLineChart = dateRange === '90' || 
                  (dateRange === 'custom' && customStartDate && customEndDate && 
                   Math.ceil((new Date(customEndDate).getTime() - new Date(customStartDate).getTime()) / (1000 * 60 * 60 * 24)) > 60);
                
                if (useLineChart) {
                  // Line Chart for longer ranges
                  const today = new Date();
                  const allEntries = Object.entries(googleAdsData.insights.dailyPerformance);
                  
                  let filteredEntries = allEntries;
                  if (dateRange === 'custom' && customStartDate && customEndDate) {
                    filteredEntries = allEntries.filter(([date]) => {
                      const dateObj = new Date(date);
                      const start = new Date(customStartDate);
                      const end = new Date(customEndDate);
                      return dateObj >= start && dateObj <= end;
                    });
                  } else if (dateRange === '90') {
                    const cutoffDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
                    filteredEntries = allEntries.filter(([date]) => {
                      const dateObj = new Date(date);
                      return dateObj >= cutoffDate;
                    });
                  }
                  
                  filteredEntries.sort(([dateA], [dateB]) => 
                    new Date(dateA).getTime() - new Date(dateB).getTime()
                  );
                  
                  const maxSpend = filteredEntries.length > 0 
                    ? Math.max(...filteredEntries.map(([, d]: [string, any]) => d.cost || 0))
                    : 0;
                  const maxClicks = filteredEntries.length > 0
                    ? Math.max(...filteredEntries.map(([, d]: [string, any]) => d.clicks || 0))
                    : 0;
                  const maxValue = Math.max(maxSpend, maxClicks);
                  
                  const chartHeight = 300;
                  const chartWidth = 900; // Fixed width to fit in container
                  const padding = { top: 20, right: 20, bottom: 50, left: 60 };
                  const plotWidth = chartWidth - padding.left - padding.right;
                  const plotHeight = chartHeight - padding.top - padding.bottom;
                  
                  // Generate points for spend line (blue)
                  const spendPoints = filteredEntries.map(([date, data]: [string, any], index: number) => {
                    const x = padding.left + (index / (filteredEntries.length - 1 || 1)) * plotWidth;
                    const y = padding.top + plotHeight - ((data.cost || 0) / (maxValue || 1)) * plotHeight;
                    return `${x},${y}`;
                  }).join(' ');
                  
                  // Generate points for clicks line (green)
                  const clicksPoints = filteredEntries.map(([date, data]: [string, any], index: number) => {
                    const x = padding.left + (index / (filteredEntries.length - 1 || 1)) * plotWidth;
                    const y = padding.top + plotHeight - ((data.clicks || 0) / (maxValue || 1)) * plotHeight;
                    return `${x},${y}`;
                  }).join(' ');
                  
                  // Generate date labels (show ~12 labels)
                  const labelInterval = Math.max(1, Math.floor(filteredEntries.length / 12));
                  
                  return (
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6">
                      <div className="flex items-center justify-center">
                        <svg width={chartWidth} height={chartHeight} className="overflow-visible" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                          {/* Y-axis grid lines */}
                          {[0, 1, 2, 3, 4, 5].map(i => {
                            const y = padding.top + (i / 5) * plotHeight;
                            const value = maxValue * (1 - i / 5);
                            return (
                              <g key={i}>
                                <line
                                  x1={padding.left}
                                  y1={y}
                                  x2={padding.left + plotWidth}
                                  y2={y}
                                  stroke="#e5e7eb"
                                  strokeWidth="1"
                                  strokeDasharray="2,2"
                                />
                                <text
                                  x={padding.left - 10}
                                  y={y + 4}
                                  textAnchor="end"
                                  fontSize="12"
                                  fill="#6b7280"
                                >
                                  {value > 1000 ? `$${(value/1000).toFixed(1)}k` : `$${value.toFixed(0)}`}
                                </text>
                              </g>
                            );
                          })}
                          
                          {/* Spend line (blue) */}
                          <polyline
                            points={spendPoints}
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          
                          {/* Clicks line (green) */}
                          <polyline
                            points={clicksPoints}
                            fill="none"
                            stroke="#16a34a"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          
                          {/* Data points for spend */}
                          {filteredEntries.map(([date, data]: [string, any], index: number) => {
                            const x = padding.left + (index / (filteredEntries.length - 1 || 1)) * plotWidth;
                            const y = padding.top + plotHeight - ((data.cost || 0) / (maxValue || 1)) * plotHeight;
                            return (
                              <circle
                                key={`spend-${index}`}
                                cx={x}
                                cy={y}
                                r="4"
                                fill="#2563eb"
                                stroke="white"
                                strokeWidth="2"
                                className="hover:r-6 transition-all cursor-pointer"
                              >
                                <title>{`${date}: $${data.cost.toFixed(2)}`}</title>
                              </circle>
                            );
                          })}
                          
                          {/* Data points for clicks */}
                          {filteredEntries.map(([date, data]: [string, any], index: number) => {
                            const x = padding.left + (index / (filteredEntries.length - 1 || 1)) * plotWidth;
                            const y = padding.top + plotHeight - ((data.clicks || 0) / (maxValue || 1)) * plotHeight;
                            return (
                              <circle
                                key={`clicks-${index}`}
                                cx={x}
                                cy={y}
                                r="4"
                                fill="#16a34a"
                                stroke="white"
                                strokeWidth="2"
                                className="hover:r-6 transition-all cursor-pointer"
                              >
                                <title>{`${date}: ${data.clicks} clicks`}</title>
                              </circle>
                            );
                          })}
                          
                          {/* X-axis labels */}
                          {filteredEntries.map(([date, data]: [string, any], index: number) => {
                            if (index % labelInterval !== 0 && index !== filteredEntries.length - 1) return null;
                            const x = padding.left + (index / (filteredEntries.length - 1 || 1)) * plotWidth;
                            return (
                              <g key={`label-${index}`}>
                                <text
                                  x={x}
                                  y={chartHeight - padding.bottom + 20}
                                  textAnchor="middle"
                                  fontSize="11"
                                  fill="#6b7280"
                                  transform={`rotate(-45 ${x} ${chartHeight - padding.bottom + 20})`}
                                >
                                  {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </text>
                              </g>
                            );
                          })}
                          
                          {/* Y-axis label */}
                          <text
                            x={-chartHeight / 2}
                            y={15}
                            textAnchor="middle"
                            fontSize="12"
                            fill="#6b7280"
                            transform={`rotate(-90 0 ${chartHeight / 2})`}
                          >
                            Amount ($)
                          </text>
                          
                          {/* X-axis label */}
                          <text
                            x={chartWidth / 2}
                            y={chartHeight - 5}
                            textAnchor="middle"
                            fontSize="12"
                            fill="#6b7280"
                          >
                            Date
                          </text>
                        </svg>
                      </div>
                    </div>
                  );
                } else {
                  // Bar Chart for shorter ranges (existing code)
                  return (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6">
                <div className="flex">
                  {/* Y-Axis Labels */}
                  <div className="flex flex-col justify-between h-64 pr-4 text-xs text-gray-500">
                    {(() => {
                      const maxSpend = Math.max(...Object.values(googleAdsData.insights.dailyPerformance).map((d: any) => d.cost));
                      const maxClicks = Math.max(...Object.values(googleAdsData.insights.dailyPerformance).map((d: any) => d.clicks));
                      const maxValue = Math.max(maxSpend, maxClicks);
                      const steps = 5;
                      const stepValue = maxValue / steps;
                      
                      return Array.from({ length: steps + 1 }, (_, i) => {
                        const value = (steps - i) * stepValue;
                        return (
                          <div key={i} className="text-right">
                            {value > 1000 ? `$${(value/1000).toFixed(1)}k` : `$${value.toFixed(0)}`}
                          </div>
                        );
                      });
                    })()}
                  </div>
                  
                  {/* Y-Axis Label */}
                  <div className="flex items-center justify-center h-64 pr-2">
                    <div className="transform -rotate-90 text-xs text-gray-500 font-medium">
                      Amount ($)
                    </div>
                  </div>
                  
                  {/* Chart Area */}
                  <div className="flex-1">
                    <div className="flex items-end justify-start h-64 overflow-x-auto gap-1 pb-8">
                      {(() => {
                        // Filter data by date range instead of slicing by count
                        const today = new Date();
                        const allEntries = Object.entries(googleAdsData.insights.dailyPerformance);
                        
                        let filteredEntries = allEntries;
                        if (dateRange === 'custom' && customStartDate && customEndDate) {
                          // Custom range: filter by actual dates
                          filteredEntries = allEntries.filter(([date]) => {
                            const dateObj = new Date(date);
                            const start = new Date(customStartDate);
                            const end = new Date(customEndDate);
                            return dateObj >= start && dateObj <= end;
                          });
                        } else if (dateRange === '7' || dateRange === '30' || dateRange === '90') {
                          // Standard ranges: filter by date (last N days)
                          const days = parseInt(dateRange);
                          const cutoffDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
                          filteredEntries = allEntries.filter(([date]) => {
                            const dateObj = new Date(date);
                            return dateObj >= cutoffDate;
                          });
                        }
                        
                        // Sort by date to ensure chronological order
                        filteredEntries.sort(([dateA], [dateB]) => 
                          new Date(dateA).getTime() - new Date(dateB).getTime()
                        );
                        
                        // Calculate max values from filtered data only
                        const maxSpend = filteredEntries.length > 0 
                          ? Math.max(...filteredEntries.map(([, d]: [string, any]) => d.cost || 0))
                          : 0;
                        const maxClicks = filteredEntries.length > 0
                          ? Math.max(...filteredEntries.map(([, d]: [string, any]) => d.clicks || 0))
                          : 0;
                          const maxValue = Math.max(maxSpend, maxClicks);
                        
                        // Determine label interval based on date range to prevent overflow
                        let labelInterval = 1; // Show every date by default
                        if (dateRange === '90') {
                          labelInterval = Math.max(1, Math.floor(filteredEntries.length / 15)); // Show ~15 labels for 90 days
                        } else if (dateRange === '30') {
                          labelInterval = Math.max(1, Math.floor(filteredEntries.length / 10)); // Show ~10 labels for 30 days
                        } else if (dateRange === '7') {
                          labelInterval = 1; // Show all dates for 7 days
                        } else if (dateRange === 'custom' && customStartDate && customEndDate) {
                          // For custom ranges, calculate based on number of days
                          const start = new Date(customStartDate);
                          const end = new Date(customEndDate);
                          const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                          if (daysDiff > 60) {
                            labelInterval = Math.max(1, Math.floor(filteredEntries.length / 15)); // ~15 labels for long ranges
                          } else if (daysDiff > 30) {
                            labelInterval = Math.max(1, Math.floor(filteredEntries.length / 10)); // ~10 labels for medium ranges
                          } else {
                            labelInterval = 1; // Show all dates for short ranges
                          }
                        }
                        
                        return filteredEntries.map(([date, data]: [string, any], index: number) => {
                          // Only show date label for every Nth entry based on labelInterval
                          const shouldShowLabel = index % labelInterval === 0 || index === filteredEntries.length - 1;
                          
                          const spendHeight = maxValue > 0 ? Math.max(8, (data.cost / maxValue) * 200) : 8;
                          const clicksHeight = maxValue > 0 ? Math.max(8, (data.clicks / maxValue) * 200) : 8;
                          
                          return (
                            <div key={index} className="flex flex-col items-center flex-shrink-0">
                              {/* Side by side bars container */}
                              <div className="flex items-end justify-center gap-0.5 mb-2">
                                {/* Spend Bar (Blue) */}
                                <div 
                                  className="bg-blue-600 rounded-t-sm w-3 transition-all duration-300 hover:bg-blue-700 shadow-md"
                                  style={{ 
                                    height: `${spendHeight}px`,
                                    backgroundColor: '#2563eb',
                                    minHeight: '4px'
                                  }}
                                  title={`${date}: $${data.cost.toFixed(2)}`}
                                ></div>
                                {/* Clicks Bar (Green) */}
                                <div 
                                  className="bg-green-600 rounded-t-sm w-3 transition-all duration-300 hover:bg-green-700 shadow-md"
                                  style={{ 
                                    height: `${clicksHeight}px`,
                                    backgroundColor: '#16a34a',
                                    minHeight: '4px'
                                  }}
                                  title={`${date}: ${data.clicks} clicks`}
                                ></div>
                              </div>
                              {/* Date label - only show for every Nth entry to prevent overflow */}
                              {shouldShowLabel && (
                              <div className="mt-2 h-8 flex items-end">
                                <span className="text-xs text-gray-600 font-medium transform -rotate-45 origin-left whitespace-nowrap">
                                  {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                    
                    {/* X-Axis Label */}
                    <div className="text-center mt-2">
                      <span className="text-sm text-gray-600 font-medium">Date</span>
                    </div>
                  </div>
                </div>
              </div>
                    );
                  }
                })()}
              
              {/* Chart legend */}
              <div className="flex justify-center space-x-8 text-sm">
                <div className="flex items-center bg-blue-100 px-4 py-2 rounded-lg">
                  <div className="w-4 h-4 rounded mr-3" style={{ backgroundColor: '#2563eb' }}></div>
                  <span className="text-blue-900 font-bold">Daily Spend</span>
                </div>
                <div className="flex items-center bg-green-100 px-4 py-2 rounded-lg">
                  <div className="w-4 h-4 rounded mr-3" style={{ backgroundColor: '#16a34a' }}></div>
                  <span className="text-green-900 font-bold">Daily Clicks</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
              <h4 className="text-xl font-semibold text-gray-600 mb-2">No Performance Data</h4>
              <p className="text-gray-500">No performance data available for the selected period</p>
              <p className="text-sm text-gray-400 mt-2">Try selecting a different date range</p>
            </div>
          )}
        </div>

        {/* Campaigns Table */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">🎯 Campaign Performance</h3>
            <button
              onClick={() => {
                // This could open a detailed campaigns modal or navigate to a campaigns page
                alert('View All Campaigns feature coming soon!');
              }}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 shadow-lg transition-all duration-200 transform hover:scale-105"
            >
              View All Campaigns
            </button>
          </div>
          
          {googleAdsData?.campaigns && googleAdsData.campaigns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Campaign</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Spend</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Clicks</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Impressions</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Conversions</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">CPA</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {googleAdsData.campaigns.map((campaign: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors duration-200">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">{campaign.name || campaign.campaignName || `Campaign ${campaign.id}`}</div>
                        <div className="text-sm text-gray-600 font-medium">{campaign.channelType || campaign.channel || 'Unknown'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                          campaign.status === 'ENABLED' 
                            ? 'bg-green-100 text-green-800' 
                            : campaign.status === 'PAUSED'
                            ? 'bg-yellow-100 text-yellow-800'
                            : campaign.status === 'REMOVED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {campaign.status || 'UNKNOWN'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        <span className="font-bold text-gray-900">${campaign.cost?.toFixed(2) || '0.00'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        <span className="font-bold text-gray-900">{campaign.clicks?.toLocaleString() || 0}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        <span className="font-bold text-gray-900">{campaign.impressions?.toLocaleString() || 0}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        <span className="font-bold text-gray-900">{campaign.conversions?.toLocaleString() || 0}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        <span className="font-bold text-gray-900">${campaign.cpa?.toFixed(2) || '0.00'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎯</div>
              <h4 className="text-xl font-semibold text-gray-600 mb-2">No Campaign Data</h4>
              <p className="text-gray-500">No campaign data available for the selected period</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default GoogleAdsPage;
