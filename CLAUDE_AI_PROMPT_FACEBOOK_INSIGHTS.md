# Facebook Insights API Metric Error - Fix Request for Claude AI

## Problem Summary
The Facebook Insights API is rejecting two metrics with error code 100: "The value must be a valid insights metric". This causes the Daily Impressions and Daily Followers charts to display empty/blank.

## Current Situation

### ✅ Working Metrics (Returning Data Successfully):
- `page_impressions_unique` (reach) - ✅ 30 items returned
- `page_post_engagements` (engagements) - ✅ 30 items returned  
- `page_views_total` (pageViews) - ✅ 30 items returned
- `page_video_views` (videoViews) - ✅ 30 items returned

### ❌ Failing Metrics (Error Code 100):
- `page_impressions` (impressions) - ❌ Error: "(#100) The value must be a valid insights metric"
- `page_fans` (followers) - ❌ Error: "(#100) The value must be a valid insights metric"

## Error Details from Logs

```
❌ Failed to fetch metric page_impressions (impressions): {
  error: {
    message: '(#100) The value must be a valid insights metric',
    type: 'OAuthException',
    code: 100,
    fbtrace_id: 'AMHvgWeRsydmvLZMocm2o4S'
  }
}

❌ Failed to fetch metric page_fans (followers): {
  error: {
    message: '(#100) The value must be a valid insights metric',
    type: 'OAuthException',
    code: 100,
    fbtrace_id: 'AA1FC45m73NefueTQt6kiJ2'
  }
}
```

## Current Code Implementation

**File:** `backend/routes/facebook.js`

**API Version:** Facebook Graph API v19.0

**Current Metrics Array:**
```javascript
const metrics = [
  { key: 'impressions', metric: 'page_impressions' },        // ❌ FAILING
  { key: 'reach', metric: 'page_impressions_unique' },       // ✅ WORKING
  { key: 'engagements', metric: 'page_post_engagements' },   // ✅ WORKING
  { key: 'followers', metric: 'page_fans' },                 // ❌ FAILING
  { key: 'pageViews', metric: 'page_views_total' },          // ✅ WORKING
  { key: 'videoViews', metric: 'page_video_views' },         // ✅ WORKING
];
```

**API Call Format:**
```javascript
const res = await axios.get(
  `https://graph.facebook.com/v19.0/${user.facebookPageId}/insights?metric=${metric}&period=day&since=${formatDate(startDate)}&until=${formatDate(endDate)}&access_token=${user.facebookAccessToken}`
);
```

## What We Need

1. **Correct Metric Names:**
   - What is the correct Facebook Graph API v19.0 metric name for "page impressions" (total impressions, not unique)?
   - What is the correct Facebook Graph API v19.0 metric name for "page followers" (current follower count)?

2. **Alternative Solutions:**
   - If these metrics are deprecated, what are the replacement metrics?
   - Should we use different API endpoints or methods to get this data?

3. **Code Fix:**
   - Provide the exact metric names to replace `page_impressions` and `page_fans`
   - Ensure the response structure matches what the frontend expects:
     ```javascript
     metrics: {
       impressions: Array<{ value: number; end_time: string }>,
       followers: Array<{ value: number; end_time: string }>
     }
     ```

## Frontend Expectations

The frontend expects:
- **Impressions:** Daily array of `{ value: number, end_time: string }` for charting
- **Followers:** Daily array of `{ value: number, end_time: string }` for charting (typically the last value is used for "Current Followers")

## Additional Context

- **Facebook API Version:** v19.0
- **Period:** `day` (daily granularity)
- **Date Range:** Custom (start/end dates)
- **Token Type:** Page Access Token (validated and working for other metrics)
- **Other metrics work fine**, so it's not a permissions or token issue

## Expected Output

Please provide:
1. The correct metric names for Facebook Graph API v19.0
2. Any required changes to the API call structure
3. Updated code snippet showing the fix
4. Explanation of why the old metric names are failing

Thank you!




