import { useState, useEffect } from "react";
import axios from "axios";

export interface Customer {
  _id: string;
  name: string;
  email: string;
  username?: string;
  location?: string;
  googleAdsAccessToken?: string;
  googleAdsRefreshToken?: string;
  googleAdsTokenExpiry?: string;
  googleAdsCustomerId?: string;
}

export interface GoogleAdsAccount {
  id: string;
  name: string;
  currency: string;
  timeZone: string;
  descriptiveName: string;
}

export interface GoogleAdsInsights {
  totalImpressions: number;
  totalClicks: number;
  totalCost: number;
  ctr: number; // Click-through rate
  conversionRate: number;
  conversions: number;
  costPerConversion: number;
  averageCpc: number; // Cost per click
  averageCpm: number; // Cost per mille (1000 impressions)
  qualityScore: number;
  searchImpressionShare: number;
  searchRankLostImpressionShare: number;
  searchExactMatchImpressionShare: number;
  displayImpressionShare: number;
  displayRankLostImpressionShare: number;
  videoViews: number;
  videoViewRate: number;
  videoQuartile25Rate: number;
  videoQuartile50Rate: number;
  videoQuartile75Rate: number;
  videoQuartile100Rate: number;
  lastUpdated: string;
}

export interface GoogleAdsCampaign {
  id: string;
  name: string;
  status: string;
  type: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  averageCpc: number;
}

export const useGoogleAdsManagement = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<GoogleAdsAccount | null>(null);
  const [insights, setInsights] = useState<GoogleAdsInsights | null>(null);
  const [campaigns, setCampaigns] = useState<GoogleAdsCampaign[]>([]);
  const [oauthStatus, setOauthStatus] = useState<'idle' | 'loading' | 'accounts' | 'saving' | 'success' | 'error'>('idle');
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'custom'>('30d');
  const [customDateRange, setCustomDateRange] = useState<{start: string, end: string}>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomers(response.data);
    } catch (err) {
      console.error("Failed to fetch customers", err);
      setError("Failed to fetch customers");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGoogleAds = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setOauthStatus('loading');
    setOauthError(null);

    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/google-ads/auth/${customer._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Redirect to Google OAuth URL
      window.location.href = response.data.authUrl;
    } catch (err) {
      console.error("Failed to get Google Ads auth URL", err);
      setOauthError("Failed to initiate Google Ads connection");
      setOauthStatus('error');
    }
  };

  const handleOAuthCallback = async (code: string, state: string) => {
    try {
      setOauthStatus('loading');
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/google-ads/callback?code=${code}&state=${state}`);

      setAccounts(response.data.accounts || []);
      setOauthStatus('accounts');
    } catch (err) {
      console.error("OAuth callback failed", err);
      setOauthError("Failed to authenticate with Google Ads");
      setOauthStatus('error');
    }
  };

  const handleSaveAccount = async () => {
    if (!selectedAccount || !selectedCustomer) return;

    try {
      setOauthStatus('saving');
      const token = localStorage.getItem('adminToken');

      console.log(`Connecting account "${selectedAccount.name}" to clinic "${selectedCustomer.name}"`);

      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/google-ads/save-account`, {
        clinicId: selectedCustomer._id,
        accountId: selectedAccount.id,
        accountName: selectedAccount.name,
        currency: selectedAccount.currency,
        timeZone: selectedAccount.timeZone,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('Google Ads account connection successful:', response.data);

      // Update the customer in the local state
      setCustomers(prev => prev.map(customer => 
        customer._id === selectedCustomer._id 
          ? {
              ...customer,
              googleAdsCustomerId: selectedAccount.id,
            }
          : customer
      ));

      setOauthStatus('success');
      setTimeout(() => {
        setOauthStatus('idle');
        setSelectedCustomer(null);
        setSelectedAccount(null);
        setAccounts([]);
      }, 2000);
    } catch (err: any) {
      console.error("Failed to save account", err);
      const errorMessage = err.response?.data?.error || "Failed to save Google Ads account";
      setOauthError(errorMessage);
      setOauthStatus('error');
    }
  };

  const handleDisconnectGoogleAds = async (customer: Customer) => {
    try {
      const token = localStorage.getItem('adminToken');
      await axios.patch(`${import.meta.env.VITE_API_BASE_URL}/google-ads/disconnect/${customer._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Update the customer in the local state
      setCustomers(prev => prev.map(c => 
        c._id === customer._id 
          ? {
              ...c,
              googleAdsAccessToken: undefined,
              googleAdsRefreshToken: undefined,
              googleAdsTokenExpiry: undefined,
              googleAdsCustomerId: undefined,
            }
          : c
      ));

      // Clear insights and campaigns for this customer
      setInsights(null);
      setCampaigns([]);
    } catch (err) {
      console.error("Failed to disconnect Google Ads", err);
      setError("Failed to disconnect Google Ads account");
    }
  };

  const getGoogleAdsStatus = (customer: Customer) => {
    if (customer.googleAdsCustomerId) {
      return {
        connected: true,
        customerId: customer.googleAdsCustomerId,
        tokenExpiry: customer.googleAdsTokenExpiry,
      };
    }
    return { connected: false };
  };

  const fetchGoogleAdsInsights = async (customerId: string, forceRefresh = false) => {
    try {
      setRefreshing(customerId);
      const token = localStorage.getItem('adminToken');

      let startDate, endDate;
      if (dateRange === 'custom') {
        startDate = customDateRange.start;
        endDate = customDateRange.end;
      } else {
        const days = parseInt(dateRange.replace('d', ''));
        endDate = new Date().toISOString().split('T')[0];
        startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }

      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/google-ads/insights/${customerId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { startDate, endDate, forceRefresh }
      });

      setInsights(response.data);
    } catch (err) {
      console.error("Failed to fetch Google Ads insights", err);
      setError("Failed to fetch Google Ads insights");
    } finally {
      setRefreshing(null);
    }
  };

  const fetchGoogleAdsCampaigns = async (customerId: string) => {
    try {
      const token = localStorage.getItem('adminToken');

      let startDate, endDate;
      if (dateRange === 'custom') {
        startDate = customDateRange.start;
        endDate = customDateRange.end;
      } else {
        const days = parseInt(dateRange.replace('d', ''));
        endDate = new Date().toISOString().split('T')[0];
        startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }

      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/google-ads/campaigns/${customerId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { startDate, endDate }
      });

      setCampaigns(response.data);
    } catch (err) {
      console.error("Failed to fetch Google Ads campaigns", err);
      setError("Failed to fetch Google Ads campaigns");
    }
  };

  const assignGoogleAdsAccount = async (customer: Customer, account: GoogleAdsAccount) => {
    try {
      const token = localStorage.getItem('adminToken');
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/google-ads/save-account`, {
        clinicId: customer._id,
        accountId: account.id,
        accountName: account.name,
        currency: account.currency,
        timeZone: account.timeZone,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Optionally refresh customers after assignment
      fetchCustomers();
    } catch (err) {
      console.error('Failed to assign Google Ads account', err);
      setError('Failed to assign Google Ads account');
    }
  };

  // Auto-refresh insights every 5 minutes for connected accounts
  useEffect(() => {
    const interval = setInterval(() => {
      customers.forEach(customer => {
        if (customer.googleAdsCustomerId && !refreshing) {
          fetchGoogleAdsInsights(customer._id);
        }
      });
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [customers, refreshing]);

  // Fetch available Google Ads accounts
  const fetchGoogleAdsAccounts = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/google-ads/accounts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Backend already provides name, descriptiveName, currency - use them!
      setAccounts(response.data || []);
    } catch (err) {
      console.error('Failed to fetch Google Ads accounts:', err);
      setAccounts([]);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchGoogleAdsAccounts();
  }, []);

  // Check for OAuth callback in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const clinicId = urlParams.get('clinicId');

    if (success === 'true' && clinicId) {
      setOauthStatus('success');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // Refresh customers to get updated data
      fetchCustomers();
    } else if (urlParams.get('error') === 'true') {
      setOauthError("Failed to connect Google Ads account");
      setOauthStatus('error');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  return {
    customers,
    loading,
    error,
    selectedCustomer,
    accounts,
    selectedAccount,
    insights,
    campaigns,
    oauthStatus,
    oauthError,
    refreshing,
    dateRange,
    customDateRange,
    setSelectedAccount,
    setSelectedCustomer,
    setDateRange,
    setCustomDateRange,
    handleConnectGoogleAds,
    handleSaveAccount,
    handleDisconnectGoogleAds,
    getGoogleAdsStatus,
    fetchCustomers,
    assignGoogleAdsAccount,
    fetchGoogleAdsInsights,
    fetchGoogleAdsCampaigns,
    fetchGoogleAdsAccounts,
    setOauthStatus,
    setOauthError,
  };
};