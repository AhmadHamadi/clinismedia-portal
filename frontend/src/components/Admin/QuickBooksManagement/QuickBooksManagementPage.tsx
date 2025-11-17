import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  FaDollarSign, 
  FaSpinner, 
  FaCheckCircle, 
  FaTimesCircle,
  FaLink,
  FaUnlink,
  FaSyncAlt,
  FaExternalLinkAlt
} from 'react-icons/fa';

/**
 * QuickBooks Management Page - Built Section by Section
 * 
 * SECTION 1: Basic Page Structure + Connection Status
 */

interface QuickBooksStatus {
  connected: boolean;
  realmId: string | null;
  lastSynced: string | null;
  tokenExpiry: string | null;
}

const QuickBooksManagementPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<QuickBooksStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  
  // SECTION 2: QuickBooks Customers
  const [qbCustomers, setQbCustomers] = useState<any[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  
  // SECTION 3: CliniMedia Customers & Mapping
  const [clinimediaCustomers, setCliniMediaCustomers] = useState<any[]>([]);
  const [mappings, setMappings] = useState<any[]>([]);
  const [selectedCliniMediaCustomer, setSelectedCliniMediaCustomer] = useState<string>('');
  const [selectedQBCustomer, setSelectedQBCustomer] = useState<string>('');
  const [mappingCustomer, setMappingCustomer] = useState(false);
  
  // SECTION 4: Invoices
  const [invoices, setInvoices] = useState<any[]>([]);
  const [allInvoices, setAllInvoices] = useState<any[]>([]); // Store all invoices before filtering
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'Paid' | 'NotPaid' | 'Overdue'>('all');
  const [invoiceLoadError, setInvoiceLoadError] = useState<string | null>(null);

  // SECTION 1: Load connection status
  useEffect(() => {
    loadStatus();
    loadCliniMediaCustomers();
    loadMappings();
    
    // Check for OAuth callback success
    const urlParams = new URLSearchParams(window.location.search);
    const successParam = urlParams.get('success');
    const errorParam = urlParams.get('error');
    
    if (successParam === 'true') {
      setSuccess('QuickBooks connected successfully!');
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => loadStatus(), 1000);
    }
    
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Re-apply filter when invoiceFilter changes (if invoices are already loaded)
  // This allows users to change filters without reloading from API
  useEffect(() => {
    // Only re-filter if we have invoices loaded and we're not currently loading
    if (allInvoices.length > 0 && !loadingInvoices && Array.isArray(allInvoices)) {
      try {
        console.log('[Frontend] Filter changed to:', invoiceFilter, '- Re-applying filter to', allInvoices.length, 'invoices');
        
        let filtered: any[] = [];
        if (invoiceFilter === 'all') {
          filtered = [...allInvoices]; // Create a copy to avoid mutation
        } else {
          filtered = allInvoices.filter((inv: any) => {
            if (!inv || !inv.status) {
              return false;
            }
            return inv.status === invoiceFilter;
          });
        }
        
        console.log('[Frontend] Filtered result:', filtered.length, 'invoices');
        setInvoices(filtered);
        
        // Clear error/success when filtering (user action, not loading)
        if (filtered.length === 0 && allInvoices.length > 0) {
          setError(`No invoices match the "${invoiceFilter}" filter. Try selecting "All Status".`);
          setSuccess(null);
        } else if (filtered.length > 0) {
          setError(null);
          setSuccess(null);
        }
      } catch (filterErr) {
        console.error('[Frontend] Error applying filter:', filterErr);
        // Don't crash - keep current invoices visible
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceFilter]);

  // SECTION 3: Load CliniMedia customers
  const loadCliniMediaCustomers = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/customers`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const customers = Array.isArray(response.data) 
        ? response.data 
        : (response.data.customers || []);
      
      setCliniMediaCustomers(customers);
    } catch (err: any) {
      console.error('Error loading CliniMedia customers:', err);
    }
  };

  // SECTION 3: Load existing mappings
  const loadMappings = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        console.warn('[Frontend] No token found, cannot load mappings');
        return;
      }

      console.log('[Frontend] Loading mappings...');
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/quickbooks/mapped-customers`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const mappings = response.data.mappings || [];
      console.log('[Frontend] Loaded mappings:', mappings.length);
      console.log('[Frontend] Mappings data:', mappings.map((m: any) => ({
        id: m._id,
        portalCustomerId: m.portalCustomerId,
        quickbooksCustomerId: m.quickbooksCustomerId,
        displayName: m.quickbooksCustomerDisplayName
      })));

      setMappings(mappings);
    } catch (err: any) {
      console.error('[Frontend] Error loading mappings:', err);
      console.error('[Frontend] Error response:', err.response?.data);
      setMappings([]); // Set empty array on error to prevent UI issues
    }
  };

  const loadStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/quickbooks/status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setStatus(response.data);
    } catch (err: any) {
      console.error('Error loading status:', err);
      setError(err.response?.data?.error || 'Failed to load status');
      setStatus({ connected: false, realmId: null, lastSynced: null, tokenExpiry: null });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/quickbooks/connect`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      window.location.href = response.data.authUrl;
    } catch (err: any) {
      console.error('Error connecting:', err);
      setError(err.response?.data?.error || 'Failed to connect');
      setConnecting(false);
    }
  };

  // SECTION 2: Fetch QuickBooks Customers
  const fetchQBCustomers = async () => {
    if (!status?.connected) {
      setError('QuickBooks not connected');
      return;
    }

    try {
      setLoadingCustomers(true);
      setError(null);
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/quickbooks/customers`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Transform QuickBooks API response
      const customers = (response.data.customers || []).map((customer: any) => ({
        id: customer.Id || customer.id,
        name: customer.DisplayName || customer.CompanyName || customer.name || 'Unnamed Customer',
        email: customer.PrimaryEmailAddr?.Address || customer.email || null,
      }));

      setQbCustomers(customers);
    } catch (err: any) {
      console.error('Error fetching QuickBooks customers:', err);
      setError(err.response?.data?.error || 'Failed to fetch QuickBooks customers');
    } finally {
      setLoadingCustomers(false);
    }
  };

  // SECTION 3: Map customer
  const handleMapCustomer = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!selectedCliniMediaCustomer || !selectedQBCustomer) {
      setError('Please select both customers');
      return;
    }

    try {
      setMappingCustomer(true);
      setError(null);
      setSuccess(null);
      const token = localStorage.getItem('adminToken');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const qbCustomer = qbCustomers.find(c => c.id === selectedQBCustomer);
      console.log('[Frontend] Mapping customer:', {
        portalCustomerId: selectedCliniMediaCustomer,
        quickbooksCustomerId: selectedQBCustomer,
        quickbooksCustomerName: qbCustomer?.name
      });

      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/quickbooks/map-customer`,
        {
          portalCustomerId: selectedCliniMediaCustomer, // Use portalCustomerId for consistency
          clinimediaCustomerId: selectedCliniMediaCustomer, // Also send old field name for compatibility
          quickbooksCustomerId: selectedQBCustomer,
          quickbooksCustomerDisplayName: qbCustomer?.name || null,
          quickbooksCustomerName: qbCustomer?.name || null, // Also send old field name
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('[Frontend] Mapping response:', response.data);

      // Clear selections
      setSelectedCliniMediaCustomer('');
      setSelectedQBCustomer('');
      
      // Reload mappings to update UI
      await loadMappings();
      
      setSuccess('Customer mapped successfully!');
      console.log('[Frontend] Customer mapping completed successfully');
    } catch (err: any) {
      console.error('[Frontend] Error mapping customer:', err);
      console.error('[Frontend] Error response:', err.response?.data);
      setError(err.response?.data?.error || err.message || 'Failed to map customer');
      setMappingCustomer(false);
    } finally {
      setMappingCustomer(false);
    }
  };

  // Remove mapping
  const handleRemoveMapping = async (mappingId: string) => {
    if (!window.confirm('Are you sure you want to remove this mapping?')) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      const token = localStorage.getItem('adminToken');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      console.log('[Frontend] Removing mapping:', mappingId);

      await axios.delete(
        `${import.meta.env.VITE_API_BASE_URL}/quickbooks/map-customer/${mappingId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Reload mappings to get updated list
      await loadMappings();
      
      // Clear invoices since mapping was removed
      setInvoices([]);
      setAllInvoices([]);
      
      setSuccess('Mapping removed successfully');
      console.log('[Frontend] Mapping removed successfully');
    } catch (err: any) {
      console.error('[Frontend] Error removing mapping:', err);
      console.error('[Frontend] Error response:', err.response?.data);
      setError(err.response?.data?.error || err.message || 'Failed to remove mapping');
    }
  };

  // Disconnect QuickBooks
  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect QuickBooks? All customer mappings will be removed.')) {
      return;
    }

    try {
      setError(null);
      const token = localStorage.getItem('adminToken');
      if (!token) return;

      await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/quickbooks/disconnect`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setStatus({ connected: false, realmId: null, lastSynced: null, tokenExpiry: null });
      setMappings([]);
      setInvoices([]);
      setAllInvoices([]); // Clear all invoices state
      setQbCustomers([]);
      setSuccess('QuickBooks disconnected successfully');
    } catch (err: any) {
      console.error('Error disconnecting QuickBooks:', err);
      setError(err.response?.data?.error || 'Failed to disconnect QuickBooks');
    }
  };

  // Refresh all data
  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([
        loadStatus(),
        loadCliniMediaCustomers(),
        loadMappings()
      ]);
      setSuccess('Page refreshed successfully');
    } catch (err: any) {
      console.error('Error refreshing:', err);
      setError('Failed to refresh page');
    } finally {
      setLoading(false);
    }
  };

  // SECTION 4: Load invoices (only when manually triggered - no auto-load)
  const loadInvoices = async () => {
    if (!status?.connected || mappings.length === 0) {
      setError('No mapped customers found');
      return;
    }

    try {
      setLoadingInvoices(true);
      setError(null);
      setSuccess(null);
      setInvoiceLoadError(null);
      // Don't clear invoices/allInvoices here - keep them visible while loading
      
      const token = localStorage.getItem('adminToken');
      if (!token) {
        setError('Not authenticated');
        setLoadingInvoices(false);
        return;
      }

      console.log('[Frontend] ===== STARTING INVOICE LOAD =====');
      console.log('[Frontend] Loading invoices for', mappings.length, 'mapped customers');
      console.log('[Frontend] Mappings:', mappings.map((m: any) => ({
        id: m._id,
        portalCustomerId: m.portalCustomerId,
        quickbooksCustomerId: m.quickbooksCustomerId
      })));

      // Fetch invoices for each mapped customer
      const invoicePromises = mappings.map(async (mapping: any, index: number) => {
        try {
          if (!mapping || !mapping._id) {
            console.log('[Frontend] Skipping invalid mapping at index', index, ':', mapping);
            return [];
          }

          const portalCustomerId = typeof mapping.portalCustomerId === 'object'
            ? (mapping.portalCustomerId._id || mapping.portalCustomerId)
            : (mapping.portalCustomerId || mapping.clinimediaCustomerId);

          if (!portalCustomerId) {
            console.log('[Frontend] No portalCustomerId found for mapping:', mapping._id);
            return [];
          }

          console.log(`[Frontend] [${index}] Fetching invoices for portalCustomerId: ${portalCustomerId}`);
          console.log(`[Frontend] [${index}] QuickBooks Customer ID: ${mapping.quickbooksCustomerId}`);

          let response;
          try {
            response = await axios.get(
              `${import.meta.env.VITE_API_BASE_URL}/quickbooks/customer/${portalCustomerId}/invoices`,
              { 
                headers: { Authorization: `Bearer ${token}` },
                timeout: 30000 // 30 second timeout
              }
            );
            console.log(`[Frontend] [${index}] Successfully received response:`, {
              status: response.status,
              invoiceCount: response.data?.invoices?.length || 0
            });
          } catch (axiosErr: any) {
            console.error(`[Frontend] [${index}] Axios error:`, {
              message: axiosErr.message,
              response: axiosErr.response?.data,
              status: axiosErr.response?.status
            });
            // Return empty array instead of throwing
            return [];
          }

          const invoices = response?.data?.invoices || [];
          console.log(`[Frontend] [${index}] Received ${invoices.length} invoices for customer ${portalCustomerId}`);
          
          if (!Array.isArray(invoices)) {
            console.error(`[Frontend] [${index}] Invoices is not an array:`, typeof invoices, invoices);
            return [];
          }

          if (invoices.length === 0) {
            console.log(`[Frontend] [${index}] No invoices found for customer ${portalCustomerId}`);
            return [];
          }

          // Log first invoice structure for debugging
          if (invoices.length > 0) {
            console.log(`[Frontend] [${index}] First invoice structure:`, {
              id: invoices[0].id,
              docNumber: invoices[0].docNumber,
              status: invoices[0].status,
              totalAmount: invoices[0].totalAmount,
              balance: invoices[0].balance,
              hasCurrencyRef: !!invoices[0].currencyRef,
              currencyRefValue: invoices[0].currencyRef?.value,
              hasCustomerRef: !!invoices[0].customerRef
            });
          }

          // Process invoices
          const processed = invoices.map((invoice: any, invIndex: number) => {
            try {
              // Validate invoice has required fields
              if (!invoice) {
                console.warn(`[Frontend] [${index}][${invIndex}] Invoice is null or undefined`);
                return null;
              }

              if (!invoice.id) {
                console.warn(`[Frontend] [${index}][${invIndex}] Invoice missing id field:`, invoice);
                return null;
              }

              // Map normalized status to frontend status
              let frontendStatus: 'Paid' | 'NotPaid' | 'Overdue' = 'NotPaid';
              
              if (invoice.status === 'paid') {
                frontendStatus = 'Paid';
              } else if (invoice.status === 'unpaid' || invoice.status === 'partial') {
                // Check if overdue
                if (invoice.dueDate) {
                  try {
                    const dueDate = new Date(invoice.dueDate);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (!isNaN(dueDate.getTime())) {
                      dueDate.setHours(0, 0, 0, 0);
                      if (dueDate < today) {
                        frontendStatus = 'Overdue';
                      } else {
                        frontendStatus = 'NotPaid';
                      }
                    }
                  } catch (dateErr) {
                    console.warn(`[Frontend] [${index}][${invIndex}] Error parsing due date:`, invoice.dueDate);
                    frontendStatus = 'NotPaid';
                  }
                } else {
                  frontendStatus = 'NotPaid';
                }
              } else {
                console.warn(`[Frontend] [${index}][${invIndex}] Unknown invoice status:`, invoice.status);
                frontendStatus = 'NotPaid';
              }

              // Get customer name from mapping
              const customerName = mapping.quickbooksCustomerDisplayName || 
                                   mapping.quickbooksCustomerName || 
                                   invoice.customerRef?.name || 
                                   'Unknown';

              // Extract currency from currencyRef object or use default
              const currency = invoice.currencyRef?.value || invoice.currency || 'USD';

              // Ensure all numeric values are valid
              const totalAmount = typeof invoice.totalAmount === 'number' 
                ? invoice.totalAmount 
                : (Number(invoice.totalAmount) || 0);
              const balance = typeof invoice.balance === 'number'
                ? invoice.balance
                : (Number(invoice.balance) || 0);

              const processedInvoice = {
                id: String(invoice.id),
                docNumber: String(invoice.docNumber || 'N/A'),
                txnDate: invoice.txnDate || null,
                dueDate: invoice.dueDate || null,
                totalAmount: isNaN(totalAmount) ? 0 : totalAmount,
                balance: isNaN(balance) ? 0 : balance,
                status: frontendStatus,
                customerName: String(customerName),
                currency: String(currency),
                portalCustomerId: String(portalCustomerId),
              };

              console.log(`[Frontend] [${index}][${invIndex}] Processed invoice:`, {
                id: processedInvoice.id,
                docNumber: processedInvoice.docNumber,
                status: processedInvoice.status,
                totalAmount: processedInvoice.totalAmount,
                balance: processedInvoice.balance
              });

              return processedInvoice;
            } catch (err) {
              console.error(`[Frontend] [${index}][${invIndex}] Error processing invoice:`, err);
              console.error(`[Frontend] [${index}][${invIndex}] Invoice data:`, invoice);
              return null;
            }
          });

          const validInvoices = processed.filter((inv: any) => inv !== null && inv !== undefined);
          console.log(`[Frontend] [${index}] Processed ${validInvoices.length} valid invoices out of ${invoices.length} total`);
          return validInvoices;
        } catch (err) {
          console.error(`[Frontend] [${index}] Error in invoice promise:`, err);
          console.error(`[Frontend] [${index}] Error stack:`, err instanceof Error ? err.stack : 'No stack');
          // Return empty array instead of throwing to prevent blank screen
          return [];
        }
      });

      console.log('[Frontend] Waiting for all promises to settle...');
      const results = await Promise.allSettled(invoicePromises);
      console.log('[Frontend] All promises settled:', results.length);
      
      // Log results
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          console.log(`[Frontend] Promise ${index} fulfilled with ${result.value.length} invoices`);
        } else {
          console.error(`[Frontend] Promise ${index} rejected:`, result.reason);
        }
      });
      
      // Handle both fulfilled and rejected promises gracefully
      const collectedInvoices = results
        .map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value;
          } else {
            console.error(`[Frontend] Promise ${index} rejected:`, result.reason);
            return [];
          }
        })
        .flat()
        .filter((inv: any) => {
          const isValid = inv !== null && inv !== undefined && inv.id;
          if (!isValid) {
            console.warn('[Frontend] Filtering out invalid invoice:', inv);
          }
          return isValid;
        });

      console.log('[Frontend] ===== INVOICE PROCESSING COMPLETE =====');
      console.log('[Frontend] Total invoices collected:', collectedInvoices.length);
      console.log('[Frontend] Current filter:', invoiceFilter);

      // Store all invoices (before filtering) in state
      setAllInvoices(collectedInvoices);

      // Apply filter
      let filtered = collectedInvoices;
      if (invoiceFilter !== 'all') {
        filtered = collectedInvoices.filter((inv: any) => {
          const matches = inv && inv.status === invoiceFilter;
          if (!matches && inv) {
            console.log(`[Frontend] Invoice ${inv.id} (status: ${inv.status}) does not match filter: ${invoiceFilter}`);
          }
          return matches;
        });
        console.log('[Frontend] Filtered invoices:', filtered.length, 'for filter:', invoiceFilter);
      }

      // Always set invoices (even if empty) to prevent blank screen
      console.log('[Frontend] Setting invoices in state:', filtered.length);
      setInvoices(filtered);
      console.log('[Frontend] Invoices state updated');
      
      // Set success/error messages
      if (filtered.length === 0 && collectedInvoices.length === 0) {
        setError('No invoices found for mapped customers. Make sure invoices exist in QuickBooks for these customers.');
        setSuccess(null);
        setInvoiceLoadError(null);
      } else if (filtered.length === 0 && collectedInvoices.length > 0) {
        setError(`No invoices match the "${invoiceFilter}" filter. Try selecting "All Status".`);
        setSuccess(null);
        setInvoiceLoadError(null);
      } else {
        setSuccess(`Successfully loaded ${filtered.length} invoice(s)`);
        setError(null);
        setInvoiceLoadError(null);
      }
    } catch (err: any) {
      console.error('[Frontend] ===== FATAL ERROR IN loadInvoices =====');
      console.error('[Frontend] Error:', err);
      console.error('[Frontend] Error message:', err.message);
      console.error('[Frontend] Error stack:', err.stack);
      console.error('[Frontend] Error response:', err.response?.data);
      
      // Set error message
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.details || 
                          err.message || 
                          'Failed to load invoices';
      setError(errorMessage);
      setInvoiceLoadError(errorMessage);
      
      // Keep existing invoices if available, don't clear them on error
      // This prevents blank screen if there was a previous successful load
      if (allInvoices.length === 0) {
        setInvoices([]);
        setAllInvoices([]);
      }
    } finally {
      setLoadingInvoices(false);
      console.log('[Frontend] ===== loadInvoices COMPLETE =====');
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      // Show both date and time for token expiry to be more accurate
      const now = new Date();
      const isExpired = date < now;
      const timeUntilExpiry = date.getTime() - now.getTime();
      const hoursUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60 * 60));
      const minutesUntilExpiry = Math.floor((timeUntilExpiry % (1000 * 60 * 60)) / (1000 * 60));
      
      if (isExpired) {
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString()} (EXPIRED)`;
      } else if (hoursUntilExpiry < 24) {
        // If expires within 24 hours, show time remaining
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString()} (in ${hoursUntilExpiry}h ${minutesUntilExpiry}m)`;
      } else {
        // If more than 24 hours, just show date and time
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      }
    } catch (err) {
      console.warn('[Frontend] Error formatting date:', dateString, err);
      return 'N/A';
    }
  };

  const formatCurrency = (amount: number | null | undefined, currency: string = 'USD') => {
    try {
      const numAmount = typeof amount === 'number' ? amount : (Number(amount) || 0);
      if (isNaN(numAmount)) return '$0.00';
      
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
      }).format(numAmount);
    } catch (err) {
      console.warn('[Frontend] Error formatting currency:', amount, currency, err);
      const numAmount = typeof amount === 'number' ? amount : (Number(amount) || 0);
      return `$${numAmount.toFixed(2)}`;
    }
  };

  const getQuickBooksInvoiceUrl = (invoiceId: string | null | undefined) => {
    if (!invoiceId) return '#';
    try {
      const realmId = status?.realmId;
      if (!realmId) return '#';
      const baseUrl = 'https://qbo.intuit.com'; // Always production
      return `${baseUrl}/app/invoice?txnId=${invoiceId}`;
    } catch (err) {
      console.warn('[Frontend] Error generating QuickBooks URL:', invoiceId, err);
      return '#';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-[#98c6d5] mx-auto mb-4" />
          <p className="text-gray-600">Loading QuickBooks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FaDollarSign className="text-4xl text-[#98c6d5] mr-3" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">QuickBooks Integration</h1>
                <p className="text-gray-600">Manage your QuickBooks connection</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50"
              >
                <FaSyncAlt className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              {status?.connected && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                >
                  <FaUnlink /> Disconnect
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-800 rounded">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FaTimesCircle className="mr-2" />
                {error}
              </div>
              <button 
                type="button"
                onClick={() => setError(null)} 
                className="text-red-600 hover:text-red-800"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-400 text-green-800 rounded">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FaCheckCircle className="mr-2" />
                {success}
              </div>
              <button 
                type="button"
                onClick={() => setSuccess(null)} 
                className="text-green-600 hover:text-green-800"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* SECTION 1: Connection Status */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Connection Status</h2>
          
          {status?.connected ? (
            <div className="space-y-2">
              <div className="flex items-center text-green-600">
                <FaCheckCircle className="mr-2" />
                <span className="font-medium">Connected to QuickBooks</span>
              </div>
              <div className="text-sm text-gray-600">
                <p>Company ID: {status.realmId || 'N/A'}</p>
                {status.lastSynced && <p>Last Synced: {formatDate(status.lastSynced)}</p>}
                {status.tokenExpiry && <p>Token Expires: {formatDate(status.tokenExpiry)}</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center text-yellow-600">
                <FaTimesCircle className="mr-2" />
                <span className="font-medium">Not Connected</span>
              </div>
              <p className="text-gray-600">Connect your QuickBooks account to get started.</p>
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting}
                className="px-6 py-3 bg-[#98c6d5] text-white rounded-lg hover:bg-[#7bb3c7] flex items-center gap-2 disabled:opacity-50"
              >
                {connecting ? (
                  <>
                    <FaSpinner className="animate-spin" /> Connecting...
                  </>
                ) : (
                  <>
                    <FaLink /> Connect QuickBooks
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* SECTION 2: QuickBooks Customers */}
        {status?.connected && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">QuickBooks Customers</h2>
              <button
                type="button"
                onClick={fetchQBCustomers}
                disabled={loadingCustomers}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
              >
                <FaSyncAlt className={loadingCustomers ? 'animate-spin' : ''} />
                {loadingCustomers ? 'Loading...' : 'Fetch Customers'}
              </button>
            </div>

            {loadingCustomers ? (
              <div className="text-center py-4">
                <FaSpinner className="animate-spin text-2xl text-[#98c6d5] mx-auto" />
              </div>
            ) : qbCustomers.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                Click "Fetch Customers" to load QuickBooks customers.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {qbCustomers.map((customer) => (
                      <tr key={customer.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">{customer.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{customer.email || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SECTION 3: Customer Mapping */}
        {status?.connected && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Customer Mapping</h2>
            
            {/* Mapping Form */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">CliniMedia Customer</label>
                <select
                  value={selectedCliniMediaCustomer}
                  onChange={(e) => setSelectedCliniMediaCustomer(e.target.value)}
                  className="w-full p-2 border rounded-lg text-gray-900 bg-white"
                  style={{ color: '#000000' }}
                  disabled={mappingCustomer}
                >
                  <option value="" style={{ color: '#000000' }}>Select customer...</option>
                  {clinimediaCustomers.map(customer => (
                    <option key={customer._id} value={customer._id} style={{ color: '#000000' }}>
                      {customer.name} ({customer.email || 'No email'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">QuickBooks Customer</label>
                <select
                  value={selectedQBCustomer}
                  onChange={(e) => setSelectedQBCustomer(e.target.value)}
                  className="w-full p-2 border rounded-lg text-gray-900 bg-white"
                  style={{ color: '#000000' }}
                  disabled={loadingCustomers || mappingCustomer}
                >
                  <option value="" style={{ color: '#000000' }}>Select customer...</option>
                  {qbCustomers.map(customer => (
                    <option key={customer.id} value={customer.id} style={{ color: '#000000' }}>
                      {customer.name} {customer.email ? `(${customer.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleMapCustomer}
                  disabled={!selectedCliniMediaCustomer || !selectedQBCustomer || mappingCustomer}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {mappingCustomer ? <FaSpinner className="animate-spin mx-auto" /> : 'Map Customers'}
                </button>
              </div>
            </div>

            {/* Mapped Customers List */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Mapped Customers</h3>
              {mappings.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No customer mappings yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CliniMedia Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">QuickBooks Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {mappings.map((mapping: any) => {
                        const portalCustomerId = mapping.portalCustomerId || mapping.clinimediaCustomerId;
                        const customer = typeof portalCustomerId === 'object'
                          ? portalCustomerId
                          : clinimediaCustomers.find(c => c._id === portalCustomerId);

                        return (
                          <tr key={mapping._id}>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {customer?.name || 'Unknown'} ({customer?.email || 'N/A'})
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {mapping.quickbooksCustomerDisplayName || mapping.quickbooksCustomerName || mapping.quickbooksCustomerId}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <button
                                type="button"
                                onClick={() => handleRemoveMapping(mapping._id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 4: Invoices */}
        {status?.connected && mappings.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Invoices</h2>
              <div className="flex items-center gap-4">
                <select
                  value={invoiceFilter}
                  onChange={(e) => setInvoiceFilter(e.target.value as any)}
                  className="p-2 border rounded-lg text-black bg-white"
                  style={{ color: '#000000' }}
                >
                  <option value="all">All Status</option>
                  <option value="Paid">Paid</option>
                  <option value="NotPaid">Not Paid</option>
                  <option value="Overdue">Overdue</option>
                </select>
                <button
                  type="button"
                  onClick={loadInvoices}
                  disabled={loadingInvoices}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                >
                  <FaSyncAlt className={loadingInvoices ? 'animate-spin' : ''} />
                  {loadingInvoices ? 'Loading...' : 'Load Invoices'}
                </button>
              </div>
            </div>

            {loadingInvoices ? (
              <div className="text-center py-8">
                <FaSpinner className="animate-spin text-3xl text-[#98c6d5] mx-auto mb-2" />
                <p className="text-gray-600">Loading invoices...</p>
              </div>
            ) : !Array.isArray(invoices) ? (
              <div className="text-center py-8 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600 font-semibold mb-2">Error: Invoices data is invalid</p>
                <p className="text-gray-600 text-sm mb-2">Please try loading invoices again.</p>
                <p className="text-gray-500 text-xs">Type: {typeof invoices}</p>
                <button
                  type="button"
                  onClick={loadInvoices}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Retry Loading Invoices
                </button>
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-2">No invoices to display.</p>
                <p className="text-gray-400 text-sm">
                  {allInvoices.length > 0 
                    ? `No invoices match the "${invoiceFilter}" filter. Try selecting "All Status".`
                    : 'Click "Load Invoices" to fetch invoices for mapped customers.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                      try {
                        if (!Array.isArray(invoices) || invoices.length === 0) {
                          return (
                            <tr>
                              <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                No invoices to display
                              </td>
                            </tr>
                          );
                        }

                        // Filter and map invoices with error handling
                        const validInvoices = invoices.filter((inv: any) => {
                          const isValid = inv && inv.id && typeof inv.id === 'string';
                          if (!isValid) {
                            console.warn('[Frontend] Filtering out invalid invoice in render:', inv);
                          }
                          return isValid;
                        });

                        if (validInvoices.length === 0) {
                          return (
                            <tr>
                              <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                No valid invoices found
                              </td>
                            </tr>
                          );
                        }

                        return validInvoices.map((invoice: any, index: number) => {
                          try {
                            // Validate invoice structure
                            if (!invoice || !invoice.id) {
                              console.warn(`[Frontend] Invalid invoice at index ${index}:`, invoice);
                              return null;
                            }

                            return (
                              <tr key={`invoice-${invoice.id}-${index}`} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                  {invoice.docNumber || 'N/A'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {invoice.customerName || 'Unknown'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  {formatDate(invoice.txnDate)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  {formatDate(invoice.dueDate)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {formatCurrency(invoice.totalAmount, invoice.currency)}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                  {formatCurrency(invoice.balance, invoice.currency)}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    invoice.status === 'Paid' ? 'bg-green-100 text-green-800' :
                                    invoice.status === 'Overdue' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {invoice.status || 'Unknown'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <a
                                    href={getQuickBooksInvoiceUrl(invoice.id)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 inline-flex items-center"
                                    title="Open in QuickBooks"
                                    onClick={(e) => {
                                      if (!invoice.id || !status?.realmId) {
                                        e.preventDefault();
                                        console.warn('[Frontend] Cannot open invoice: missing id or realmId');
                                      }
                                    }}
                                  >
                                    <FaExternalLinkAlt />
                                  </a>
                                </td>
                              </tr>
                            );
                          } catch (rowErr) {
                            console.error(`[Frontend] Error rendering invoice row ${index}:`, rowErr, invoice);
                            return (
                              <tr key={`error-${index}`} className="bg-red-50">
                                <td colSpan={8} className="px-4 py-3 text-sm text-red-600">
                                  Error rendering invoice: {invoice?.id || 'Unknown ID'}
                                </td>
                              </tr>
                            );
                          }
                        }).filter((row: any) => row !== null);
                      } catch (renderErr) {
                        console.error('[Frontend] Error rendering invoice table:', renderErr);
                        return (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-red-600">
                              Error rendering invoices. Please try reloading the page.
                            </td>
                          </tr>
                        );
                      }
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickBooksManagementPage;
