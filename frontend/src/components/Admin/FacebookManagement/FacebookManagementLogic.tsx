import { useState, useEffect } from "react";
import axios from "axios";

export interface Customer {
  _id: string;
  name: string;
  email: string;
  username?: string;
  location?: string;
  facebookPageId?: string;
  facebookPageName?: string;
  facebookAccessToken?: string;
  facebookTokenExpiry?: string;
}

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  tokenExpiry?: string; // Added for token expiry
}

export const useFacebookManagement = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<FacebookPage | null>(null);
  const [oauthStatus, setOauthStatus] = useState<'idle' | 'loading' | 'pages' | 'saving' | 'success' | 'error'>('idle');
  const [oauthError, setOauthError] = useState<string | null>(null);

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

  const handleConnectFacebook = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setOauthStatus('loading');
    setOauthError(null);
    
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/facebook/auth/${customer._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Redirect to Facebook OAuth URL
      window.location.href = response.data.authUrl;
    } catch (err) {
      console.error("Failed to get Facebook auth URL", err);
      setOauthError("Failed to initiate Facebook connection");
      setOauthStatus('error');
    }
  };

  const handleOAuthCallback = async (code: string, state: string) => {
    try {
      setOauthStatus('loading');
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/facebook/callback?code=${code}&state=${state}`);
      
      setPages(response.data.pages);
      setOauthStatus('pages');
    } catch (err) {
      console.error("OAuth callback failed", err);
      setOauthError("Failed to authenticate with Facebook");
      setOauthStatus('error');
    }
  };

  const handleSavePage = async () => {
    if (!selectedPage || !selectedCustomer) return;

    try {
      setOauthStatus('saving');
      const token = localStorage.getItem('adminToken');
      
      console.log(`Connecting page "${selectedPage.name}" to clinic "${selectedCustomer.name}"`);
      
      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/facebook/save-page`, {
        clinicId: selectedCustomer._id,
        pageId: selectedPage.id,
        pageName: selectedPage.name,
        pageAccessToken: selectedPage.access_token,
        tokenExpiry: null, // Facebook page tokens don't expire
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('Facebook page connection successful:', response.data);

      // Update the customer in the local state
      setCustomers(prev => prev.map(customer => 
        customer._id === selectedCustomer._id 
          ? {
              ...customer,
              facebookPageId: selectedPage.id,
              facebookPageName: selectedPage.name,
              facebookAccessToken: selectedPage.access_token,
            }
          : customer
      ));

      setOauthStatus('success');
      setTimeout(() => {
        setOauthStatus('idle');
        setSelectedCustomer(null);
        setSelectedPage(null);
        setPages([]);
      }, 2000);
    } catch (err: any) {
      console.error("Failed to save page", err);
      const errorMessage = err.response?.data?.error || "Failed to save Facebook page";
      setOauthError(errorMessage);
      setOauthStatus('error');
    }
  };

  const handleDisconnectFacebook = async (customer: Customer) => {
    try {
      const token = localStorage.getItem('adminToken');
      await axios.patch(`${import.meta.env.VITE_API_BASE_URL}/customers/${customer._id}/facebook-disconnect`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Update the customer in the local state
      setCustomers(prev => prev.map(c => 
        c._id === customer._id 
          ? {
              ...c,
              facebookPageId: undefined,
              facebookPageName: undefined,
              facebookAccessToken: undefined,
              facebookTokenExpiry: undefined,
            }
          : c
      ));
    } catch (err) {
      console.error("Failed to disconnect Facebook", err);
      setError("Failed to disconnect Facebook page");
    }
  };

  const getFacebookStatus = (customer: Customer) => {
    if (customer.facebookPageId && customer.facebookPageName) {
      return {
        connected: true,
        pageName: customer.facebookPageName,
        pageId: customer.facebookPageId,
      };
    }
    return { connected: false };
  };

  // Assign a Facebook page to a customer/clinic
  const assignFacebookPage = async (customer: Customer, page: FacebookPage) => {
    try {
      const token = localStorage.getItem('adminToken');
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/facebook/save-page`, {
        clinicId: customer._id,
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
        tokenExpiry: page.tokenExpiry || null,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Optionally refresh customers after assignment
      fetchCustomers();
    } catch (err) {
      console.error('Failed to assign Facebook page', err);
      setError('Failed to assign Facebook page');
    }
  };

  // Fetch admin Facebook user access token and pages
  const fetchAdminFacebookPages = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/facebook/admin-token`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const { facebookUserAccessToken, facebookUserTokenExpiry } = response.data;
      if (facebookUserAccessToken) {
        // Fetch pages from Facebook Graph API
        const pagesRes = await axios.get(`https://graph.facebook.com/v19.0/me/accounts?access_token=${facebookUserAccessToken}`);
        setPages(pagesRes.data.data || []);
      } else {
        setPages([]);
      }
    } catch (err) {
      setPages([]);
      // Optionally set error
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchAdminFacebookPages();
  }, []);

  // Check for OAuth callback in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pages = urlParams.get('pages');
    const userAccessToken = urlParams.get('userAccessToken');
    const tokenExpiry = urlParams.get('tokenExpiry');
    const clinicId = urlParams.get('clinicId');
    
    if (pages && userAccessToken) {
      try {
        const parsedPages = JSON.parse(decodeURIComponent(pages));
        setPages(parsedPages);
        setOauthStatus('pages');
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (err) {
        console.error("Failed to parse pages data", err);
        setOauthError("Failed to parse Facebook pages data");
        setOauthStatus('error');
      }
    }
  }, []);

  return {
    customers,
    loading,
    error,
    selectedCustomer,
    pages,
    selectedPage,
    oauthStatus,
    oauthError,
    setSelectedPage,
    setSelectedCustomer,
    handleConnectFacebook,
    handleSavePage,
    handleDisconnectFacebook,
    getFacebookStatus,
    fetchCustomers,
    assignFacebookPage,
  };
}; 