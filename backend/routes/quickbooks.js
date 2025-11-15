const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const User = require('../models/User');
const QuickBooksService = require('../services/quickbooksService');
const QuickBooksCustomerMapping = require('../models/QuickBooksCustomerMapping');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');
const crypto = require('crypto');

/**
 * Helper: Get the QuickBooks connection owner (admin user with QuickBooks connected)
 */
async function getQuickBooksConnectionOwner() {
  // Find any user with quickbooksConnected = true
  const user = await User.findOne({ quickbooksConnected: true });
  if (!user) {
    throw new Error('No user with quickbooksConnected=true found');
  }
  return user;
}

/**
 * Helper: Get valid access token (refreshes if expired)
 */
async function getValidAccessToken() {
  const owner = await getQuickBooksConnectionOwner();
  
  if (!owner.quickbooksAccessToken || !owner.quickbooksRefreshToken) {
    throw new Error('QuickBooks not connected');
  }

  // Check if token is expired (with 10 minute buffer for proactive refresh)
  const now = new Date();
  const expiryTime = owner.quickbooksTokenExpiry ? new Date(owner.quickbooksTokenExpiry) : null;
  const bufferTime = 10 * 60 * 1000; // 10 minutes in milliseconds (proactive refresh)
  
  // If no expiry time is set, or token is expired/expiring soon, refresh it
  const shouldRefresh = !expiryTime || (expiryTime && (now.getTime() + bufferTime) >= expiryTime.getTime());
  
  if (shouldRefresh) {
    console.log('[QuickBooks] Token expired or expiring soon, refreshing automatically...');
    try {
      const refreshed = await QuickBooksService.refreshAccessToken(owner.quickbooksRefreshToken);
      
      // Calculate new expiry time (QuickBooks tokens typically expire in 1 hour = 3600 seconds)
      const tokenExpiry = new Date();
      tokenExpiry.setSeconds(tokenExpiry.getSeconds() + (refreshed.expiresIn || 3600));
      
      owner.quickbooksAccessToken = refreshed.accessToken;
      owner.quickbooksRefreshToken = refreshed.refreshToken || owner.quickbooksRefreshToken; // Keep existing if not provided
      owner.quickbooksTokenExpiry = tokenExpiry;
      await owner.save();
      
      console.log('[QuickBooks] Token refreshed successfully. New expiry:', tokenExpiry.toISOString());
      return refreshed.accessToken;
    } catch (error) {
      console.error('[QuickBooks] Failed to refresh token:', error);
      // If refresh fails, mark as disconnected so user knows to reconnect
      owner.quickbooksConnected = false;
      await owner.save().catch(err => console.error('[QuickBooks] Failed to update connection status:', err));
      throw new Error('Failed to refresh QuickBooks token. Please reconnect your QuickBooks account.');
    }
  }
  
  return owner.quickbooksAccessToken;
}

/**
 * GET /api/quickbooks/connect
 * Initiates QuickBooks OAuth flow
 * Only admin can connect QuickBooks (similar to Facebook/Google management)
 */
router.get('/connect', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate state for OAuth security - include user ID
    const randomState = crypto.randomBytes(16).toString('hex');
    const state = `${userId}:${randomState}`;
    
    // Store state in user record temporarily
    user.quickbooksOAuthState = state;
    await user.save();

    const authUrl = QuickBooksService.getAuthorizationUrl(state);
    
    res.json({ authUrl, state });
  } catch (error) {
    console.error('Error initiating QuickBooks connection:', error);
    res.status(500).json({ error: 'Failed to initiate QuickBooks connection' });
  }
});

/**
 * GET /api/quickbooks/callback
 * Handles OAuth callback from QuickBooks
 * Note: This endpoint does NOT require authentication as it's called by QuickBooks
 */
router.get('/callback', async (req, res) => {
  // Determine frontend URL based on environment (declare once at top)
  // Use FRONTEND_URL if set, otherwise use environment-based fallback
  let frontendUrl = process.env.FRONTEND_URL;
  
  if (!frontendUrl) {
    if (process.env.NODE_ENV === 'development') {
      frontendUrl = 'http://localhost:5173';
    } else {
      // Production: Default to production frontend URL
      frontendUrl = 'https://www.clinimediaportal.ca';
    }
  }

  try {
    const { code, state, realmId, error } = req.query;

    if (error) {
      return res.redirect(`${frontendUrl}/admin/quickbooks?error=${encodeURIComponent(error)}`);
    }

    if (!code || !realmId) {
      return res.redirect(`${frontendUrl}/admin/quickbooks?error=${encodeURIComponent('Missing authorization code or realm ID')}`);
    }

    if (!state) {
      return res.redirect(`${frontendUrl}/admin/quickbooks?error=${encodeURIComponent('Missing state parameter')}`);
    }

    // Extract user ID from state (format: userId:randomState)
    const [userId, randomState] = state.split(':');
    
    if (!userId) {
      return res.redirect(`${frontendUrl}/admin/quickbooks?error=${encodeURIComponent('Invalid state parameter')}`);
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.redirect(`${frontendUrl}/admin/quickbooks?error=${encodeURIComponent('User not found')}`);
    }

    // Verify state matches stored state
    if (user.quickbooksOAuthState && user.quickbooksOAuthState !== state) {
      return res.redirect(`${frontendUrl}/admin/quickbooks?error=${encodeURIComponent('Invalid state parameter - possible CSRF attack')}`);
    }

    // Exchange code for tokens
    const tokens = await QuickBooksService.exchangeCodeForTokens(code);

    // Calculate token expiry
    const tokenExpiry = new Date();
    tokenExpiry.setSeconds(tokenExpiry.getSeconds() + tokens.expiresIn);

    // Save tokens to user
    user.quickbooksAccessToken = tokens.accessToken;
    user.quickbooksRefreshToken = tokens.refreshToken;
    user.quickbooksRealmId = realmId || tokens.realmId;
    user.quickbooksTokenExpiry = tokenExpiry;
    user.quickbooksConnected = true;
    user.quickbooksOAuthState = null; // Clear state
    await user.save();

    console.log(`✅ QuickBooks connected for user ${user.name} (${user.email})`);

    res.redirect(`${frontendUrl}/admin/quickbooks?success=true`);
  } catch (error) {
    console.error('Error in QuickBooks callback:', error);
    res.redirect(`${frontendUrl}/admin/quickbooks?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * GET /api/quickbooks/refresh
 * Manually refresh access token (admin only)
 */
router.get('/refresh', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user || !user.quickbooksRefreshToken) {
      return res.status(400).json({ error: 'QuickBooks not connected or no refresh token available' });
    }

    const refreshed = await QuickBooksService.refreshAccessToken(user.quickbooksRefreshToken);

    const tokenExpiry = new Date();
    tokenExpiry.setSeconds(tokenExpiry.getSeconds() + refreshed.expiresIn);

    user.quickbooksAccessToken = refreshed.accessToken;
    user.quickbooksRefreshToken = refreshed.refreshToken;
    user.quickbooksTokenExpiry = tokenExpiry;
    await user.save();

    res.json({ 
      message: 'Token refreshed successfully',
      expiresAt: tokenExpiry,
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ error: error.message || 'Failed to refresh token' });
  }
});

/**
 * GET /api/quickbooks/status
 * Get QuickBooks connection status
 * For customers: checks if their clinic has QuickBooks connected
 * For admin: checks their own connection
 */
router.get('/status', authenticateToken, authorizeRole(['customer', 'admin']), async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // For customers, check if their clinic (admin) has QuickBooks connected
    // For admin, check their own connection
    let quickbooksUser = user;
    
    if (req.user.role === 'customer') {
      // Find admin user who has QuickBooks connected
      const adminUser = await User.findOne({ 
        role: 'admin',
        quickbooksConnected: true 
      });
      
      if (adminUser) {
        quickbooksUser = adminUser;
      }
    }

    const isConnected = quickbooksUser.quickbooksConnected && 
                       quickbooksUser.quickbooksAccessToken && 
                       quickbooksUser.quickbooksRealmId;

    res.json({
      connected: isConnected,
      realmId: quickbooksUser.quickbooksRealmId || null,
      lastSynced: quickbooksUser.quickbooksLastSynced || null,
      tokenExpiry: quickbooksUser.quickbooksTokenExpiry || null,
    });
  } catch (error) {
    console.error('Error getting QuickBooks status:', error);
    res.status(500).json({ error: 'Failed to get QuickBooks status' });
  }
});

/**
 * GET /api/quickbooks/disconnect
 * Disconnect QuickBooks account (admin only)
 */
router.get('/disconnect', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Clear QuickBooks data
    user.quickbooksAccessToken = null;
    user.quickbooksRefreshToken = null;
    user.quickbooksRealmId = null;
    user.quickbooksTokenExpiry = null;
    user.quickbooksConnected = false;
    user.quickbooksLastSynced = null;
    user.quickbooksOAuthState = null;
    await user.save();

    res.json({ message: 'QuickBooks disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting QuickBooks:', error);
    res.status(500).json({ error: 'Failed to disconnect QuickBooks' });
  }
});

// GET /api/quickbooks/customers
router.get('/customers', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const owner = await getQuickBooksConnectionOwner();

    if (!owner.quickbooksAccessToken || !owner.quickbooksRealmId) {
      return res.status(400).json({ error: 'QuickBooks is not connected.' });
    }

    const accessToken = await getValidAccessToken();

    const customers = await QuickBooksService.getCustomers({
      accessToken,
      realmId: owner.quickbooksRealmId,
      maxResults: 1000,
    });

    res.json({ customers });
  } catch (err) {
    console.error('[QuickBooks /customers] Error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch QuickBooks customers' });
  }
});

// POST /api/quickbooks/map-customer
// body: { portalCustomerId (or clinimediaCustomerId), quickbooksCustomerId, quickbooksCustomerDisplayName (or quickbooksCustomerName) }
router.post('/map-customer', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    // Support both old and new field names for compatibility
    const portalCustomerId = req.body.portalCustomerId || req.body.clinimediaCustomerId;
    const quickbooksCustomerId = req.body.quickbooksCustomerId;
    const quickbooksCustomerDisplayName = req.body.quickbooksCustomerDisplayName || req.body.quickbooksCustomerName;

    if (!portalCustomerId || !quickbooksCustomerId) {
      return res.status(400).json({ error: 'portalCustomerId (or clinimediaCustomerId) and quickbooksCustomerId are required.' });
    }

    // Validate portalCustomerId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(portalCustomerId)) {
      return res.status(400).json({ error: 'Invalid portalCustomerId format' });
    }

    const mapping = await QuickBooksCustomerMapping.findOneAndUpdate(
      { portalCustomerId },
      { quickbooksCustomerId, quickbooksCustomerDisplayName },
      { upsert: true, new: true }
    );

    console.log('[QuickBooks] Customer mapped:', {
      portalCustomerId: mapping.portalCustomerId,
      quickbooksCustomerId: mapping.quickbooksCustomerId,
      displayName: mapping.quickbooksCustomerDisplayName
    });

    res.json({ mapping });
  } catch (err) {
    console.error('[QuickBooks /map-customer] Error:', err.message);
    console.error('[QuickBooks /map-customer] Stack:', err.stack);
    
    // Handle duplicate key error
    if (err.code === 11000) {
      return res.status(400).json({ 
        error: 'This customer is already mapped to a QuickBooks customer.' 
      });
    }
    
    res.status(500).json({ error: 'Failed to map customer' });
  }
});

// GET /api/quickbooks/mapped-customers
router.get('/mapped-customers', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const mappings = await QuickBooksCustomerMapping.find().populate('portalCustomerId', 'name email');
    console.log(`[QuickBooks] Found ${mappings.length} mappings`);
    res.json({ mappings });
  } catch (err) {
    console.error('[QuickBooks /mapped-customers] Error:', err.message);
    res.status(500).json({ error: 'Failed to load mapped customers' });
  }
});

// DELETE /api/quickbooks/map-customer/:mappingId
// Remove a customer mapping
router.delete('/map-customer/:mappingId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { mappingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(mappingId)) {
      return res.status(400).json({ error: 'Invalid mapping ID format' });
    }

    const mapping = await QuickBooksCustomerMapping.findByIdAndDelete(mappingId);

    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    console.log(`[QuickBooks] Deleted mapping: ${mappingId}`);
    res.json({ message: 'Mapping removed successfully' });
  } catch (err) {
    console.error('[QuickBooks /map-customer/:id] Error:', err.message);
    res.status(500).json({ error: 'Failed to remove mapping' });
  }
});

// GET /api/quickbooks/customer/:portalCustomerId/invoices
router.get('/customer/:portalCustomerId/invoices', authenticateToken, authorizeRole(['customer', 'admin']), async (req, res) => {
  try {
    const { portalCustomerId } = req.params;

    console.log(`[QuickBooks] Fetching invoices for portal customer: ${portalCustomerId}`);
    console.log(`[QuickBooks] Request user ID: ${req.user.id}, Role: ${req.user.role}`);
    console.log(`[QuickBooks] Request user ID type: ${typeof req.user.id}, PortalCustomerId type: ${typeof portalCustomerId}`);

    // For customers, ensure they can only see their own invoices
    // Compare both as strings to handle ObjectId vs string comparison
    const userId = String(req.user.id);
    const customerId = String(portalCustomerId);
    
    if (req.user.role === 'customer' && userId !== customerId) {
      console.log(`[QuickBooks] Access denied: Customer ${userId} trying to access ${customerId}`);
      console.log(`[QuickBooks] User IDs don't match: ${userId} !== ${customerId}`);
      return res.status(403).json({ error: 'You can only view your own invoices' });
    }
    
    console.log(`[QuickBooks] Access granted: User ${userId} accessing ${customerId}`);

    // Try to find mapping - portalCustomerId might be ObjectId or string
    // First, try direct lookup (works if it's already an ObjectId)
    let mapping = await QuickBooksCustomerMapping.findOne({ portalCustomerId }).populate('portalCustomerId', 'name email');
    
    // If not found, try converting string to ObjectId
    if (!mapping && mongoose.Types.ObjectId.isValid(portalCustomerId)) {
      console.log(`[QuickBooks] Trying ObjectId conversion for: ${portalCustomerId}`);
      try {
        const objectId = new mongoose.Types.ObjectId(portalCustomerId);
        mapping = await QuickBooksCustomerMapping.findOne({ portalCustomerId: objectId }).populate('portalCustomerId', 'name email');
      } catch (objIdErr) {
        console.error('[QuickBooks] Error converting to ObjectId:', objIdErr);
      }
    }
    
    // If still not found, try searching by string comparison (fallback)
    if (!mapping) {
      console.log(`[QuickBooks] Trying string comparison for: ${portalCustomerId}`);
      // Try all mappings and check if any match as string
      const allMappings = await QuickBooksCustomerMapping.find().populate('portalCustomerId', 'name email');
      mapping = allMappings.find(m => String(m.portalCustomerId?._id || m.portalCustomerId) === String(portalCustomerId));
    }

    if (!mapping) {
      console.log(`[QuickBooks] No mapping found for portal customer: ${portalCustomerId}`);
      return res.status(404).json({ error: 'No QuickBooks customer mapped for this portal customer.' });
    }

    console.log(`[QuickBooks] Found mapping: ${mapping.quickbooksCustomerId} for portal customer: ${portalCustomerId}`);
    console.log(`[QuickBooks] Mapping details:`, {
      quickbooksCustomerId: mapping.quickbooksCustomerId,
      quickbooksCustomerDisplayName: mapping.quickbooksCustomerDisplayName,
      quickbooksCustomerName: mapping.quickbooksCustomerName
    });

    const owner = await getQuickBooksConnectionOwner();
    if (!owner.quickbooksAccessToken || !owner.quickbooksRealmId) {
      return res.status(400).json({ error: 'QuickBooks is not connected.' });
    }

    const accessToken = await getValidAccessToken();

    console.log(`[QuickBooks] Fetching invoices for QuickBooks customer: ${mapping.quickbooksCustomerId}`);

    const invoices = await QuickBooksService.getNormalizedInvoicesForCustomer({
      accessToken,
      realmId: owner.quickbooksRealmId,
      quickbooksCustomerId: mapping.quickbooksCustomerId,
      maxResults: 100,
    });

    console.log(`[QuickBooks] Found ${invoices.length} invoices for customer ${mapping.quickbooksCustomerId}`);
    
    // Validate invoices before sending
    const validInvoices = invoices.filter((inv) => {
      const isValid = inv && inv.id;
      if (!isValid) {
        console.warn('[QuickBooks] Filtering out invalid invoice:', inv);
      }
      return isValid;
    });

    console.log(`[QuickBooks] Sending ${validInvoices.length} valid invoices to frontend`);
    
    if (validInvoices.length > 0) {
      console.log(`[QuickBooks] First invoice sample:`, {
        id: validInvoices[0].id,
        docNumber: validInvoices[0].docNumber,
        status: validInvoices[0].status,
        totalAmount: validInvoices[0].totalAmount,
        balance: validInvoices[0].balance,
        currency: validInvoices[0].currencyRef?.value,
        hasInvoiceLink: !!validInvoices[0].invoiceLink,
        invoiceLink: validInvoices[0].invoiceLink ? 'Present' : 'Not available (online payments may not be enabled)'
      });
    }

    // Get QuickBooks customer name from mapping
    let quickbooksCustomerName = mapping.quickbooksCustomerDisplayName || mapping.quickbooksCustomerName || null;
    console.log(`[QuickBooks] Initial customer name from mapping: ${quickbooksCustomerName}`);
    
    // Always try to fetch customer name from QuickBooks API to ensure we have the latest name
    // This ensures the name is always displayed correctly even if mapping was created without it
    if (mapping.quickbooksCustomerId) {
      try {
        console.log(`[QuickBooks] Fetching customer name from QuickBooks API for customer: ${mapping.quickbooksCustomerId}`);
        const query = `SELECT DisplayName, CompanyName FROM Customer WHERE Id = '${mapping.quickbooksCustomerId}'`;
        const customerData = await QuickBooksService.runQuery({
          accessToken,
          realmId: owner.quickbooksRealmId,
          query,
          minorversion: 65
        });
        
        const customer = customerData?.QueryResponse?.Customer;
        if (customer) {
          const customerObj = Array.isArray(customer) ? customer[0] : customer;
          const fetchedName = customerObj?.DisplayName || customerObj?.CompanyName || null;
          
          if (fetchedName) {
            quickbooksCustomerName = fetchedName;
            console.log(`[QuickBooks] ✅ Fetched customer name from QuickBooks: ${quickbooksCustomerName}`);
            
            // Update mapping with the customer name for future use (if different)
            if (mapping.quickbooksCustomerDisplayName !== fetchedName) {
              mapping.quickbooksCustomerDisplayName = fetchedName;
              await mapping.save().catch(err => {
                console.error('[QuickBooks] Failed to update mapping with customer name:', err);
              });
              console.log(`[QuickBooks] Updated mapping with customer name: ${fetchedName}`);
            }
          } else {
            console.log(`[QuickBooks] ⚠️ Customer found in QuickBooks but no DisplayName or CompanyName`);
          }
        } else {
          console.log(`[QuickBooks] ⚠️ Customer not found in QuickBooks API for ID: ${mapping.quickbooksCustomerId}`);
        }
      } catch (err) {
        console.error('[QuickBooks] ❌ Failed to fetch customer name from QuickBooks API:', err.message);
        // Continue with name from mapping if available
      }
    }

    console.log(`[QuickBooks] Final customer name to send to frontend: ${quickbooksCustomerName}`);

    res.json({ 
      invoices: validInvoices,
      quickbooksCustomerName: quickbooksCustomerName
    });
  } catch (err) {
    console.error('[QuickBooks /customer/:id/invoices] Error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch invoices from QuickBooks' });
  }
});

// GET /api/quickbooks/invoices
// query: ?startPosition=1&maxResults=100
router.get('/invoices', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const owner = await getQuickBooksConnectionOwner();

    if (!owner.quickbooksAccessToken || !owner.quickbooksRealmId) {
      return res.status(400).json({ error: 'QuickBooks is not connected.' });
    }

    const accessToken = await getValidAccessToken();
    const startPosition = Number(req.query.startPosition || 1);
    const maxResults = Number(req.query.maxResults || 100);

    const result = await QuickBooksService.getAllInvoices({
      accessToken,
      realmId: owner.quickbooksRealmId,
      startPosition,
      maxResults,
    });

    const normalized = result.items.map((inv) => QuickBooksService.normalizeInvoice(inv));

    res.json({
      invoices: normalized,
      totalCount: result.totalCount,
      startPosition: result.startPosition,
      maxResults: result.maxResults,
    });
  } catch (err) {
    console.error('[QuickBooks /invoices] Error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch invoices from QuickBooks' });
  }
});

/**
 * GET /api/quickbooks/invoice/:invoiceId/pdf
 * Download invoice as PDF (for receipts)
 * Customers can only download their own invoices
 */
router.get('/invoice/:invoiceId/pdf', authenticateToken, authorizeRole(['customer', 'admin']), async (req, res) => {
  try {
    const { invoiceId } = req.params;

    // For customers, verify they can only access their own invoices
    if (req.user.role === 'customer') {
      const userId = String(req.user.id);
      
      // Find mapping for this customer
      let mapping = await QuickBooksCustomerMapping.findOne({ portalCustomerId: userId });
      
      if (!mapping && mongoose.Types.ObjectId.isValid(userId)) {
        mapping = await QuickBooksCustomerMapping.findOne({ 
          portalCustomerId: new mongoose.Types.ObjectId(userId) 
        });
      }

      if (!mapping) {
        return res.status(404).json({ error: 'No QuickBooks customer mapped for this portal customer.' });
      }

      // Verify the invoice belongs to this customer by fetching it
      const owner = await getQuickBooksConnectionOwner();
      if (!owner.quickbooksAccessToken || !owner.quickbooksRealmId) {
        return res.status(400).json({ error: 'QuickBooks is not connected.' });
      }

      const accessToken = await getValidAccessToken();

      // Fetch the invoice to verify it belongs to the mapped customer
      const invoices = await QuickBooksService.getInvoicesForCustomer({
        accessToken,
        realmId: owner.quickbooksRealmId,
        quickbooksCustomerId: mapping.quickbooksCustomerId,
        maxResults: 1000, // Get all to find the specific invoice
      });

      const invoice = invoices.find(inv => String(inv.Id) === String(invoiceId));
      if (!invoice) {
        return res.status(403).json({ error: 'You can only download invoices for your own account.' });
      }
    }

    // Get QuickBooks connection
    const owner = await getQuickBooksConnectionOwner();
    if (!owner.quickbooksAccessToken || !owner.quickbooksRealmId) {
      return res.status(400).json({ error: 'QuickBooks is not connected.' });
    }

    const accessToken = await getValidAccessToken();

    // Call QuickBooks PDF endpoint
    // Use production base URL (always production)
    const baseUrl = 'https://quickbooks.api.intuit.com';
    const pdfUrl = `${baseUrl}/v3/company/${owner.quickbooksRealmId}/invoice/${invoiceId}/pdf`;
    
    console.log(`[QuickBooks] Fetching PDF for invoice: ${invoiceId}`);

    const response = await axios.get(pdfUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/pdf',
      },
      responseType: 'stream', // Stream the PDF
    });

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoiceId}.pdf"`);

    // Pipe the PDF stream to the response
    response.data.pipe(res);
  } catch (err) {
    console.error('[QuickBooks /invoice/:id/pdf] Error:', err.response?.data || err.message);
    
    if (err.response?.status === 404) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    res.status(500).json({ error: 'Failed to download invoice PDF' });
  }
});

module.exports = router;
