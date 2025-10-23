# Google Business Profile API Setup Guide

## Overview

This guide will help you set up Google Business Profile API integration to replace the mock data with real analytics from Google My Business.

## Prerequisites

- Google account with Google My Business access
- Google Cloud Console access
- Existing Google Ads integration (for authentication)

## Step 1: Google Cloud Console Setup

### 1.1 Create or Select Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Note your **Project ID** for later use

### 1.2 Enable Required APIs

Navigate to **APIs & Services > Library** and enable:

1. **Google My Business API**
   - Search for "Google My Business API"
   - Click "Enable"

2. **Google My Business Business Information API**
   - Search for "Google My Business Business Information API"
   - Click "Enable"

3. **Google My Business Account Management API**
   - Search for "Google My Business Account Management API"
   - Click "Enable"

### 1.3 Create API Credentials

1. Go to **APIs & Services > Credentials**
2. Click **"+ CREATE CREDENTIALS"**
3. Select **"API Key"**
4. Copy the API key (you'll need this for `GOOGLE_BUSINESS_API_KEY`)

## Step 2: OAuth 2.0 Setup

### 2.1 Create OAuth 2.0 Client

1. In **APIs & Services > Credentials**
2. Click **"+ CREATE CREDENTIALS"**
3. Select **"OAuth client ID"**
4. Choose **"Web application"**
5. Add your redirect URIs:
   - `http://localhost:3000/api/google-business/callback` (development)
   - `https://yourdomain.com/api/google-business/callback` (production)

### 2.2 Download Credentials

1. Download the JSON credentials file
2. Note the **Client ID** and **Client Secret**

## Step 3: Environment Variables

Add these to your `.env` file:

```bash
# Google Business Profile API
GOOGLE_BUSINESS_CLIENT_ID=your_oauth_client_id_here
GOOGLE_BUSINESS_CLIENT_SECRET=your_oauth_client_secret_here
GOOGLE_BUSINESS_REDIRECT_URI=http://localhost:3000/api/google-business/callback
GOOGLE_BUSINESS_API_KEY=your_api_key_here
```

## Step 4: Update OAuth Scopes

The Google Business Profile API requires additional OAuth scopes. Update your Google Ads OAuth flow to include:

```javascript
const scopes = [
  'https://www.googleapis.com/auth/adwords', // Existing Google Ads scope
  'https://www.googleapis.com/auth/business.manage', // Google My Business scope
  'https://www.googleapis.com/auth/plus.business.manage' // Business Profile scope
];
```

## Step 5: Testing the Integration

### 5.1 Test Business Profiles Endpoint

```bash
curl -X GET "http://localhost:3000/api/google-business/business-profiles/CUSTOMER_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5.2 Test Insights Endpoint

```bash
curl -X GET "http://localhost:3000/api/google-business/business-insights/CUSTOMER_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Step 6: Common Issues and Solutions

### Issue 1: "API not enabled" error
**Solution**: Make sure all required APIs are enabled in Google Cloud Console

### Issue 2: "Access denied" error
**Solution**: 
- Verify the user has Google My Business profiles
- Check OAuth scopes include business management permissions
- Ensure the API key has proper permissions

### Issue 3: "No business profiles found"
**Solution**:
- User must have verified Google My Business profiles
- Profiles must be active and not suspended
- User must be an owner or manager of the business profiles

### Issue 4: "Insufficient permissions" error
**Solution**:
- Update OAuth scopes to include business management
- Re-authenticate users to get new permissions
- Verify API key has access to Google My Business APIs

## Step 7: Production Considerations

### 7.1 API Quotas
- Google My Business API has rate limits
- Monitor usage in Google Cloud Console
- Implement proper error handling and retry logic

### 7.2 Data Caching
- Consider caching insights data to reduce API calls
- Implement appropriate cache expiration times
- Handle data freshness requirements

### 7.3 Error Handling
- Implement comprehensive error handling
- Provide user-friendly error messages
- Log API errors for debugging

## Step 8: Verification

1. **Admin Interface**: Go to `/admin/google-business`
2. **Select Customer**: Choose a customer with Google My Business profiles
3. **Connect Profile**: Select and connect a business profile
4. **View Analytics**: Go to `/customer/google-business-analytics`
5. **Verify Data**: Confirm real data is being displayed

## API Endpoints Reference

### Get Business Profiles
```
GET /api/google-business/business-profiles/:customerId
```

### Save Business Profile
```
POST /api/google-business/save-business-profile
```

### Get Business Insights
```
GET /api/google-business/business-insights/:customerId?start=YYYY-MM-DD&end=YYYY-MM-DD
```

## Support

For issues with Google My Business API:
- [Google My Business API Documentation](https://developers.google.com/my-business/reference/rest)
- [Google Cloud Support](https://cloud.google.com/support)
- [Stack Overflow - Google My Business API](https://stackoverflow.com/questions/tagged/google-my-business-api)
