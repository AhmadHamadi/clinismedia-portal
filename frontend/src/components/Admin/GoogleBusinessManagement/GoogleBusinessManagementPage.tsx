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
    
    // Check if admin was previously connected
    const storedAdminConnected = localStorage.getItem('googleBusinessAdminConnected');
    const storedTokens = localStorage.getItem('googleBusinessAdminTokens');
    
    console.log('Checking stored admin connection:', {
      storedAdminConnected,
      hasTokens: !!storedTokens
    });
    
    // Only restore if we have real tokens (not test tokens)
    if (storedAdminConnected === 'true' && storedTokens) {
      const tokens = JSON.parse(storedTokens);
      // Check if these are real tokens (not test tokens)
      if (tokens.access_token && tokens.access_token !== 'test' && tokens.refresh_token && tokens.refresh_token !== 'test') {
        console.log('Restoring admin connection from localStorage with real tokens');
        setAdminConnected(true);
        setOauthTokens(tokens);
        fetchAllBusinessProfiles(tokens);
      } else {
        console.log('Found test tokens, clearing them');
        // Clear test tokens
        localStorage.removeItem('googleBusinessAdminConnected');
        localStorage.removeItem('googleBusinessAdminTokens');
        setAdminConnected(false);
        setOauthTokens(null);
      }
    } else {
      console.log('No stored admin connection found');
    }
  }, []);

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
    if (!profile || !customer || !oauthTokens) return;

    try {
      setOauthStatus('saving');
      setOauthError(null); // Clear any previous errors
      const token = localStorage.getItem('adminToken');
      
      console.log('Saving business profile:', {
        customerId: customer._id,
        customerName: customer.name,
        businessProfileId: profile.id,
        businessProfileName: profile.name
      });
      
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/google-business/save-business-profile`, {
        customerId: customer._id,
        businessProfileId: profile.id,
        businessProfileName: profile.name,
        tokens: oauthTokens
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('Business profile saved successfully, refreshing customers...');
      setOauthStatus('success');
      
      // Refresh customers list and force re-render
      await fetchCustomers();
      
      // Force a small delay to ensure state updates
      setTimeout(async () => {
        console.log('Second refresh after delay...');
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
      await axios.patch(`${import.meta.env.VITE_API_BASE_URL}/google-business/disconnect/${customer._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Refresh customers list
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
      // Handle successful admin OAuth callback
      const tokens = {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/business.manage'
      };
      
      setOauthTokens(tokens);
      setAdminConnected(true);
      
      // Store connection state in localStorage
      localStorage.setItem('googleBusinessAdminConnected', 'true');
      localStorage.setItem('googleBusinessAdminTokens', JSON.stringify(tokens));
      
      console.log('Stored admin connection in localStorage');
      
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
      
      console.log('Fetching business profiles with tokens:', {
        hasAccessToken: !!tokens?.access_token,
        hasRefreshToken: !!tokens?.refresh_token,
        tokenType: tokens?.token_type
      });
      
      // Store tokens temporarily for the API call
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/google-business/admin-business-profiles`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'X-Admin-Tokens': JSON.stringify(tokens) // Pass tokens in header
        }
      });

      console.log('Business profiles response:', response.data);
      setAllBusinessProfiles(response.data.businessProfiles);
      setOauthStatus('profiles');
    } catch (err: any) {
      console.error('Failed to fetch all business profiles', err);
      const errorMessage = err.response?.data?.error || 'Failed to fetch business profiles';
      const requiresReauth = err.response?.data?.requiresReauth;
      
      if (requiresReauth) {
        // Clear stored tokens since they're expired
        localStorage.removeItem('googleBusinessAdminConnected');
        localStorage.removeItem('googleBusinessAdminTokens');
        setAdminConnected(false);
        setOauthTokens(null);
        
        setOauthError('Admin Google Business Profile refresh token expired. Please reconnect using the "Reconnect" button above.');
      } else {
        setOauthError(errorMessage);
      }
      setOauthStatus('error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
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
                onClick={handleSaveBusinessProfile}
                disabled={!selectedProfile}
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

        {/* OAuth Error */}
        {oauthError && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-800 rounded">
            <div className="flex items-center">
              <FaExclamationTriangle className="mr-2" />
              {oauthError}
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
              <div className="flex items-center gap-3">
                <div className="flex items-center text-green-600">
                  <FaCheckCircle className="mr-2" />
                  <span className="text-sm font-medium">Admin Connected</span>
                </div>
                <button
                  onClick={() => {
                    // Clear stored tokens and reconnect
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
