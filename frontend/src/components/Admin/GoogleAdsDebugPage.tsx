import React, { useState, useEffect } from 'react';

const GoogleAdsDebugPage: React.FC = () => {
  const [step1Status, setStep1Status] = useState<string>('✅ Step 1: Simple API endpoint working');
  const [step2Status, setStep2Status] = useState<string>('✅ Step 2: Google Ads API connection working');
  const [step3Status, setStep3Status] = useState<string>('Not tested');
  const [step3Data, setStep3Data] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    testStep3();
  }, []);

  const testStep3 = async () => {
    if (isLoading) {
      console.log('🔍 Already loading, skipping...');
      return;
    }
    
    try {
      console.log('🔍 testStep3 function started');
      setIsLoading(true);
      setStep3Status('Testing account data extraction...');
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        console.log('❌ No admin token found');
        setStep3Status('❌ No admin token found');
        setIsLoading(false);
        return;
      }

      console.log('🔍 Step 3: Testing account data extraction...');
      console.log('🔍 Admin token present:', !!token);
      console.log('🔍 Token length:', token ? token.length : 0);
      
      // Test comprehensive data extraction for ALL managed accounts
      console.log('🔍 Calling /debug/hierarchy endpoint...');
      const hierarchyResponse = await fetch('http://localhost:5000/api/google-ads/debug/hierarchy', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!hierarchyResponse.ok) {
        const errorText = await hierarchyResponse.text();
        console.error('🔍 Hierarchy response error:', hierarchyResponse.status, errorText);
        throw new Error(`Hierarchy debug failed: ${hierarchyResponse.status} - ${errorText}`);
      }
      
      const hierarchyData = await hierarchyResponse.json();
      console.log('🔍 Hierarchy data:', hierarchyData);
      console.log('🔍 Hierarchy items count:', hierarchyData.items?.length || 0);
      
      // Extract data for ALL accounts (including manager for debugging)
      const clientAccounts = hierarchyData.items.filter(item => 
        item.level <= 1 // Include both manager (level 0) and clients (level 1)
      );
      
      if (clientAccounts.length === 0) {
        throw new Error('No client accounts found in hierarchy');
      }
      
      console.log(`🔍 Found ${clientAccounts.length} client accounts to test`);
      console.log('🔍 All accounts in hierarchy:', hierarchyData.items);
      console.log('🔍 Client accounts filtered:', clientAccounts);
      
      const allAccountData = [];
      
      // Test each client account
      console.log(`🔍 Starting to test ${clientAccounts.length} accounts...`);
      for (const clientAccount of clientAccounts) {
        console.log(`🔍 Testing account: ${clientAccount.name} (${clientAccount.id})`);
        console.log(`🔍 Account details:`, clientAccount);
        
        try {
          // Test account name endpoint
          const nameResponse = await fetch(`http://localhost:5000/api/google-ads/account/name?customerId=${clientAccount.id}`, {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          const accountNameData = nameResponse.ok ? await nameResponse.json() : { error: `Failed: ${nameResponse.status}` };
          
          // Test daily metrics endpoint
          const metricsResponse = await fetch(`http://localhost:5000/api/google-ads/metrics/daily?customerId=${clientAccount.id}`, {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          const metricsData = metricsResponse.ok ? await metricsResponse.json() : { error: `Failed: ${metricsResponse.status}` };
          
          allAccountData.push({
            account: clientAccount,
            accountName: accountNameData,
            metrics: metricsData,
            success: nameResponse.ok && metricsResponse.ok
          });
          
          console.log(`✅ ${clientAccount.name}: Account name ${nameResponse.ok ? 'OK' : 'FAILED'}, Metrics ${metricsResponse.ok ? 'OK' : 'FAILED'}`);
          
        } catch (error) {
          console.error(`❌ Error testing ${clientAccount.name}:`, error);
          allAccountData.push({
            account: clientAccount,
            error: error.message,
            success: false
          });
        }
      }
      
      // All tests completed!
      console.log('🔍 All tests completed successfully');
      console.log('🔍 Account data:', allAccountData);
      setStep3Status(`✅ Step 3: Account data extraction working - ${allAccountData.filter(d => d.success).length}/${allAccountData.length} accounts successful`);
      setStep3Data({ 
        hierarchy: hierarchyData,
        allAccountData: allAccountData,
        summary: {
          totalAccounts: allAccountData.length,
          successfulAccounts: allAccountData.filter(d => d.success).length,
          failedAccounts: allAccountData.filter(d => !d.success).length
        }
      });
    } catch (error) {
      console.error('🔍 Step 3: Error:', error);
      console.error('🔍 Error details:', error);
      setStep3Status(`❌ Step 3: Error - ${error.message}`);
    } finally {
      console.log('🔍 testStep3 function completed');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Google Ads Debug - Step 3</h1>
          <p className="text-gray-600">Testing account data extraction and insights</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 1: Simple API Test</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="font-medium text-gray-900">{step1Status}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 2: Google Ads API Connection</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="font-medium text-gray-900">{step2Status}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 3: Account Data Extraction</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="font-medium text-gray-900">{step3Status}</p>
            </div>
            {step3Data && (
              <div className="space-y-4">
                {/* Summary */}
                {step3Data.summary && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold mb-2 text-blue-800">📊 Summary:</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{step3Data.summary.totalAccounts}</div>
                        <div className="text-gray-600">Total Accounts</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{step3Data.summary.successfulAccounts}</div>
                        <div className="text-gray-600">Successful</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{step3Data.summary.failedAccounts}</div>
                        <div className="text-gray-600">Failed</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* All Account Data */}
                {step3Data.allAccountData && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-800">🔍 All Account Data:</h4>
                    {step3Data.allAccountData.map((accountData, index) => (
                      <div key={index} className={`p-4 rounded-lg border ${accountData.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-semibold text-lg text-gray-900">{accountData.account.name}</h5>
                          <span className={`px-2 py-1 rounded text-sm ${accountData.success ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                            {accountData.success ? '✅ SUCCESS' : '❌ FAILED'}
                          </span>
                        </div>
                        
                        <div className="text-sm text-gray-600 mb-3">
                          ID: {accountData.account.id} | Level: {accountData.account.level} | Currency: {accountData.account.currency}
                          {accountData.account.level === 0 && <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">MANAGER</span>}
                          {accountData.account.level === 1 && <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">CLIENT</span>}
                        </div>

                        {/* Account Name Data */}
                        <div className="mb-3">
                          <h6 className="font-medium text-gray-700">Account Name Data:</h6>
                          <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-32 text-gray-900">
                            {JSON.stringify(accountData.accountName, null, 2)}
                          </pre>
                        </div>

                        {/* Metrics Data */}
                        <div className="mb-3">
                          <h6 className="font-medium text-gray-700">Metrics Data:</h6>
                          <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-32 text-gray-900">
                            {JSON.stringify(accountData.metrics, null, 2)}
                          </pre>
                        </div>

                        {/* Error if any */}
                        {accountData.error && (
                          <div className="text-sm text-red-600">
                            <strong>Error:</strong> {accountData.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Raw Data */}
                <div>
                  <p className="text-sm text-gray-600 mb-2">📋 Raw Response Data:</p>
                  <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto text-gray-900 border max-h-96">
                    {JSON.stringify(step3Data, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={testStep3}
            disabled={isLoading}
            className={`mt-4 px-4 py-2 rounded-lg transition-colors ${
              isLoading 
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                : 'bg-[#4285f4] text-white hover:bg-[#3367d6]'
            }`}
          >
            {isLoading ? 'Testing...' : 'Test Step 3 Again'}
          </button>
        </div>

        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">
          <p className="font-medium">Next Steps:</p>
          <ul className="mt-2 text-sm">
            <li>• Step 1: Test simple API endpoint ✅</li>
            <li>• Step 2: Test Google Ads API connection ✅</li>
            <li>• Step 3: Test account data extraction 🔄</li>
            <li>• Step 4: Test customer page integration</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GoogleAdsDebugPage;