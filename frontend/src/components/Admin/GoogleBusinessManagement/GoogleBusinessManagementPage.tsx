import React, { useState, useEffect } from 'react';
import { FaGoogle, FaBuilding, FaLink, FaPhone, FaMapMarkerAlt, FaSpinner, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import axios from 'axios';

interface Customer {
  _id: string;
  name: string;
  email: string;
  location: string;
  googleBusinessProfileId?: string;
  googleBusinessProfileName?: string;
  googleBusinessAccessToken?: string;
}

interface BusinessProfile {
  id: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  accountName: string;
}

const GoogleBusinessManagementPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [businessProfiles, setBusinessProfiles] = useState<BusinessProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [oauthStatus, setOauthStatus] = useState<'idle' | 'loading' | 'profiles' | 'saving' | 'success' | 'error'>('idle');
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [oauthTokens, setOauthTokens] = useState<any>(null);
  const [adminConnected, setAdminConnected] = useState(false);
  const [allBusinessProfiles, setAllBusinessProfiles] = useState<BusinessProfile[]>([]);

  useEffect(() => {
    fetchCustomers();
    checkAdminConnectionStatus();
  }, []);

  // ✅ FIXED: Check admin connection status from backend (database is source of truth)
  // Backend automatically refreshes expired tokens, so we just trust the backend
  const checkAdminConnectionStatus = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/google-business/admin-connection-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Admin connection status from backend:', response.data);
      
      if (response.data.connected) {
        // Admin is connected in database - backend is the source of truth
        setAdminConnected(true);
        
        // Always fetch business profiles - backend will automatically refresh tokens if expired
        // Pass null to indicate we want backend to use its database tokens (not localStorage)
        await fetchAllBusinessProfiles(null);
      } else {
        // Admin is not connected
        console.log('Admin is not connected in database');
        setAdminConnected(false);
        setOauthTokens(null);
        // Clear localStorage if it says connected but backend says not connected
        localStorage.removeItem('googleBusinessAdminConnected');
        localStorage.removeItem('googleBusinessAdminTokens');
      }
    } catch (err) {
      console.error('Failed to check admin connection status:', err);
      // On error, assume not connected and clear state
      // Don't fall back to localStorage - backend is the source of truth
      setAdminConnected(false);
      setOauthTokens(null);
      localStorage.removeItem('googleBusinessAdminConnected');
      localStorage.removeItem('googleBusinessAdminTokens');
    }
  };

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Fetched customers:', response.data);
      setCustomers(response.data);
    } catch (err) {
      console.error('Failed to fetch customers', err);
      setError('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGoogleBusiness = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setOauthStatus('loading');
    setOauthError(null);
    
    try {
      const token = localStorage.getItem('adminToken');
      
      // Always connect admin account when called from the button
      console.log('Initiating admin OAuth connection');
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/google-business/auth/admin`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Got OAuth URL, redirecting to:', response.data.authUrl);
      window.location.href = response.data.authUrl;
    } catch (err) {
      console.error('Failed to get Google Business auth URL', err);
      setOauthError('Failed to initiate Google Business connection');
      setOauthStatus('error');
    }
  };

  const handleOAuthCallback = async (code: string, state: string) => {
    try {
      setOauthStatus('loading');
      const token = localStorage.getItem('adminToken');
      
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/google-business/callback?code=${code}&state=${state}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        // Store tokens temporarily and fetch business profiles
        setOauthTokens(response.data.tokens);
        await fetchBusinessProfiles(state, response.data.tokens);
      } else {
        setOauthError('OAuth callback failed');
        setOauthStatus('error');
      }
    } catch (err) {
      console.error('OAuth callback error', err);
      setOauthError('OAuth callback failed');
      setOauthStatus('error');
    }
  };

  const fetchBusinessProfiles = async (customerId: string, tokens: any) => {
    try {
      setOauthStatus('loading');
      const token = localStorage.getItem('adminToken');
      
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/google-business/business-profiles/${customerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setBusinessProfiles(response.data.businessProfiles);
      setOauthStatus('profiles');
    } catch (err) {
      console.error('Failed to fetch business profiles', err);
      setOauthError('Failed to fetch business profiles');
      setOauthStatus('error');
    }
  };

  const handleSaveBusinessProfile = async (customer: Customer, profile: BusinessProfile) => {
    if (!profile || !customer) return;

    try {
      setOauthStatus('saving');
      setOauthError(null); // Clear any previous errors
      const token = localStorage.getItem('adminToken');
      
      console.log('Saving business profile:', {
        customerId: customer._id,
        customerName: customer.name,
        businessProfileId: profile.id,
        businessProfileName: profile.name,
        hasTokens: !!oauthTokens
      });
      
      // ✅ FIXED: Backend can use admin tokens from database if tokens not provided
      // Pass tokens if available (from OAuth callback), otherwise backend will use database tokens
      const requestBody: any = {
        customerId: customer._id,
        businessProfileId: profile.id,
        businessProfileName: profile.name
      };
      
      // Only include tokens if we have them (from OAuth callback)
      // Otherwise, backend will use admin tokens from database
      if (oauthTokens && oauthTokens.access_token && oauthTokens.refresh_token) {
        requestBody.tokens = oauthTokens;
      }
      
      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/google-business/save-business-profile`, requestBody, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('Business profile saved successfully:', response.data);
      setOauthStatus('success');
      
      // ✅ FIXED: Immediately update local state with saved data to ensure UI reflects changes
      if (response.data.customer) {
        setCustomers(prev => prev.map(c => 
          c._id === customer._id 
            ? {
                ...c,
                googleBusinessProfileId: response.data.customer.googleBusinessProfileId,
                googleBusinessProfileName: response.data.customer.googleBusinessProfileName
              }
            : c
        ));
      }
      
      // Refresh customers list from backend to ensure we have latest data
      await fetchCustomers();
      
      // Force a small delay to ensure state updates and UI re-renders
      setTimeout(async () => {
        console.log('Second refresh after delay to ensure persistence...');
        await fetchCustomers();
        setOauthStatus('idle');
      }, 1000);
    } catch (err) {
      console.error('Failed to save business profile', err);
      setOauthError('Failed to save business profile');
      setOauthStatus('error');
    }
  };

  const handleDisconnect = async (customer: Customer) => {
    if (!window.confirm(`Are you sure you want to disconnect ${customer.name} from Google Business Profile?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.patch(`${import.meta.env.VITE_API_BASE_URL}/google-business/disconnect/${customer._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('Business profile disconnected successfully:', response.data);
      
      // ✅ FIXED: Immediately update local state to ensure UI reflects changes
      setCustomers(prev => prev.map(c => 
        c._id === customer._id 
          ? {
              ...c,
              googleBusinessProfileId: undefined,
              googleBusinessProfileName: undefined
            }
          : c
      ));

      // Refresh customers list from backend to ensure we have latest data
      await fetchCustomers();
    } catch (err) {
      console.error('Failed to disconnect business profile', err);
      setError('Failed to disconnect business profile');
    }
  };


  // Check for OAuth callback parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const adminOauthSuccess = urlParams.get('admin_oauth_success');
    const oauthError = urlParams.get('oauth_error');
    const accessToken = urlParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token');
    
    console.log('OAuth callback check:', {
      adminOauthSuccess,
      oauthError,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken
    });
    
    if (adminOauthSuccess === 'true' && accessToken && refreshToken) {
      console.log('Processing successful admin OAuth callback');
      // ✅ FIXED: Extract expires_in from URL parameters and decode tokens (they're URL encoded)
      const expiresIn = urlParams.get('expires_in');
      // Handle successful admin OAuth callback
      // Tokens are URL encoded in the redirect, so decode them
      const tokens = {
        access_token: decodeURIComponent(accessToken),
        refresh_token: decodeURIComponent(refreshToken),
        expires_in: expiresIn ? parseInt(expiresIn, 10) : 3600, // Default to 1 hour if not provided
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/business.manage'
      };
      
      console.log('✅ OAuth tokens extracted:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiresIn: tokens.expires_in,
        expiresInMinutes: Math.floor(tokens.expires_in / 60)
      });
      
      setOauthTokens(tokens);
      setAdminConnected(true);
      
      // Store connection state in localStorage
      localStorage.setItem('googleBusinessAdminConnected', 'true');
      localStorage.setItem('googleBusinessAdminTokens', JSON.stringify(tokens));
      
      console.log('Stored admin connection in localStorage');
      
      // ✅ FIXED: Also save tokens to backend database (redundancy - callback already saves, but this ensures sync)
      // Create async function and call it since useEffect callback cannot be async
      const saveTokensToBackend = async () => {
        try {
          const token = localStorage.getItem('adminToken');
          await axios.post(`${import.meta.env.VITE_API_BASE_URL}/google-business/save-admin-tokens`, {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_in: tokens.expires_in
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log('✅ Admin tokens also saved to backend database');
        } catch (err) {
          console.warn('⚠️ Failed to save admin tokens to backend (tokens already saved by callback):', err);
          // Don't fail the flow - callback already saved tokens
        }
      };
      saveTokensToBackend();
      
      fetchAllBusinessProfiles(tokens);
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (oauthError === 'true') {
      console.log('OAuth error detected');
      setOauthError('OAuth authentication failed');
      setOauthStatus('error');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const fetchAllBusinessProfiles = async (tokens: any) => {
    try {
      setOauthStatus('loading');
      setOauthError(null); // Clear any previous errors
      const token = localStorage.getItem('adminToken');
      
      // Build headers - if tokens provided (from OAuth callback), use them; otherwise backend will use database tokens
      const headers: any = {
        Authorization: `Bearer ${token}`
      };
      
      // Only add X-Admin-Tokens header if tokens are explicitly provided (from OAuth callback)
      // If tokens is null, backend will use its own database tokens and auto-refresh if expired
      if (tokens && tokens.access_token && tokens.refresh_token) {
        headers['X-Admin-Tokens'] = JSON.stringify(tokens);
        console.log('Using provided tokens from OAuth callback');
      } else {
        console.log('Using backend database tokens (will auto-refresh if expired)');
      }
      
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/google-business/admin-business-profiles`, {
        headers
      });

      console.log('Business profiles response:', response.data);
      setAllBusinessProfiles(response.data.businessProfiles);
      setOauthStatus('profiles');
      
      // Update localStorage to reflect that admin is connected
      // Backend has the tokens and will auto-refresh them, so we mark as connected
      localStorage.setItem('googleBusinessAdminConnected', 'true');
    } catch (err: any) {
      console.error('Failed to fetch all business profiles', err);
      const data = err.response?.data;
      const errorMessage =
        data?.error ||
        data?.message ||
        (err.response?.status === 401 ? 'Session expired or unauthorized. Please log in again.' : null) ||
        (err.response?.status ? `Request failed (${err.response.status}). Check console for details.` : null) ||
        (err.message || 'Failed to fetch business profiles. Check your connection and try again.');
      const details = data?.details;
      const hint = data?.hint;
      const requiresReauth = data?.requiresReauth;

      if (requiresReauth) {
        localStorage.removeItem('googleBusinessAdminConnected');
        localStorage.removeItem('googleBusinessAdminTokens');
        setAdminConnected(false);
        setOauthTokens(null);
        setOauthError('Admin Google Business Profile refresh token expired. Please reconnect using the "Reconnect" button above.');
      } else {
        let fullMessage = errorMessage;
        if (details) fullMessage += ` — ${details}`;
        if (hint) fullMessage += ` (${hint})`;
        setOauthError(fullMessage);
      }
      setOauthStatus('error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-[#98c6d5] mx-auto mb-4" />
          <p className="text-gray-600">Loading customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <FaGoogle className="text-4xl text-[#4285f4] mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Google Business Profile Management</h1>
              <p className="text-gray-600">Connect and manage Google Business Profiles for your customers</p>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-800 rounded">
            <div className="flex items-center">
              <FaExclamationTriangle className="mr-2" />
              {error}
            </div>
          </div>
        )}

        {/* OAuth Status */}
        {oauthStatus === 'profiles' && businessProfiles.length > 0 && (
          <div className="mb-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">
              Select Business Profile for {selectedCustomer?.name}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {businessProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedProfile?.id === profile.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedProfile(profile)}
                >
                  <div className="flex items-start">
                    <FaBuilding className="text-blue-600 mt-1 mr-3" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{profile.name}</h4>
                      {profile.address && (
                        <div className="flex items-center text-sm text-gray-600 mt-1">
                          <FaMapMarkerAlt className="mr-1" />
                          {profile.address}
                        </div>
                      )}
                      {profile.phone && (
                        <div className="flex items-center text-sm text-gray-600 mt-1">
                          <FaPhone className="mr-1" />
                          {profile.phone}
                        </div>
                      )}
                      {profile.website && (
                        <div className="flex items-center text-sm text-gray-600 mt-1">
                          <FaLink className="mr-1" />
                          {profile.website}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-4">
              <button
                onClick={() => {
                  if (selectedCustomer && selectedProfile) {
                    handleSaveBusinessProfile(selectedCustomer, selectedProfile);
                  }
                }}
                disabled={!selectedProfile || !selectedCustomer}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Connect Selected Profile
              </button>
              <button
                onClick={() => {
                  setOauthStatus('idle');
                  setBusinessProfiles([]);
                  setSelectedProfile(null);
                  setSelectedCustomer(null);
                  setOauthTokens(null);
                }}
                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* OAuth / Fetch Error */}
        {oauthError && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-800 rounded">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start">
                <FaExclamationTriangle className="mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">{oauthError}</p>
                  <p className="text-sm text-red-600 mt-1">
                    If you just reconnected, wait a few seconds and click &quot;Retry fetch profiles&quot; below. If the error persists, ensure you signed in with info@clinimedia.ca and that the CliniMedia location group exists in Google Business.
                  </p>
                </div>
              </div>
              {adminConnected && (
                <button
                  type="button"
                  onClick={() => {
                    setOauthError(null);
                    fetchAllBusinessProfiles(null);
                  }}
                  className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 flex-shrink-0"
                >
                  Retry fetch profiles
                </button>
              )}
            </div>
          </div>
        )}

        {/* Success Message */}
        {oauthStatus === 'success' && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-400 text-green-800 rounded">
            <div className="flex items-center">
              <FaCheckCircle className="mr-2" />
              Google Business Profile connected successfully!
            </div>
          </div>
        )}

        {/* Customers Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Customer Google Business Profile Status</h2>
            {!adminConnected && (
              <button
                onClick={() => handleConnectGoogleBusiness({} as Customer)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Connect Admin Account (info@clinimedia.ca)
              </button>
            )}
            {adminConnected && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center text-green-600">
                  <FaCheckCircle className="mr-2" />
                  <span className="text-sm font-medium">Admin Connected</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOauthError(null);
                    fetchAllBusinessProfiles(null);
                  }}
                  className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                >
                  Retry fetch profiles
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('googleBusinessAdminConnected');
                    localStorage.removeItem('googleBusinessAdminTokens');
                    setAdminConnected(false);
                    setOauthTokens(null);
                    setAllBusinessProfiles([]);
                    setOauthError(null);
                  }}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Reconnect
                </button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {customers.map((customer) => (
                  <tr key={customer._id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                        <div className="text-sm text-gray-500">{customer.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {customer.location}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {customer.googleBusinessProfileId ? (
                        <div className="flex items-center">
                          <FaCheckCircle className="text-green-500 mr-2" />
                          <div>
                            <div className="text-sm font-medium text-green-900">Connected</div>
                            <div className="text-xs text-green-600">{customer.googleBusinessProfileName}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <FaExclamationTriangle className="text-yellow-500 mr-2" />
                          <span className="text-sm text-yellow-700">Not Connected</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {customer.googleBusinessProfileId ? (
                        <button
                          onClick={() => handleDisconnect(customer)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Disconnect
                        </button>
                      ) : adminConnected ? (
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              const profile = allBusinessProfiles.find(p => p.id === e.target.value);
                              if (profile) {
                                handleSaveBusinessProfile(customer, profile);
                                // Clear the selection after save
                                setTimeout(() => {
                                  e.target.value = "";
                                }, 100);
                              }
                            }
                          }}
                          className="text-sm border border-gray-300 rounded px-2 py-1 bg-white text-gray-900"
                          defaultValue=""
                        >
                          <option value="" className="text-gray-900">Select Business Profile</option>
                          {allBusinessProfiles.map((profile) => (
                            <option key={profile.id} value={profile.id} className="text-gray-900">
                              {profile.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-500 text-sm">Connect admin account first</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">About Google Business Profile Integration</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>• <strong>Connect:</strong> Link customer accounts to their Google Business Profiles</p>
            <p>• <strong>Analytics:</strong> Access insights including views, searches, calls, and website clicks</p>
            <p>• <strong>Multi-Location:</strong> Manage multiple business locations for each customer</p>
            <p>• <strong>Real-time Data:</strong> Get up-to-date performance metrics from Google</p>
            <p>• <strong>Secure:</strong> All connections use OAuth 2.0 for secure authentication</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleBusinessManagementPage;
