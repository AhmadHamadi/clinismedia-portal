# Question for ChatGPT: Google Business Profile Data Availability

## Question
Can we retrieve Google Business Profile performance data for more than 30 days? What are the limits and best practices?

## Current Implementation

We're using the **Business Profile Performance API** to extract data for our customer dashboard. Here's how we're currently doing it:

### API Endpoint
```
POST https://businessprofileperformance.googleapis.com/v1/locations/{location_id}:fetchMultiDailyMetricsTimeSeries
```

### Metrics We Extract
1. `BUSINESS_IMPRESSIONS_DESKTOP_MAPS`
2. `BUSINESS_IMPRESSIONS_MOBILE_MAPS`
3. `BUSINESS_IMPRESSIONS_DESKTOP_SEARCH`
4. `BUSINESS_IMPRESSIONS_MOBILE_SEARCH`
5. `WEBSITE_CLICKS`
6. `CALL_CLICKS`
7. `BUSINESS_DIRECTION_REQUESTS`

### Current Date Range Implementation

We support multiple date ranges:
- **7 days**: Last 7 days of data
- **30 days**: Last 30 days of data (default)
- **90 days**: Last 90 days of data
- **Custom**: User-selected date range

**Key Details:**
- We apply a **3-day buffer** because Google Business Profile data is delayed
- The buffer ensures we don't request incomplete recent data
- Example: For "last 30 days", we request from 33 days ago to 3 days ago

**Code Logic:**
```javascript
const today = new Date();
const bufferDays = 3; // Google data delay

// For 30-day range:
const totalDays = 30 + bufferDays; // Request 33 days of data
const startDate = new Date(today.getTime() - totalDays * 24 * 60 * 60 * 1000);
const endDate = new Date(today.getTime() - bufferDays * 24 * 60 * 60 * 1000);
```

### Request Format

```javascript
const params = new URLSearchParams();
params.append('dailyMetrics', 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS');
params.append('dailyMetrics', 'BUSINESS_IMPRESSIONS_MOBILE_MAPS');
// ... more metrics
params.append('dailyRange.start_date.year', startYear);
params.append('dailyRange.start_date.month', startMonth);
params.append('dailyRange.start_date.day', startDay);
params.append('dailyRange.end_date.year', endYear);
params.append('dailyRange.end_date.month', endMonth);
params.append('dailyRange.end_date.day', endDay);

await axios.get(`https://businessprofileperformance.googleapis.com/v1/locations/${locationId}:fetchMultiDailyMetricsTimeSeries`, {
  headers: { 'Authorization': `Bearer ${accessToken}` },
  params,
  paramsSerializer: p => p.toString()
});
```

### Response Structure

We parse this response format:
```json
{
  "multiDailyMetricTimeSeries": [
    {
      "dailyMetric": "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
      "timeSeries": {
        "datedValues": [
          {
            "date": { "year": 2025, "month": 9, "day": 23 },
            "value": 11
          }
        ]
      }
    }
  ]
}
```

### Data Extraction Process

1. **Fetch metrics** using `fetchMultiDailyMetricsTimeSeries` with multi-metric support
2. **Parse nested structure**: `multiDailyMetricTimeSeries[].dailyMetricTimeSeries[]`
3. **Aggregate daily data** by date and metric type
4. **Calculate totals** for views, searches, calls, directions, website clicks
5. **Store in MongoDB** for caching and performance

### 🚨 CURRENT ISSUE

When we try to fetch data for **90 days**, we get an error. The 7-day and 30-day ranges work perfectly, but 90 days fails.

**Question**: What's the actual limit for date ranges in a single request? Is there a specific limit (like 60 days, 90 days) that causes the API to reject longer ranges?

### Questions for ChatGPT

1. **Maximum Range**: What's the maximum date range we can request in a single API call? Is there a hard limit (e.g., 60 days, 90 days)?

2. **Batching Strategy**: For ranges beyond the limit, should we split into multiple requests (e.g., 90 days = 3 requests of 30 days each)?

3. **API Limits**: Are there any rate limits or data volume limits we should be aware of?

4. **Historical Data**: How far back does Google store Business Profile performance data? Can we get historical data from months/years ago?

5. **Best Practices**: 
   - Should we make multiple API calls for longer ranges?
   - Any recommendations for handling large date ranges?
   - Should we paginate or batch requests for long periods?

6. **Performance**: What's the best way to extract historical data without hitting rate limits or timeout issues?

7. **Data Freshness**: The 3-day buffer we use - is this correct, or does it vary by metric type?

### Current GET Method That Works for 7/30 Days

```javascript
const params = new URLSearchParams();
metrics.forEach(metric => params.append('dailyMetrics', metric));
params.append('dailyRange.start_date.year', startYear);
params.append('dailyRange.start_date.month', startMonth);
params.append('dailyRange.start_date.day', startDay);
params.append('dailyRange.end_date.year', endYear);
params.append('dailyRange.end_date.month', endMonth);
params.append('dailyRange.end_date.day', endDay);

await axios.get(
  `https://businessprofileperformance.googleapis.com/v1/locations/${locationId}:fetchMultiDailyMetricsTimeSeries`,
  {
    headers: { 'Authorization': `Bearer ${accessToken}` },
    params,
    paramsSerializer: p => p.toString()
  }
);
```

**What works:**
- 7 days ✅
- 30 days ✅
- 90 days ❌ (fails with error)

**What specific error message would help you diagnose this?** (We can provide the exact error if needed)

Thank you!

