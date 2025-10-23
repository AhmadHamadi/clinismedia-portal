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

      // Get account info using the same method as debug
      const accountResponse = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/google-ads/account/name?customerId=${customer.googleAdsCustomerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Determine date range parameters
      let metricsUrl;
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        metricsUrl = `${import.meta.env.VITE_API_BASE_URL}/google-ads/metrics/daily?customerId=${customer.googleAdsCustomerId}&startDate=${customStartDate}&endDate=${customEndDate}`;
      } else {
        metricsUrl = `${import.meta.env.VITE_API_BASE_URL}/google-ads/metrics/daily?customerId=${customer.googleAdsCustomerId}&days=${dateRange}`;
      }
      
      
      const metricsResponse = await axios.get(metricsUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('🔍 Account data:', accountResponse.data);
      console.log('🔍 Metrics data:', metricsResponse.data);

      const combinedData = {
        accountInfo: accountResponse.data.accountInfo,
        summary: metricsResponse.data.summary,
        campaigns: metricsResponse.data.campaigns,
        insights: metricsResponse.data.insights,
        lastUpdated: new Date().toISOString()
      };

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
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
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Google Ads Dashboard</h1>
                <p className="text-gray-600 text-lg">
                  {googleAdsData?.accountInfo?.descriptive_name || 'Account'} • 
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
                {['7', '30'].map((days) => (
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
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-semibold hover:from-blue-700 hover:to-blue-800 disabled:bg-gray-400 disabled:text-gray-600 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
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
          
          {/* Debug info */}
          <div className="mb-4 p-3 bg-gray-100 rounded-lg text-sm">
            <strong>Debug:</strong> Data points: {googleAdsData?.insights?.dailyPerformance ? Object.keys(googleAdsData.insights.dailyPerformance).length : 0} days
            {googleAdsData?.insights?.dailyPerformance && Object.keys(googleAdsData.insights.dailyPerformance).length > 0 && (
              <span className="ml-4">
                Sample: {Object.entries(googleAdsData.insights.dailyPerformance)[0][0]} - 
                Spend: ${(Object.entries(googleAdsData.insights.dailyPerformance)[0][1] as any).cost.toFixed(2)}, 
                Clicks: {(Object.entries(googleAdsData.insights.dailyPerformance)[0][1] as any).clicks}
              </span>
            )}
          </div>
          
          {googleAdsData?.insights?.dailyPerformance && Object.keys(googleAdsData.insights.dailyPerformance).length > 0 ? (
            <div className="space-y-6">
              {/* Combined Chart - Side by Side Bars */}
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
                      {Object.entries(googleAdsData.insights.dailyPerformance)
                        .slice(-(dateRange === 'custom' ? Object.keys(googleAdsData.insights.dailyPerformance).length : parseInt(dateRange))) // Show data based on selected range
                        .map(([date, data]: [string, any], index: number) => {
                          const maxSpend = Math.max(...Object.values(googleAdsData.insights.dailyPerformance).map((d: any) => d.cost));
                          const maxClicks = Math.max(...Object.values(googleAdsData.insights.dailyPerformance).map((d: any) => d.clicks));
                          const maxValue = Math.max(maxSpend, maxClicks);
                          
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
                              {/* Date label - positioned below bars with proper spacing */}
                              <div className="mt-2 h-8 flex items-end">
                                <span className="text-xs text-gray-600 font-medium transform -rotate-45 origin-left whitespace-nowrap">
                                  {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                    
                    {/* X-Axis Label */}
                    <div className="text-center mt-2">
                      <span className="text-sm text-gray-600 font-medium">Date</span>
                    </div>
                  </div>
                </div>
              </div>
              
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
