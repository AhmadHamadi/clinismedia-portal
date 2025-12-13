const User = require('../models/User');
const GoogleBusinessInsights = require('../models/GoogleBusinessInsights');
const { google } = require('googleapis');
const axios = require('axios');

// OAuth 2.0 configuration
const backendPort = process.env.PORT || 5000;
// Priority: GOOGLE_BUSINESS_REDIRECT_URI > RAILWAY_PUBLIC_DOMAIN > BACKEND_URL > Production fallback
let backendUrl;
if (process.env.RAILWAY_PUBLIC_DOMAIN) {
  backendUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
} else if (process.env.BACKEND_URL) {
  backendUrl = process.env.BACKEND_URL;
} else if (process.env.NODE_ENV === 'development') {
  // Use localhost only in development
  backendUrl = `http://localhost:${backendPort}`;
} else {
  // Production fallback
  backendUrl = 'https://api.clinimediaportal.ca';
}
// Ensure redirect URI is properly set - must match Google Cloud Console configuration
const redirectUri = process.env.GOOGLE_BUSINESS_REDIRECT_URI || `${backendUrl}/api/google-business/callback`;

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_BUSINESS_CLIENT_ID,
  process.env.GOOGLE_BUSINESS_CLIENT_SECRET,
  redirectUri
);

// Helper: Get fresh access token from refresh token (direct API call - doesn't require redirect URI match)
async function refreshGoogleBusinessToken(refreshToken) {
  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_BUSINESS_CLIENT_ID,
      client_secret: process.env.GOOGLE_BUSINESS_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    
    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token || refreshToken, // Use new if provided, otherwise keep old
      expires_in: response.data.expires_in,
    };
  } catch (error) {
    console.error('❌ Direct token refresh failed:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw error;
  }
}

class GoogleBusinessDataRefreshService {
  // ✅ NEW: Refresh single customer (for manual refresh endpoint)
  static async refreshSingleCustomer(customer) {
    try {
      const today = new Date();
      const bufferDays = 2;
      const totalDays = 90 + bufferDays;
      const startDate = new Date(today.getTime() - totalDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = new Date(today.getTime() - bufferDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      console.log(`🔄 Refreshing data for ${customer.name} (${customer.googleBusinessProfileName})`);
      console.log(`📅 Date range: ${startDate} to ${endDate}`);

      // Validate that refresh token exists
      if (!customer.googleBusinessRefreshToken) {
        console.error(`⚠️ No refresh token found for ${customer.name}. Marking as needing re-authentication.`);
        await User.findByIdAndUpdate(customer._id, {
          googleBusinessNeedsReauth: true
        });
        throw new Error('No refresh token available');
      }

      // Set up OAuth client for this customer
      oauth2Client.setCredentials({
        access_token: customer.googleBusinessAccessToken,
        refresh_token: customer.googleBusinessRefreshToken
      });

      // Check if token needs refresh
      const now = Date.now();
      const expiresAt = customer.googleBusinessTokenExpiry ? new Date(customer.googleBusinessTokenExpiry).getTime() : 0;
      const refreshThreshold = 60 * 1000; // 60 seconds before expiry

      // ✅ FIXED: Only refresh if we have a valid expiry date AND token expires soon
      // If expiresAt is 0 (no expiry set), assume token is still valid and try to use it
      if (expiresAt > 0 && now > (expiresAt - refreshThreshold)) {
        console.log(`🔄 Refreshing token for ${customer.name}...`);
        try {
          const refreshedTokens = await refreshGoogleBusinessToken(customer.googleBusinessRefreshToken);
          
          // ✅ FIXED: Always set expiry - default to 1 hour if expires_in is not provided
          let newExpiry = null;
          if (refreshedTokens.expires_in && !isNaN(Number(refreshedTokens.expires_in)) && refreshedTokens.expires_in > 0) {
            newExpiry = new Date(Date.now() + refreshedTokens.expires_in * 1000);
          } else {
            // Default to 1 hour if expires_in is not provided (Google tokens typically expire in 1 hour)
            newExpiry = new Date(Date.now() + 3600 * 1000);
            console.log(`⚠️ Token refresh did not return expires_in for ${customer.name}, defaulting to 1 hour expiry`);
          }
          
          const updateData = {
            googleBusinessAccessToken: refreshedTokens.access_token,
            googleBusinessTokenExpiry: newExpiry // ✅ FIXED: Always set expiry
          };
          
          if (refreshedTokens.refresh_token) {
            updateData.googleBusinessRefreshToken = refreshedTokens.refresh_token;
          }
          
          await User.findByIdAndUpdate(customer._id, updateData);
          
          oauth2Client.setCredentials({
            access_token: refreshedTokens.access_token,
            refresh_token: refreshedTokens.refresh_token || customer.googleBusinessRefreshToken
          });
          
          console.log(`✅ Token refreshed for ${customer.name}`);
        } catch (refreshError) {
          console.error(`❌ Token refresh failed for ${customer.name}:`, refreshError.message);
          if (refreshError.response?.data?.error === 'invalid_grant' || 
              refreshError.message?.includes('invalid_grant')) {
            await User.findByIdAndUpdate(customer._id, {
              googleBusinessNeedsReauth: true
            });
          }
          throw refreshError;
        }
      }

      // Fetch fresh insights data
      const insightsData = await this.fetchBusinessInsightsData(
        oauth2Client,
        customer.googleBusinessProfileId,
        startDate,
        endDate,
        oauth2Client.credentials.access_token
      );

      if (insightsData) {
        const processedData = await this.processAndSaveInsights(
          customer,
          insightsData,
          startDate,
          endDate,
          90
        );

        if (processedData) {
          console.log(`✅ Successfully refreshed and saved data for ${customer.name}`);
          return processedData;
        } else {
          throw new Error('Failed to save data');
        }
      } else {
        throw new Error('No data returned from API');
      }
    } catch (error) {
      console.error(`❌ Failed to refresh data for ${customer.name}:`, error.message);
      throw error;
    }
  }

  static async refreshAllBusinessProfiles() {
    try {
      console.log('🔄 Starting daily Google Business Profile data refresh...');
      
      // Get all customers with Google Business Profile connected
      // Only include customers who have both access token and refresh token, and are not marked as needing re-auth
      const customers = await User.find({
        googleBusinessProfileId: { $exists: true, $ne: null },
        googleBusinessAccessToken: { $exists: true, $ne: null },
        googleBusinessRefreshToken: { $exists: true, $ne: null },
        googleBusinessNeedsReauth: { $ne: true } // Skip customers already marked as needing re-auth
      });

      console.log(`📊 Found ${customers.length} customers with Google Business Profile connected`);

      if (customers.length === 0) {
        console.log('ℹ️ No customers with Google Business Profile found');
        return;
      }

      const today = new Date();
      const bufferDays = 2; // ✅ FIXED: Reduced from 3 to 2 days (Google data is typically 1-2 days behind, not 3)
      
      // Calculate date range for last 90 days (to match maximum display range)
      const totalDays = 90 + bufferDays;
      const startDate = new Date(today.getTime() - totalDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = new Date(today.getTime() - bufferDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // ✅ NEW: Comprehensive logging
      console.log('🔄 ===== GOOGLE BUSINESS DATA REFRESH STARTED =====');
      console.log(`📅 Today: ${today.toISOString()}`);
      console.log(`📅 Start Date: ${startDate} (should be ~90 days ago)`);
      console.log(`📅 End Date: ${endDate} (should be ${bufferDays} days ago)`);
      console.log(`📅 Buffer Days: ${bufferDays}`);
      console.log(`📅 Refreshing data for period: ${startDate} to ${endDate} (90 days)`);
      console.log(`📊 Customers to process: ${customers.length}`);

      // Process each customer
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < customers.length; i++) {
        const customer = customers[i];
        try {
          // ✅ NEW: Enhanced logging
          console.log(`\n🔄 Processing: ${customer.name} (${i + 1}/${customers.length})`);
          console.log(`📍 Location ID: ${customer.googleBusinessProfileId}`);
          console.log(`📍 Location Name: ${customer.googleBusinessProfileName}`);
          console.log(`📧 Email: ${customer.email}`);
          
          // Validate that refresh token exists
          if (!customer.googleBusinessRefreshToken) {
            console.error(`⚠️ No refresh token found for ${customer.name}. Marking as needing re-authentication.`);
            await User.findByIdAndUpdate(customer._id, {
              googleBusinessNeedsReauth: true
            });
            errorCount++;
            continue; // Skip this customer
          }
          
          // Set up OAuth client for this customer
          oauth2Client.setCredentials({
            access_token: customer.googleBusinessAccessToken,
            refresh_token: customer.googleBusinessRefreshToken
          });

          // Check if token needs refresh
          const now = Date.now();
          const expiresAt = customer.googleBusinessTokenExpiry ? new Date(customer.googleBusinessTokenExpiry).getTime() : 0;
          const refreshThreshold = 60 * 1000; // 60 seconds before expiry

          // ✅ FIXED: Only refresh if we have a valid expiry date AND token expires soon
          // If expiresAt is 0 (no expiry set), assume token is still valid and try to use it
          if (expiresAt > 0 && now > (expiresAt - refreshThreshold)) {
            console.log(`🔄 Refreshing token for ${customer.name}...`);
            try {
              // Use direct token refresh (like Google Ads) - doesn't require redirect URI match
              const refreshedTokens = await refreshGoogleBusinessToken(customer.googleBusinessRefreshToken);
              
              // ✅ FIXED: Always set expiry - default to 1 hour if expires_in is not provided
              let newExpiry = null;
              if (refreshedTokens.expires_in && !isNaN(Number(refreshedTokens.expires_in)) && refreshedTokens.expires_in > 0) {
                newExpiry = new Date(Date.now() + refreshedTokens.expires_in * 1000);
              } else {
                // Default to 1 hour if expires_in is not provided (Google tokens typically expire in 1 hour)
                newExpiry = new Date(Date.now() + 3600 * 1000);
                console.log(`⚠️ Token refresh did not return expires_in for ${customer.name}, defaulting to 1 hour expiry`);
              }
              
              const updateData = {
                googleBusinessAccessToken: refreshedTokens.access_token,
                googleBusinessTokenExpiry: newExpiry // ✅ FIXED: Always set expiry
              };
              
              // Preserve refresh token if provided (Google may rotate it)
              if (refreshedTokens.refresh_token) {
                updateData.googleBusinessRefreshToken = refreshedTokens.refresh_token;
              }
              
              await User.findByIdAndUpdate(customer._id, updateData);
              
              // Update our local OAuth client credentials for API calls
              oauth2Client.setCredentials({
                access_token: refreshedTokens.access_token,
                refresh_token: refreshedTokens.refresh_token || customer.googleBusinessRefreshToken
              });
              
              console.log(`✅ Token refreshed for ${customer.name} using direct API call`);
            } catch (refreshError) {
              console.error(`❌ Token refresh failed for ${customer.name}:`, refreshError.message);
              console.error(`❌ Refresh error details:`, refreshError.response?.data || refreshError.message);
              
              // Handle invalid_grant error (expired/revoked refresh token)
              if (refreshError.response?.data?.error === 'invalid_grant' || 
                  refreshError.message?.includes('invalid_grant')) {
                // Mark customer as needing re-auth
                await User.findByIdAndUpdate(customer._id, {
                  googleBusinessNeedsReauth: true
                });
                console.log(`⚠️ Marked ${customer.name} as needing re-authentication (refresh token expired or revoked)`);
                errorCount++;
              } else {
                // Other errors (network, API, etc.)
                console.error(`⚠️ Token refresh failed for ${customer.name} due to: ${refreshError.message}`);
                errorCount++;
              }
              continue; // Skip this customer
            }
          }

          // Fetch fresh insights data
          const insightsData = await this.fetchBusinessInsightsData(
            oauth2Client,
            customer.googleBusinessProfileId,
            startDate,
            endDate,
            oauth2Client.credentials.access_token
          );

          if (insightsData) {
            // ✅ NEW: Log API response details
            console.log(`✅ API response received for ${customer.name}`);
            const rawDataPreview = JSON.stringify(insightsData).substring(0, 200);
            console.log(`📊 Raw data structure preview: ${rawDataPreview}...`);
            
            // Process and save the data (90 days for maximum retention)
            const processedData = await this.processAndSaveInsights(
              customer,
              insightsData,
              startDate,
              endDate,
              90 // days - save 90 days of data for maximum display range
            );

            if (processedData) {
              console.log(`✅ Successfully refreshed and saved data for ${customer.name}`);
              console.log(`📅 Data covers: ${startDate} to ${endDate}`);
              successCount++;
            } else {
              console.log(`⚠️ Failed to save data for ${customer.name}`);
              errorCount++;
            }
          } else {
            console.log(`⚠️ No data returned for ${customer.name}`);
            errorCount++;
          }

          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`❌ Failed to refresh data for ${customer.name}:`, error.message);
          errorCount++;
        }
      }

      // ✅ NEW: Comprehensive completion logging
      console.log('\n🔄 ===== REFRESH COMPLETE =====');
      console.log(`✅ Successful: ${successCount}`);
      console.log(`❌ Errors: ${errorCount}`);
      console.log(`📅 Next refresh: Tomorrow at 8:00 AM`);
      console.log(`📊 Daily refresh complete: ${successCount} successful, ${errorCount} errors`);
      
    } catch (error) {
      console.error('❌ Error in daily Google Business Profile refresh:', error);
    }
  }

  static async fetchBusinessInsightsData(oauth2Client, locationId, startDate, endDate, accessToken) {
    try {
      // Convert dates to the format expected by the API
      const startDateObj = {
        year: parseInt(startDate.split('-')[0]),
        month: parseInt(startDate.split('-')[1]),
        day: parseInt(startDate.split('-')[2])
      };
      const endDateObj = {
        year: parseInt(endDate.split('-')[0]),
        month: parseInt(endDate.split('-')[1]),
        day: parseInt(endDate.split('-')[2])
      };

      const metrics = [
        'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
        'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
        'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
        'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
        'WEBSITE_CLICKS',
        'CALL_CLICKS',
        'BUSINESS_DIRECTION_REQUESTS'
      ];
      
      // Build query parameters using URLSearchParams
      const params = new URLSearchParams();
      metrics.forEach(metric => params.append('dailyMetrics', metric));
      params.append('dailyRange.start_date.year', startDateObj.year);
      params.append('dailyRange.start_date.month', startDateObj.month);
      params.append('dailyRange.start_date.day', startDateObj.day);
      params.append('dailyRange.end_date.year', endDateObj.year);
      params.append('dailyRange.end_date.month', endDateObj.month);
      params.append('dailyRange.end_date.day', endDateObj.day);
      
      const locationName = `locations/${locationId}`;
      
      const insightsResponse = await axios.get(
        `https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMultiDailyMetricsTimeSeries`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          params,
          paramsSerializer: p => p.toString()
        }
      );
      
      return insightsResponse.data;
    } catch (error) {
      console.error('Error fetching business insights data:', error.message);
      return null;
    }
  }

  static async processAndSaveInsights(customer, insightsData, startDate, endDate, days) {
    try {
      // Process the insights data using the same logic as the API endpoint
      const processedData = this.summarizeMulti(insightsData);
      
      // Process daily data
      const dailyData = [];
      if (insightsData.multiDailyMetricTimeSeries) {
        const flatMetrics = insightsData.multiDailyMetricTimeSeries.flatMap(group => 
          group?.dailyMetricTimeSeries ?? []
        );
        
        flatMetrics.forEach(metricSeries => {
          const metric = metricSeries.dailyMetric;
          const timeSeries = metricSeries.timeSeries;
          const dailyValues = timeSeries?.datedValues || [];

          dailyValues.forEach(dailyValue => {
            const date = `${dailyValue.date.year}-${String(dailyValue.date.month).padStart(2, '0')}-${String(dailyValue.date.day).padStart(2, '0')}`;
            
            if (!dailyData.find(d => d.date === date)) {
              dailyData.push({
                date,
                views: 0,
                searches: 0,
                calls: 0,
                directions: 0,
                websiteClicks: 0
              });
            }

            const dayData = dailyData.find(d => d.date === date);
            const value = dailyValue.value !== undefined ? Number(dailyValue.value) : 0;
            
            switch (metric) {
              case 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH':
              case 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH':
                dayData.searches += value;
                break;
              case 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS':
              case 'BUSINESS_IMPRESSIONS_MOBILE_MAPS':
                dayData.views += value;
                break;
              case 'CALL_CLICKS':
                dayData.calls += value;
                break;
              case 'BUSINESS_DIRECTION_REQUESTS':
                dayData.directions += value;
                break;
              case 'WEBSITE_CLICKS':
                dayData.websiteClicks += value;
                break;
            }
          });
        });
      }

      // Sort daily data by date
      dailyData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Create or update the insights record
      const insightsRecord = {
        customerId: customer._id,
        locationId: customer.googleBusinessProfileId,
        businessProfileName: customer.googleBusinessProfileName,
        date: new Date(), // Current date when data was fetched
        metrics: {
          totalViews: processedData.totalViews,
          totalSearches: processedData.totalSearches,
          totalCalls: processedData.totalCalls,
          totalDirections: processedData.totalDirections,
          totalWebsiteClicks: processedData.totalWebsiteClicks
        },
        dailyData: dailyData,
        period: {
          start: startDate,
          end: endDate,
          days: days
        },
        rawApiData: insightsData, // Store raw data for debugging
        lastUpdated: new Date()
      };

      // ✅ FIXED: Always update the most recent 90-day record to keep rolling 90 days of data
      // Find the most recent 90-day record for this customer (regardless of when it was saved)
      const existingRecord = await GoogleBusinessInsights.findOne({
        customerId: customer._id,
        'period.days': 90
      }).sort({ lastUpdated: -1 });

      // ✅ IMPROVED: Explicit update or create logic
      let savedRecord;
      if (existingRecord) {
        // Update existing record
        existingRecord.metrics = insightsRecord.metrics;
        existingRecord.dailyData = insightsRecord.dailyData;
        existingRecord.period = insightsRecord.period;
        existingRecord.rawApiData = insightsRecord.rawApiData;
        existingRecord.lastUpdated = new Date();
        existingRecord.date = new Date(); // Update fetch date
        await existingRecord.save();
        savedRecord = existingRecord;
        console.log(`✅ Updated existing record for ${customer.name}`);
      } else {
        // Create new record
        savedRecord = await GoogleBusinessInsights.create(insightsRecord);
        console.log(`✅ Created new record for ${customer.name}`);
      }

      // ✅ NEW: Enhanced logging
      console.log(`💾 Saved insights data for ${customer.name}: ${dailyData.length} days of data`);
      if (dailyData.length > 0) {
        console.log(`📅 First date: ${dailyData[0]?.date}`);
        console.log(`📅 Last date: ${dailyData[dailyData.length - 1]?.date}`);
        const totalViews = dailyData.reduce((sum, day) => sum + (day.views || 0), 0);
        console.log(`📊 Total views in period: ${totalViews}`);
      }
      return savedRecord;

    } catch (error) {
      console.error('Error processing and saving insights:', error.message);
      return null;
    }
  }

  static summarizeMulti(data) {
    const groups = Array.isArray(data?.multiDailyMetricTimeSeries)
      ? data.multiDailyMetricTimeSeries
      : [];

    const flat = groups.flatMap(g => g?.dailyMetricTimeSeries ?? []);
    const byMetric = {};

    for (const m of flat) {
      const metric = m?.dailyMetric;
      if (!metric) continue;
      
      const values = m?.timeSeries?.datedValues ?? [];
      const total = values.reduce((s, p) => s + Number(p?.value ?? 0), 0);
      byMetric[metric] = { days: values.length, total, points: values };
    }

    const get = k => byMetric[k]?.total ?? 0;
    return {
      totalViews:
        get('BUSINESS_IMPRESSIONS_DESKTOP_SEARCH') +
        get('BUSINESS_IMPRESSIONS_MOBILE_SEARCH') +
        get('BUSINESS_IMPRESSIONS_DESKTOP_MAPS') +
        get('BUSINESS_IMPRESSIONS_MOBILE_MAPS'),
      totalSearches:
        get('BUSINESS_IMPRESSIONS_DESKTOP_SEARCH') +
        get('BUSINESS_IMPRESSIONS_MOBILE_SEARCH'),
      totalWebsiteClicks: get('WEBSITE_CLICKS'),
      totalCalls: get('CALL_CLICKS'),
      totalDirections: get('BUSINESS_DIRECTION_REQUESTS')
    };
  }
}

module.exports = GoogleBusinessDataRefreshService;


