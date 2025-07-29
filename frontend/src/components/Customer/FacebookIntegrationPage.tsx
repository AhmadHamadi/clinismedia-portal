import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaFacebookSquare, FaCheckCircle } from 'react-icons/fa';

const FacebookIntegrationPage: React.FC = () => {
  const [pages, setPages] = useState<any[]>([]);
  const [userAccessToken, setUserAccessToken] = useState('');
  const [tokenExpiry, setTokenExpiry] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'pages' | 'saving' | 'connected' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [connectedPage, setConnectedPage] = useState<any>(null);

  const navigate = useNavigate();
  const location = useLocation();

  // Get current user/clinic ID from localStorage (adjust as needed)
  const customerData = localStorage.getItem('customerData');
  const customer = customerData ? JSON.parse(customerData) : null;
  const clinicId = customer?.id || customer?._id;

  // Check for OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has('code') && params.has('state')) {
      setStatus('loading');
      axios
        .get(`${import.meta.env.VITE_API_BASE_URL}/facebook/callback?code=${params.get('code')}&state=${params.get('state')}`)
        .then(res => {
          setPages(res.data.pages);
          setUserAccessToken(res.data.userAccessToken);
          setTokenExpiry(res.data.tokenExpiry);
          setStatus('pages');
        })
        .catch(() => {
          setError('Failed to fetch Facebook Pages.');
          setStatus('error');
        });
    } else {
      // Fetch current integration status
      if (clinicId) {
        axios.get(`${import.meta.env.VITE_API_BASE_URL}/customers/${clinicId}`)
          .then(res => {
            if (res.data.facebookPageId) {
              setConnectedPage({
                id: res.data.facebookPageId,
                name: res.data.facebookPageName,
              });
              setStatus('connected');
            }
          });
      }
    }
  }, [location.search, clinicId]);

  const handleConnect = () => {
    if (!clinicId) return setError('No clinic/customer ID found.');
    window.location.href = `${import.meta.env.VITE_API_BASE_URL}/facebook/auth/${clinicId}`;
  };

  const handleSavePage = async () => {
    if (!selectedPage) return;
    setStatus('saving');
    try {
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/facebook/save-page`, {
        clinicId,
        pageId: selectedPage.id,
        pageName: selectedPage.name,
        pageAccessToken: selectedPage.access_token,
        tokenExpiry,
      });
      setConnectedPage(selectedPage);
      setStatus('connected');
    } catch (err) {
      setError('Failed to save Facebook Page info.');
      setStatus('error');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-2 py-8">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-8 flex flex-col items-center">
        <div className="flex flex-col items-center mb-6">
          <FaFacebookSquare className="text-5xl text-[#1877f3] mb-2" />
          <h1 className="text-3xl font-extrabold text-[#1877f3] mb-1 tracking-tight">Facebook Integration</h1>
          <p className="text-gray-500 text-center max-w-xs">Connect your clinic's Facebook Page to view monthly reports and manage your integration.</p>
        </div>

        {status === 'idle' && (
          <button
            onClick={handleConnect}
            className="w-full py-3 px-6 bg-[#1877f3] text-white rounded-lg font-semibold text-lg shadow hover:bg-[#145db2] transition mb-2"
          >
            <FaFacebookSquare className="inline mr-2 text-2xl align-middle" /> Connect Facebook Page
          </button>
        )}

        {status === 'pages' && (
          <div className="w-full">
            <h2 className="text-lg font-semibold mb-4 text-center">Select a Facebook Page to connect:</h2>
            <ul className="mb-4 space-y-2">
              {pages.map(page => (
                <li key={page.id} className="">
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-blue-50 transition">
                    <input
                      type="radio"
                      name="fb-page"
                      value={page.id}
                      checked={selectedPage?.id === page.id}
                      onChange={() => setSelectedPage(page)}
                      className="accent-[#1877f3]"
                    />
                    <span className="font-medium text-gray-800">{page.name}</span>
                  </label>
                </li>
              ))}
            </ul>
            <button
              onClick={handleSavePage}
              disabled={!selectedPage}
              className="w-full py-2 px-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              <FaCheckCircle className="inline mr-2 text-lg align-middle" /> Save and Connect
            </button>
          </div>
        )}

        {status === 'connected' && connectedPage && (
          <div className="w-full bg-green-50 border border-green-300 rounded-xl p-6 flex flex-col items-center mt-4">
            <FaCheckCircle className="text-4xl text-green-500 mb-3" />
            <h2 className="text-xl font-semibold text-green-800 mb-2">Successfully Connected!</h2>
            <p className="text-green-700 text-center mb-4">
              Your Facebook Page <strong>{connectedPage.name}</strong> is now connected.
            </p>
            <button
              onClick={() => navigate('/customer/dashboard')}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="w-full bg-red-50 border border-red-300 rounded-xl p-6 text-center">
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={() => setStatus('idle')}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Try Again
            </button>
          </div>
        )}

        {status === 'loading' && (
          <div className="w-full text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1877f3] mx-auto mb-4"></div>
            <p className="text-gray-600">Connecting to Facebook...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FacebookIntegrationPage; 
