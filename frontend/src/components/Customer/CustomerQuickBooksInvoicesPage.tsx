import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  FaDollarSign, 
  FaSpinner, 
  FaCheckCircle, 
  FaTimesCircle,
  FaExternalLinkAlt,
  FaFilter,
  FaFileInvoice,
  FaCreditCard,
  FaReceipt
} from 'react-icons/fa';

interface Invoice {
  id: string;
  docNumber: string;
  txnDate: string | null;
  dueDate: string | null;
  totalAmount: number;
  balance: number;
  status: 'Paid' | 'NotPaid' | 'Overdue';
  customerRef: string;
  customerName: string | null;
  currency: string;
  privateNote: string | null;
  pdfUrl?: string;
  paymentUrl?: string;
  invoiceLink?: string | null; // Direct payment link from QuickBooks
}

const CustomerQuickBooksInvoicesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'Paid' | 'NotPaid' | 'Overdue'>('all');
  const [status, setStatus] = useState<any>(null);
  const [quickbooksCustomerName, setQuickbooksCustomerName] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('customerToken');
      if (!token) return null;
      
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/quickbooks/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching QuickBooks status:', error);
      return null;
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('customerToken');
      const userStr = localStorage.getItem('customerData');
      
      console.log('[Customer] Starting fetchInvoices');
      console.log('[Customer] Token exists:', !!token);
      console.log('[Customer] User data exists:', !!userStr);
      
      if (!token || !userStr) {
        console.error('[Customer] Missing authentication data');
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      let user;
      try {
        user = JSON.parse(userStr);
      } catch (parseErr) {
        console.error('[Customer] Error parsing user data:', parseErr);
        setError('Invalid user data');
        setLoading(false);
        return;
      }

      // Get customer ID - prefer _id over id to match what's stored in mapping
      // When admin maps customers, they use customer._id which becomes portalCustomerId
      const customerId = user._id || user.id || user.userId || user.user?._id || user.user?.id;
      
      if (!customerId) {
        console.error('[Customer] No customer ID found in user data:', user);
        console.error('[Customer] Full user object:', JSON.stringify(user, null, 2));
        setError('Customer ID not found. Please log out and log back in.');
        setLoading(false);
        return;
      }
      
      // Convert to string to ensure consistent format
      const customerIdStr = String(customerId);
      
      console.log('[Customer] ===== FETCHING INVOICES =====');
      console.log('[Customer] Customer ID:', customerIdStr);
      console.log('[Customer] Customer ID type:', typeof customerIdStr);
      console.log('[Customer] User data:', { 
        id: user.id, 
        _id: user._id, 
        userId: user.userId,
        email: user.email,
        role: user.role 
      });

      // Check if QuickBooks is connected (for customers, this checks if admin has connected)
      console.log('[Customer] Checking QuickBooks status...');
      const statusData = await fetchStatus();
      console.log('[Customer] Status data:', statusData);
      
      if (!statusData || !statusData.connected) {
        console.log('[Customer] QuickBooks not connected or status check failed');
        setConnected(false);
        setError('QuickBooks is not connected. Please contact your administrator.');
        setLoading(false);
        return;
      }

      setStatus(statusData);
      setConnected(true);
      console.log('[Customer] QuickBooks is connected, proceeding to fetch invoices');

      // Use the correct endpoint: /quickbooks/customer/:portalCustomerId/invoices
      // Use the string version of customer ID
      const invoiceUrl = `${import.meta.env.VITE_API_BASE_URL}/quickbooks/customer/${customerIdStr}/invoices`;
      console.log('[Customer] Fetching invoices from:', invoiceUrl);
      console.log('[Customer] API Base URL:', import.meta.env.VITE_API_BASE_URL);
      
      let response;
      try {
        response = await axios.get(invoiceUrl, { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 30000 // 30 second timeout
        });
        
        console.log('[Customer] Invoice API response status:', response.status);
        console.log('[Customer] Invoice API response data:', {
          invoiceCount: response.data?.invoices?.length || 0,
          hasInvoices: !!response.data?.invoices
        });
      } catch (axiosErr: any) {
        console.error('[Customer] Axios error fetching invoices:', {
          message: axiosErr.message,
          status: axiosErr.response?.status,
          data: axiosErr.response?.data,
          url: invoiceUrl
        });
        throw axiosErr; // Re-throw to be caught by outer catch
      }

      // Backend already returns normalized invoices, so we just need to map them
      const rawInvoices = response.data.invoices || [];
      const customerName = response.data.quickbooksCustomerName || null;
      
      // Set QuickBooks customer name for display (always set, even if null, to update UI)
      setQuickbooksCustomerName(customerName);
      
      console.log('[Customer] Received invoices from backend:', rawInvoices.length);
      console.log('[Customer] QuickBooks customer name:', customerName);
      console.log('[Customer] Setting quickbooksCustomerName state to:', customerName);
      
      if (rawInvoices.length > 0) {
        console.log('[Customer] First invoice sample:', {
          id: rawInvoices[0].id,
          docNumber: rawInvoices[0].docNumber,
          status: rawInvoices[0].status,
          totalAmount: rawInvoices[0].totalAmount,
          balance: rawInvoices[0].balance
        });
      }

      const transformedInvoices: Invoice[] = rawInvoices
        .filter((inv: any) => inv && inv.id) // Filter out invalid invoices first
        .map((invoice: any) => {
          try {
            // Backend already normalizes invoices, so use the normalized fields
            const totalAmount = typeof invoice.totalAmount === 'number' 
              ? invoice.totalAmount 
              : (Number(invoice.totalAmount) || 0);
            const balance = typeof invoice.balance === 'number'
              ? invoice.balance
              : (Number(invoice.balance) || 0);
            
            // Backend returns status as 'paid', 'unpaid', 'partial', or 'unknown'
            // Map to frontend status: 'Paid', 'NotPaid', 'Overdue'
            let status: 'Paid' | 'NotPaid' | 'Overdue' = 'NotPaid';
            
            if (invoice.status === 'paid' || balance === 0) {
              status = 'Paid';
            } else {
              // Check if overdue
              if (invoice.dueDate) {
                try {
                  const dueDate = new Date(invoice.dueDate);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  dueDate.setHours(0, 0, 0, 0);
                  if (!isNaN(dueDate.getTime()) && dueDate < today) {
                    status = 'Overdue';
                  } else {
                    status = 'NotPaid';
                  }
                } catch (dateErr) {
                  console.warn('[Customer] Error parsing due date:', invoice.dueDate);
                  status = invoice.status === 'paid' ? 'Paid' : 'NotPaid';
                }
              } else {
                status = invoice.status === 'paid' ? 'Paid' : 'NotPaid';
              }
            }

            // Extract currency from currencyRef object (backend returns it as an object)
            let currency = 'USD';
            if (invoice.currencyRef) {
              if (typeof invoice.currencyRef === 'string') {
                currency = invoice.currencyRef;
              } else if (invoice.currencyRef.value) {
                currency = invoice.currencyRef.value;
              }
            } else if (invoice.currency) {
              currency = invoice.currency;
            }

            // Extract customer name from customerRef if needed
            let customerName: string | null = null;
            if (invoice.customerRef) {
              if (typeof invoice.customerRef === 'string') {
                customerName = invoice.customerRef;
              } else if (invoice.customerRef.name) {
                customerName = invoice.customerRef.name;
              }
            }
            if (!customerName && invoice.customerName) {
              customerName = invoice.customerName;
            }

            // Generate QuickBooks URLs
            const realmId = statusData.realmId;
            const baseUrl = 'https://qbo.intuit.com'; // Always production
            
            const invoiceId = String(invoice.id || '');
            if (!invoiceId) {
              console.warn('[Customer] Invoice missing id:', invoice);
              return null;
            }
            
            // Use InvoiceLink if available (direct payment link from QuickBooks)
            // InvoiceLink is the same link customers see when invoice is emailed
            // It opens a "Review and pay" page - no QuickBooks login needed if online payments enabled
            const invoiceLink = invoice.invoiceLink || invoice.InvoiceLink || null;
            
            // Fallback to invoice URL if InvoiceLink not available
            const invoiceUrl = `${baseUrl}/app/invoice?txnId=${invoiceId}`;
            
            // Use InvoiceLink as paymentUrl if available, otherwise use invoice URL
            // InvoiceLink works for both paying (unpaid) and viewing receipts (paid)
            const paymentUrl = invoiceLink || (balance > 0 ? invoiceUrl : null);
            
            // PDF download URL via our backend proxy
            const pdfUrl = `${import.meta.env.VITE_API_BASE_URL}/quickbooks/invoice/${invoiceId}/pdf`;

            const transformed: Invoice = {
              id: invoiceId,
              docNumber: String(invoice.docNumber || 'N/A'),
              txnDate: invoice.txnDate || null,
              dueDate: invoice.dueDate || null,
              totalAmount: isNaN(totalAmount) ? 0 : totalAmount,
              balance: isNaN(balance) ? 0 : balance,
              status,
              customerRef: typeof invoice.customerRef === 'string' 
                ? invoice.customerRef 
                : (invoice.customerRef?.value || ''),
              customerName,
              currency,
              privateNote: invoice.privateNote || invoice.PrivateNote || null,
              pdfUrl, // Backend route for downloading PDF receipts
              paymentUrl, // InvoiceLink (direct payment link) or invoice URL fallback
              invoiceLink: invoiceLink, // Store original InvoiceLink for reference
            };

            console.log('[Customer] Processed invoice:', {
              id: transformed.id,
              docNumber: transformed.docNumber,
              status: transformed.status,
              totalAmount: transformed.totalAmount,
              balance: transformed.balance,
              currency: transformed.currency
            });

            return transformed;
          } catch (err) {
            console.error('[Customer] Error processing invoice:', err);
            console.error('[Customer] Invoice data:', invoice);
            return null;
          }
        })
        .filter((inv: any) => inv !== null && inv !== undefined) as Invoice[];

      console.log('[Customer] Transformed invoices:', transformedInvoices.length);
      
      // Apply filter
      let filteredInvoices = transformedInvoices;
      if (invoiceFilter !== 'all') {
        filteredInvoices = transformedInvoices.filter(inv => inv.status === invoiceFilter);
        console.log(`[Customer] Filtered to ${filteredInvoices.length} invoices for filter: ${invoiceFilter}`);
      }

      setInvoices(filteredInvoices);
      
      // Clear error if invoices were successfully loaded
      if (filteredInvoices.length > 0 || transformedInvoices.length > 0) {
        setError(null);
      }
      
      if (filteredInvoices.length === 0 && transformedInvoices.length === 0) {
        console.log('[Customer] No invoices found for this customer');
        // Don't set an error here - just show the "no invoices" message in the UI
        setError(null);
      } else if (filteredInvoices.length === 0 && transformedInvoices.length > 0) {
        // Filter applied but no invoices match
        setError(null); // Clear error, let the UI show "no invoices match filter"
      }
      
      console.log('[Customer] Successfully loaded invoices:', {
        total: transformedInvoices.length,
        filtered: filteredInvoices.length,
        paid: filteredInvoices.filter(inv => inv.status === 'Paid').length,
        unpaid: filteredInvoices.filter(inv => inv.status !== 'Paid').length
      });
    } catch (error: any) {
      console.error('[Customer] ===== ERROR FETCHING INVOICES =====');
      console.error('[Customer] Error:', error);
      console.error('[Customer] Error message:', error.message);
      console.error('[Customer] Error response:', error.response?.data);
      console.error('[Customer] Error status:', error.response?.status);
      console.error('[Customer] Error stack:', error.stack);
      
      // Set error message based on error type
      let errorMessage = 'Failed to fetch invoices';
      
      if (error.response?.status === 404) {
        const responseError = error.response?.data?.error || '';
        if (responseError.includes('No QuickBooks customer mapped')) {
          errorMessage = 'Your account is not mapped to a QuickBooks customer. Please contact your administrator to set up the mapping.';
          setConnected(false);
        } else if (responseError.includes('No invoices found')) {
          errorMessage = 'No invoices found for your account.';
          setConnected(true); // Still connected, just no invoices
        } else {
          errorMessage = responseError || 'No invoices found';
        }
      } else if (error.response?.status === 403) {
        errorMessage = 'You do not have permission to view these invoices.';
        setConnected(false);
      } else if (error.response?.status === 400) {
        const responseError = error.response?.data?.error || '';
        if (responseError.includes('not connected')) {
          errorMessage = 'QuickBooks is not connected. Please contact your administrator.';
          setConnected(false);
        } else {
          errorMessage = responseError || 'Failed to fetch invoices';
        }
      } else if (error.response?.status === 500) {
        errorMessage = error.response?.data?.error || 'Server error. Please try again later.';
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      } else {
        errorMessage = error.response?.data?.error || error.message || 'Failed to fetch invoices';
      }
      
      setError(errorMessage);
      setInvoices([]); // Clear invoices on error
    } finally {
      setLoading(false);
      console.log('[Customer] ===== fetchInvoices COMPLETE =====');
    }
  }, [invoiceFilter, fetchStatus]);

  // Auto-fetch invoices on mount and set up automatic polling
  useEffect(() => {
    // Fetch immediately when component mounts
    fetchInvoices();
    
    // Set up automatic polling every 5 minutes (300000 ms)
    // This ensures invoices are always up-to-date without manual refresh
    const pollInterval = setInterval(() => {
      console.log('[Customer] Auto-refreshing invoices...');
      fetchInvoices();
    }, 5 * 60 * 1000); // 5 minutes
    
    // Cleanup interval on unmount
    return () => {
      clearInterval(pollInterval);
    };
  }, [fetchInvoices]);

  /**
   * Generate QuickBooks invoice URL
   * This URL opens the invoice in QuickBooks where customers can:
   * - Pay the invoice (if unpaid and online payments enabled)
   * - View/print the receipt (if paid)
   * Note: Customers don't need to log into QuickBooks - the URL works directly
   */
  const getQuickBooksInvoiceUrl = (invoiceId: string) => {
    if (!invoiceId) {
      console.warn('[Customer] Cannot generate QuickBooks URL: missing invoiceId');
      return '#';
    }
    try {
      // Always use production QuickBooks URL
      const baseUrl = 'https://qbo.intuit.com';
      // This URL opens the invoice page where customers can pay or view receipt
      // QuickBooks will show payment option if online payments are enabled
      return `${baseUrl}/app/invoice?txnId=${invoiceId}`;
    } catch (err) {
      console.error('[Customer] Error generating QuickBooks URL:', err);
      return '#';
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
      }).format(amount);
    } catch {
      return `$${amount.toFixed(2)}`;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  // Separate invoices by status
  const paidInvoices = invoices.filter(inv => inv.status === 'Paid');
  const unpaidInvoices = invoices.filter(inv => inv.status !== 'Paid');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading QuickBooks invoices...</p>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="p-4 sm:p-6 md:p-8 overflow-x-hidden w-full max-w-6xl xl:max-w-7xl 2xl:max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center mb-2">
            <FaDollarSign className="mr-3 text-blue-600" />
            QuickBooks Invoices
          </h1>
          <p className="text-gray-600">
            View and manage your invoices from QuickBooks
          </p>
        </div>

        {/* Not Connected Card */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <FaFileInvoice className="text-6xl text-gray-400 mx-auto mb-6" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">QuickBooks Not Connected</h3>
              <p className="text-gray-600 mb-6">
                {error || 'Your QuickBooks account has not been connected yet. Please contact your administrator to connect your QuickBooks account.'}
              </p>
              <p className="text-sm text-gray-500">
                Once connected, you'll be able to view all your invoices from QuickBooks here.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 overflow-x-hidden w-full max-w-6xl xl:max-w-7xl 2xl:max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center mb-2">
              <FaDollarSign className="mr-3 text-blue-600" />
              QuickBooks Invoices
            </h1>
            <p className="text-gray-600">
              {quickbooksCustomerName 
                ? `Showing invoices for ${quickbooksCustomerName}`
                : 'View and manage your invoices from QuickBooks'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={invoiceFilter}
              onChange={(e) => {
                setInvoiceFilter(e.target.value as any);
              }}
              className="p-2 border border-gray-300 rounded-lg text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Invoices</option>
              <option value="Paid">Paid</option>
              <option value="NotPaid">Not Paid</option>
              <option value="Overdue">Overdue</option>
            </select>
            <button
              type="button"
              onClick={() => fetchInvoices()}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
              <FaFilter className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <FaTimesCircle className="mr-2 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
          <button 
            type="button"
            onClick={() => setError(null)} 
            className="text-red-600 hover:text-red-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* Summary Stats */}
      {invoices.length > 0 && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Total Invoices</div>
            <div className="text-2xl font-bold text-gray-900">{invoices.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Paid</div>
            <div className="text-2xl font-bold text-green-600">{paidInvoices.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Unpaid</div>
            <div className="text-2xl font-bold text-yellow-600">{unpaidInvoices.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Total Balance Due</div>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(
                unpaidInvoices.reduce((sum, inv) => sum + inv.balance, 0),
                invoices[0]?.currency || 'USD'
              )}
            </div>
          </div>
        </div>
      )}

      {/* Unpaid Invoices Section */}
      {(invoiceFilter === 'all' || invoiceFilter === 'NotPaid' || invoiceFilter === 'Overdue') && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden mb-6">
          <div className="bg-yellow-50 px-6 py-4 border-b border-yellow-200">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <FaCreditCard className="text-yellow-600" />
              Unpaid Invoices ({unpaidInvoices.length})
            </h2>
          </div>
            {unpaidInvoices.length === 0 ? (
              <div className="text-center py-12">
                <FaCheckCircle className="text-5xl text-green-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">All Invoices Paid</h3>
                <p className="text-gray-500">You don't have any unpaid invoices.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Invoice #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Balance Due
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
                    {unpaidInvoices
                      .filter(inv => {
                        // Apply filter if needed
                        if (invoiceFilter === 'NotPaid') {
                          return inv.status === 'NotPaid';
                        } else if (invoiceFilter === 'Overdue') {
                          return inv.status === 'Overdue';
                        }
                        return true; // Show all unpaid if filter is 'all'
                      })
                      .map(invoice => {
                        if (!invoice || !invoice.id) {
                          return null;
                        }
                        return (
                          <tr key={invoice.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {invoice.docNumber || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(invoice.txnDate)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(invoice.dueDate)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(invoice.totalAmount, invoice.currency)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {formatCurrency(invoice.balance, invoice.currency)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                invoice.status === 'Overdue' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {invoice.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <div className="flex items-center gap-3">
                                {/* For unpaid invoices: Show "Pay Invoice" button using InvoiceLink */}
                                {invoice.balance > 0 && invoice.status !== 'Paid' ? (
                                  invoice.paymentUrl ? (
                                    <a
                                      href={invoice.paymentUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1.5 text-sm font-medium"
                                      title="Pay Invoice - Opens QuickBooks payment page"
                                    >
                                      <FaCreditCard /> Pay Invoice
                                    </a>
                                  ) : (
                                    <span className="px-3 py-1.5 bg-gray-400 text-white rounded-lg text-sm font-medium cursor-not-allowed" title="Online payment not available. Please contact us to pay.">
                                      <FaCreditCard /> Contact to Pay
                                    </span>
                                  )
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                      .filter(row => row !== null)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      {/* Paid Invoices Section */}
      {(invoiceFilter === 'all' || invoiceFilter === 'Paid') && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-green-50 px-6 py-4 border-b border-green-200">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <FaReceipt className="text-green-600" />
              Paid Invoices ({paidInvoices.length})
            </h2>
          </div>
            {paidInvoices.length === 0 ? (
              <div className="text-center py-12">
                <FaFileInvoice className="text-5xl text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Paid Invoices</h3>
                <p className="text-gray-500">You don't have any paid invoices yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Invoice #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Paid Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Amount
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
                    {paidInvoices
                      .filter(inv => inv && inv.id)
                      .map(invoice => (
                        <tr key={invoice.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {invoice.docNumber || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(invoice.txnDate)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(invoice.dueDate)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(invoice.totalAmount, invoice.currency)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Paid
                            </span>
                          </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <div className="flex items-center gap-3">
                                {/* For paid invoices: Show "View Receipt" using InvoiceLink (shows paid status) */}
                                {invoice.paymentUrl ? (
                                  <a
                                    href={invoice.paymentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1.5 text-sm font-medium"
                                    title="View Receipt in QuickBooks"
                                  >
                                    <FaReceipt /> View Receipt
                                  </a>
                                ) : (
                                  <a
                                    href={getQuickBooksInvoiceUrl(invoice.id)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 text-sm font-medium"
                                    title="View Invoice in QuickBooks"
                                  >
                                    <FaExternalLinkAlt /> View Invoice
                                  </a>
                                )}
                              </div>
                            </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      {/* No Invoices Message */}
      {invoices.length === 0 && !loading && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          <div className="text-center py-12">
            <FaFileInvoice className="text-5xl text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices found</h3>
            <p className="text-gray-500">
              {invoiceFilter !== 'all' 
                ? `No ${invoiceFilter.toLowerCase()} invoices found.`
                : 'You don\'t have any invoices in QuickBooks yet.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerQuickBooksInvoicesPage;
