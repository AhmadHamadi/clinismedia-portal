import { useState, useEffect, useCallback } from "react";
import axios from "axios";

export interface FacebookAdsInsights {
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  ctr: number; // Click-through rate
  cpc: number; // Cost per click
  cpm: number; // Cost per mille (1000 impressions)
  reach: number;
  frequency: number;
  totalLeads: number;
  leadCost: number;
  conversionRate: number;
  roas: number;
  lastUpdated: string;
}

export interface FacebookAdsCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  leads: number;
  ctr: number;
  cpc: number;
  roas: number;
}

export interface FacebookAdsAccount {
  id: string;
  name: string;
  currency: string;
  timeZone: string;
  businessName: string;
}

export const useCustomerFacebookAds = () => {
  const [insights, setInsights] = useState<FacebookAdsInsights | null>(null);
  const [campaigns, setCampaigns] = useState<FacebookAdsCampaign[]>([]);
  const [account, setAccount] = useState<FacebookAdsAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [customDateRange, setCustomDateRange] = useState<{start: string, end: string}>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const fetchFacebookAdsData = useCallback(async (forceRefresh = false) => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('customerToken');
      
      if (!token) {
        setError("No authentication token found. Please log in again.");
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      let startDate, endDate;
      if (dateRange === 'custom') {
        startDate = customDateRange.start;
        endDate = customDateRange.end;
      } else {
        const days = parseInt(dateRange.replace('d', ''));
        endDate = new Date().toISOString().split('T')[0];
        startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }

      // Fetch insights
      const insightsResponse = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/facebook-ads/insights/me`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { startDate, endDate, forceRefresh }
      });

      // Fetch campaigns
      const campaignsResponse = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/facebook-ads/campaigns/me`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { startDate, endDate }
      });

      // Fetch account info
      const accountResponse = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/facebook-ads/account/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setInsights(insightsResponse.data);
      setCampaigns(campaignsResponse.data);
      setAccount(accountResponse.data);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch Facebook Ads data", err);
      if (err.response?.status === 404) {
        if (err.response?.data?.error?.includes('Facebook not connected')) {
          setError("Facebook account not connected. Please contact your administrator to connect your Facebook account with ads_read permission.");
        } else {
          setError("Facebook Ads account not connected. Please contact your administrator.");
        }
      } else if (err.response?.status === 400) {
        setError(err.response.data.error || "Invalid Facebook connection. Please contact your administrator to reconnect.");
      } else {
        setError("Failed to fetch Facebook Ads data. Please try again later.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange, customDateRange]);

  // Initial load only
  useEffect(() => {
    fetchFacebookAdsData();
  }, []);

  // Auto-refresh every 5 minutes (only when not refreshing)
  useEffect(() => {
    if (refreshing) return;
    
    const interval = setInterval(() => {
      fetchFacebookAdsData();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [refreshing]);

  // Format currency
  const formatCurrency = (amount: number, currency = 'CAD') => {
    return new Intl.NumberFormat('en-CA', {
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
      case 'active':
      case 'running':
        return 'text-green-600 bg-green-100';
      case 'paused':
        return 'text-yellow-600 bg-yellow-100';
      case 'deleted':
      case 'archived':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'running':
        return '▶️';
      case 'paused':
        return '⏸️';
      case 'deleted':
      case 'archived':
        return '⏹️';
      default:
        return '❌';
    }
  };

  return {
    insights,
    campaigns,
    account,
    loading,
    error,
    refreshing,
    dateRange,
    customDateRange,
    setDateRange,
    setCustomDateRange,
    fetchFacebookAdsData,
    formatCurrency,
    formatNumber,
    formatPercentage,
    getStatusColor,
    getStatusIcon,
  };
};
