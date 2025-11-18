const axios = require('axios');
const crypto = require('crypto');

// QuickBooks environment - ALWAYS PRODUCTION
// Sandbox is not supported - this integration only uses production QuickBooks API
const qbEnv = 'production';
const QUICKBOOKS_BASE_URL = 'https://quickbooks.api.intuit.com';

console.log('[QuickBooksService] Environment: PRODUCTION (sandbox disabled)');
console.log('[QuickBooksService] Base URL =', QUICKBOOKS_BASE_URL);

/**
 * QuickBooks Service
 * Handles OAuth authentication and API queries
 */
class QuickBooksService {
  constructor() {
    // OAuth configuration
    this.clientId = process.env.QUICKBOOKS_CLIENT_ID;
    this.clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
    
    // Validate required credentials
    if (!this.clientId || !this.clientSecret) {
      console.error('[QuickBooksService] ❌ Missing QuickBooks credentials!');
      console.error('[QuickBooksService] Client ID:', this.clientId ? 'SET' : 'NOT SET');
      console.error('[QuickBooksService] Client Secret:', this.clientSecret ? 'SET' : 'NOT SET');
      throw new Error('QuickBooks CLIENT_ID and CLIENT_SECRET must be set in environment variables');
    }
    
    // Hardcoded redirect URI for production
    // Development: Use localhost (only if NODE_ENV is development)
    // Production: Always use https://api.clinimediaportal.ca/api/quickbooks/callback
    if (process.env.NODE_ENV === 'development') {
      this.redirectUri = 'http://localhost:5000/api/quickbooks/callback';
      console.log('[QuickBooksService] Using development redirect URI (localhost)');
    } else {
      // Production: Hardcoded to production API URL
      this.redirectUri = 'https://api.clinimediaportal.ca/api/quickbooks/callback';
      console.log('[QuickBooksService] Using production redirect URI (hardcoded):', this.redirectUri);
    }
    
    // Validate redirect URI is set
    if (!this.redirectUri || this.redirectUri === 'undefined') {
      console.error('[QuickBooksService] ❌ Redirect URI is undefined or invalid!');
      console.error('[QuickBooksService] NODE_ENV:', process.env.NODE_ENV);
      throw new Error('QuickBooks redirect URI is undefined. This should not happen - redirect URI is hardcoded.');
    }
    
    // OAuth endpoints (same for both sandbox and production)
    this.authUrl = 'https://appcenter.intuit.com/connect/oauth2';
    this.tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    
    // API configuration - ALWAYS PRODUCTION
    this.env = qbEnv;
    this.baseUrl = QUICKBOOKS_BASE_URL;
    
    console.log('[QuickBooksService] ✅ Initialised env =', this.env);
    console.log('[QuickBooksService] ✅ Using base URL =', this.baseUrl);
    console.log('[QuickBooksService] ✅ Client ID:', this.clientId ? 'SET' : 'NOT SET');
    console.log('[QuickBooksService] ✅ Redirect URI:', this.redirectUri);
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state) {
    // Validate redirect URI before generating URL
    if (!this.redirectUri || this.redirectUri === 'undefined') {
      throw new Error('QuickBooks redirect URI is not set. Cannot generate authorization URL.');
    }
    
    if (!this.clientId) {
      throw new Error('QuickBooks Client ID is not set. Cannot generate authorization URL.');
    }
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      scope: 'com.intuit.quickbooks.accounting',
      redirect_uri: this.redirectUri,
      state: state,
    });

    const authUrl = `${this.authUrl}?${params.toString()}`;
    console.log('[QuickBooksService] Generated authorization URL with redirect_uri:', this.redirectUri);
    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code) {
    try {
      const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await axios.post(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri,
        }),
        {
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      // Log what QuickBooks returns for debugging
      console.log('[QuickBooksService] Token exchange response:', {
        hasAccessToken: !!response.data.access_token,
        hasRefreshToken: !!response.data.refresh_token,
        realmId: response.data.realmId,
        expiresIn: response.data.expires_in,
        expiresInType: typeof response.data.expires_in,
        x_refresh_token_expires_in: response.data.x_refresh_token_expires_in, // Refresh token expiry (in seconds, typically 8726400 = 101 days)
      });

      // Validate expires_in is a number (should be in seconds, typically 3600 for access tokens)
      const expiresIn = parseInt(response.data.expires_in, 10);
      if (isNaN(expiresIn) || expiresIn <= 0) {
        console.warn('[QuickBooksService] Invalid expires_in value:', response.data.expires_in, 'Defaulting to 3600 seconds (1 hour)');
        // Default to 1 hour if invalid
        return {
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token,
          realmId: response.data.realmId,
          expiresIn: 3600, // Default to 1 hour
          refreshTokenExpiresIn: response.data.x_refresh_token_expires_in ? parseInt(response.data.x_refresh_token_expires_in, 10) : undefined,
        };
      }

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        realmId: response.data.realmId,
        expiresIn: expiresIn, // Use validated number
        refreshTokenExpiresIn: response.data.x_refresh_token_expires_in ? parseInt(response.data.x_refresh_token_expires_in, 10) : undefined,
      };
    } catch (error) {
      console.error('Error exchanging code for tokens:', error.response?.data || error.message);
      throw new Error(`Failed to exchange code for tokens: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken) {
    try {
      const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await axios.post(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
        {
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      // Log what QuickBooks returns for debugging
      console.log('[QuickBooksService] Token refresh response:', {
        hasAccessToken: !!response.data.access_token,
        hasRefreshToken: !!response.data.refresh_token,
        expiresIn: response.data.expires_in,
        expiresInType: typeof response.data.expires_in,
        x_refresh_token_expires_in: response.data.x_refresh_token_expires_in,
      });

      // CRITICAL: QuickBooks refresh tokens rotate every ~24 hours
      // According to Intuit docs:
      // - "Always store the latest refresh_token value from the most recent API server response"
      // - "When you get a new refresh token, the previous refresh token value automatically expires"
      // - "We update the refresh_token value every 24 hours or the next time you refresh after 24 hours"
      const newRefreshToken = response.data.refresh_token;
      if (!newRefreshToken) {
        console.warn('[QuickBooksService] ⚠️ WARNING: QuickBooks did not return a new refresh_token in response.');
        console.warn('[QuickBooksService] ⚠️ This is unusual - QuickBooks should always return refresh_token. Old token may be invalid.');
      } else {
        console.log('[QuickBooksService] ✅ CRITICAL: Received new refresh_token from QuickBooks - MUST save this (old one is now invalid)');
      }

      // Validate expires_in is a number (should be in seconds, typically 3600 for access tokens)
      const expiresIn = parseInt(response.data.expires_in, 10);
      if (isNaN(expiresIn) || expiresIn <= 0) {
        console.warn('[QuickBooksService] Invalid expires_in value:', response.data.expires_in, 'Defaulting to 3600 seconds (1 hour)');
        // Default to 1 hour if invalid
        return {
          accessToken: response.data.access_token,
          refreshToken: newRefreshToken || refreshToken, // ALWAYS prefer new refresh token
          expiresIn: 3600, // Default to 1 hour
          refreshTokenExpiresIn: response.data.x_refresh_token_expires_in ? parseInt(response.data.x_refresh_token_expires_in, 10) : undefined,
        };
      }

      return {
        accessToken: response.data.access_token,
        refreshToken: newRefreshToken || refreshToken, // ALWAYS prefer new refresh token (QuickBooks rotates these)
        expiresIn: expiresIn, // Use validated number
        refreshTokenExpiresIn: response.data.x_refresh_token_expires_in ? parseInt(response.data.x_refresh_token_expires_in, 10) : undefined,
      };
    } catch (error) {
      console.error('Error refreshing token:', error.response?.data || error.message);
      throw new Error(`Failed to refresh token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Run a QuickBooks Online Query (SQL-like) against the /query endpoint.
   * @param {Object} params - Query parameters
   * @param {string} params.accessToken - QuickBooks access token
   * @param {string} params.realmId - QuickBooks company ID
   * @param {string} params.query - SQL-like query string
   * @param {number} [params.minorversion=65] - API minor version (default 65 for InvoiceLink support)
   * @param {string} [params.include] - Additional fields to include (e.g., 'invoiceLink')
   */
  async runQuery({ accessToken, realmId, query, minorversion = 65, include }) {
    if (!accessToken || !realmId) {
      throw new Error('Missing accessToken or realmId for QuickBooks query');
    }

    const url = `${this.baseUrl}/v3/company/${realmId}/query`;
    const params = new URLSearchParams({
      query: query,
      minorversion: minorversion.toString(),
    });

    // Add include parameter if provided (needed for InvoiceLink)
    if (include) {
      params.append('include', include);
    }

    const fullUrl = `${url}?${params.toString()}`;

    console.log('[QuickBooksService] runQuery ->', fullUrl);

    const response = await axios.get(fullUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/text',
      },
    });

    return response.data;
  }

  /**
   * Fetch up to maxResults customers from QuickBooks.
   */
  async getCustomers({ accessToken, realmId, maxResults = 1000 }) {
    const query = `SELECT * FROM Customer MAXRESULTS ${maxResults}`;

    const data = await this.runQuery({ 
      accessToken, 
      realmId, 
      query,
      minorversion: 65
    });

    const customers = data?.QueryResponse?.Customer || [];
    return Array.isArray(customers) ? customers : [customers];
  }

  /**
   * Fetch all invoices (paid + unpaid) with pagination.
   * Includes InvoiceLink for direct payment links.
   */
  async getAllInvoices({ accessToken, realmId, maxResults = 100, startPosition = 1 }) {
    const query = `
      SELECT *
      FROM Invoice
      STARTPOSITION ${startPosition}
      MAXRESULTS ${maxResults}
    `;

    // Include invoiceLink to get direct payment links
    const data = await this.runQuery({ 
      accessToken, 
      realmId, 
      query,
      minorversion: 65,
      include: 'invoiceLink'
    });

    const invoices = data?.QueryResponse?.Invoice || [];
    const items = Array.isArray(invoices) ? invoices : [invoices];

    const totalCount = data?.QueryResponse?.totalCount ?? items.length;

    return {
      items,
      totalCount,
      startPosition,
      maxResults,
    };
  }

  /**
   * Fetch invoices for a specific QuickBooks Customer.Id.
   * Includes InvoiceLink for direct payment links.
   */
  async getInvoicesForCustomer({
    accessToken,
    realmId,
    quickbooksCustomerId,
    maxResults = 100,
  }) {
    if (!quickbooksCustomerId) {
      throw new Error('Missing quickbooksCustomerId');
    }

    const query = `
      SELECT *
      FROM Invoice
      WHERE CustomerRef = '${quickbooksCustomerId}'
      ORDERBY TxnDate DESC
      MAXRESULTS ${maxResults}
    `;

    try {
      // Include invoiceLink to get direct payment links
      // minorversion 65+ is required for InvoiceLink support
      const data = await this.runQuery({ 
        accessToken, 
        realmId, 
        query,
        minorversion: 65,
        include: 'invoiceLink'
      });

      // Check for QuickBooks API errors
      if (data?.QueryResponse?.Fault) {
        const fault = data.QueryResponse.Fault;
        const errorMessage = fault.Error?.[0]?.Message || 'Unknown QuickBooks API error';
        const errorCode = fault.Error?.[0]?.code || 'Unknown';
        console.error('[QuickBooksService] QuickBooks API Fault:', {
          error: errorMessage,
          code: errorCode,
          detail: fault.Error?.[0]?.Detail
        });
        throw new Error(`QuickBooks API Error: ${errorMessage} (Code: ${errorCode})`);
      }

      // Handle response - can be single object, array, or undefined
      let invoices = data?.QueryResponse?.Invoice;
      
      if (!invoices) {
        console.log('[QuickBooksService] No invoices found in QueryResponse');
        return [];
      }

      // Convert single invoice to array
      if (!Array.isArray(invoices)) {
        if (invoices.Id) {
          console.log('[QuickBooksService] Single invoice returned, converting to array');
          invoices = [invoices];
        } else {
          console.warn('[QuickBooksService] Unexpected invoice format:', typeof invoices);
          return [];
        }
      }

      console.log(`[QuickBooksService] Retrieved ${invoices.length} invoices from QuickBooks API`);
      return invoices;
    } catch (err) {
      console.error('[QuickBooksService] Error in getInvoicesForCustomer:', err.message);
      console.error('[QuickBooksService] Error stack:', err.stack);
      throw err;
    }
  }

  /**
   * Normalize a QuickBooks invoice into a simplified object for the portal.
   * Extracts InvoiceLink for direct payment links.
   */
  normalizeInvoice(invoice) {
    if (!invoice || !invoice.Id) {
      console.warn('[QuickBooksService] Invalid invoice object in normalizeInvoice:', invoice);
      throw new Error('Invalid invoice object: missing Id field');
    }

    try {
      // Extract values from QuickBooks invoice object (uses PascalCase)
      const total = Number(invoice.TotalAmt ?? 0) || 0;
      const balance = Number(invoice.Balance ?? 0) || 0;

      let status = 'unknown';
      if (balance === 0) {
        status = 'paid';
      } else if (balance === total && total > 0) {
        status = 'unpaid';
      } else if (balance > 0 && balance < total) {
        status = 'partial';
      }

      // Extract InvoiceLink - this is the direct payment link (only available if online payments enabled)
      // InvoiceLink is the same link customers see when invoice is emailed to them
      const invoiceLink = invoice.InvoiceLink || null;

      const normalized = {
        id: String(invoice.Id || ''),
        docNumber: String(invoice.DocNumber || 'N/A'),
        txnDate: invoice.TxnDate || null,
        dueDate: invoice.DueDate || null,
        totalAmount: total,
        balance: balance,
        status: status,
        customerRef: invoice.CustomerRef || null,
        currencyRef: invoice.CurrencyRef || null,
        billEmail: invoice.BillEmail?.Address || null,
        invoiceLink: invoiceLink, // Direct payment link (null if online payments not enabled)
        lineItems: invoice.Line || [],
        raw: invoice, // keep raw for debugging / future fields
      };

      // Only log first invoice to avoid spam
      return normalized;
    } catch (err) {
      console.error('[QuickBooksService] Error normalizing invoice:', err);
      console.error('[QuickBooksService] Invoice data:', JSON.stringify(invoice, null, 2));
      throw err;
    }
  }

  /**
   * Convenience wrapper: get normalized invoices for a given QB customer.
   */
  async getNormalizedInvoicesForCustomer(params) {
    try {
      const invoices = await this.getInvoicesForCustomer(params);
      console.log(`[QuickBooksService] Normalizing ${invoices.length} invoices`);
      
      const normalized = invoices
        .map((inv, index) => {
          try {
            return this.normalizeInvoice(inv);
          } catch (err) {
            console.error(`[QuickBooksService] Error normalizing invoice ${index}:`, err.message);
            console.error(`[QuickBooksService] Invoice data:`, inv);
            // Return null for invalid invoices - will be filtered out
            return null;
          }
        })
        .filter((inv) => inv !== null); // Remove any null invoices
      
      console.log(`[QuickBooksService] Successfully normalized ${normalized.length} out of ${invoices.length} invoices`);
      return normalized;
    } catch (err) {
      console.error('[QuickBooksService] Error in getNormalizedInvoicesForCustomer:', err);
      throw err;
    }
  }
}

module.exports = new QuickBooksService();
