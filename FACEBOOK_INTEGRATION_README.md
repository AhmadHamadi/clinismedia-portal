# Facebook Integration for CliniMedia Portal

## Overview

This implementation provides a complete Facebook integration system for the CliniMedia portal, allowing admins to connect Facebook Pages to clinics/customers and enabling customers to view their page insights.

## Features

### Admin Features
- **Facebook Management Dashboard**: Admins can view all clinics and their Facebook connection status
- **OAuth Flow**: Secure Facebook authentication for admins to access their business pages
- **Page Selection**: Admins can select which Facebook page to connect to each clinic
- **Connection Management**: Admins can connect, reconnect, or disconnect Facebook pages
- **Admin-Only Access**: Only administrators can manage Facebook connections

### Customer Features
- **View Connection Status**: Customers can see if their Facebook page is connected
- **Facebook Insights**: Customers can view detailed analytics for their connected page
- **Read-Only Access**: Customers cannot modify their Facebook connections

## Implementation Details

### Backend Components

#### 1. User Model (`backend/models/User.js`)
Added Facebook fields to store page connection data:
```javascript
facebookPageId: String,
facebookPageName: String,
facebookAccessToken: String,
facebookTokenExpiry: Date,
```

#### 2. Facebook Routes (`backend/routes/facebook.js`)
- `GET /api/facebook/auth/:clinicId` - Initiates OAuth flow
- `GET /api/facebook/callback` - Handles OAuth callback
- `POST /api/facebook/save-page` - Saves selected page (admin only)
- `PATCH /api/facebook/disconnect/:clinicId` - Disconnects page (admin only)
- `GET /api/facebook/insights/:customerId` - Fetches page insights

#### 3. Customer Routes (`backend/routes/customers.js`)
- Updated to include Facebook fields in customer data
- Added `PATCH /api/customers/:id/facebook-disconnect` endpoint

#### 4. Authentication & Authorization
- All Facebook management endpoints require admin authentication
- Customer insights endpoint allows customers to view their own data or admins to view any data

### Frontend Components

#### 1. Admin Facebook Management
- **FacebookManagementLogic.tsx**: Business logic for admin Facebook management
- **FacebookManagementPage.tsx**: Main admin interface for managing Facebook connections

#### 2. Customer Facebook Features
- **FacebookIntegrationPage.tsx**: Shows connection status and allows viewing insights
- **FacebookInsightsPage.tsx**: Displays detailed Facebook analytics

#### 3. Navigation Updates
- Added "Facebook Management" to admin sidebar
- Added "Facebook Insights" to customer sidebar

## Environment Variables Required

Add these to your `.env` file:

```env
# Facebook App Configuration
FB_APP_ID=your_facebook_app_id
FB_APP_SECRET=your_facebook_app_secret
FB_REDIRECT_URI=http://localhost:5000/api/facebook/callback

# For production, update FB_REDIRECT_URI to your production domain
```

## Facebook App Setup

1. **Create Facebook App**:
   - Go to [Facebook Developers](https://developers.facebook.com/)
   - Create a new app or use existing app
   - Add Facebook Login product

2. **Configure OAuth**:
   - Set Valid OAuth Redirect URIs to include your callback URL
   - Add required permissions: `pages_show_list`, `pages_read_engagement`

3. **App Review** (for production):
   - Submit app for review to access page insights
   - Request permissions for `pages_read_engagement`

## Usage Workflow

### Admin Workflow
1. Admin logs into the admin portal
2. Navigates to "Facebook Management" in the sidebar
3. Views all clinics and their Facebook connection status
4. Clicks "Connect Facebook" for a clinic
5. Completes Facebook OAuth flow
6. Selects the appropriate Facebook page from the list
7. Saves the connection

### Customer Workflow
1. Customer logs into their portal
2. Navigates to "Facebook Integration" to see connection status
3. If connected, can view "Facebook Insights" for analytics
4. Views detailed metrics including impressions, reach, engagements, and followers

## API Endpoints

### Admin Endpoints (Require Admin Authentication)
```
GET    /api/customers                    - Get all customers with Facebook data
POST   /api/facebook/save-page           - Save Facebook page connection
PATCH  /api/facebook/disconnect/:clinicId - Disconnect Facebook page
PATCH  /api/customers/:id/facebook-disconnect - Disconnect Facebook page (alternative)
```

### Customer Endpoints (Require Customer Authentication)
```
GET    /api/facebook/insights/:customerId - Get Facebook insights for customer
```

### OAuth Endpoints (Public)
```
GET    /api/facebook/auth/:clinicId      - Initiate OAuth flow
GET    /api/facebook/callback            - Handle OAuth callback
```

## Security Features

1. **Role-Based Access Control**: Only admins can manage Facebook connections
2. **Token Authentication**: All endpoints require valid JWT tokens
3. **Data Isolation**: Customers can only view their own Facebook data
4. **Secure Token Storage**: Facebook access tokens are encrypted and stored securely

## Error Handling

The system handles various error scenarios:
- Facebook OAuth failures
- Invalid or expired tokens
- Missing Facebook page connections
- API rate limiting
- Network connectivity issues

## Future Enhancements

Potential improvements for the Facebook integration:
1. **Scheduled Insights**: Automatically fetch and cache insights data
2. **Historical Data**: Store and display historical analytics
3. **Multiple Pages**: Support connecting multiple pages per clinic
4. **Advanced Metrics**: Include more detailed Facebook metrics
5. **Export Features**: Allow exporting insights data
6. **Notifications**: Alert admins about connection issues

## Troubleshooting

### Common Issues

1. **OAuth Errors**:
   - Verify Facebook app configuration
   - Check redirect URI settings
   - Ensure app is approved for required permissions

2. **Insights Not Loading**:
   - Verify page access token is valid
   - Check if page has sufficient data for insights
   - Ensure app has been approved for insights access

3. **Permission Errors**:
   - Verify admin role assignments
   - Check JWT token validity
   - Ensure proper authentication headers

### Debug Steps

1. Check browser console for frontend errors
2. Review server logs for backend errors
3. Verify environment variables are set correctly
4. Test Facebook app configuration in Facebook Developer Console
5. Verify database connections and user data

## Support

For issues or questions about the Facebook integration:
1. Check the troubleshooting section above
2. Review Facebook Developer documentation
3. Contact the development team with specific error messages and logs 