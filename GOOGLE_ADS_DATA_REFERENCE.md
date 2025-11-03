# Google Ads Data Extraction & Display Reference

## Data Being Extracted & Displayed 📊

### **Summary Metrics (Top KPI Cards)**

6 Main Metrics Displayed:
1. **Total Spend** 💰
   - `totalCost` - Total money spent on ads
   - Displayed as currency (e.g., $1,234.56)

2. **Total Clicks** 👆
   - `totalClicks` - Total number of times ads were clicked
   - Displayed as formatted number (e.g., 1,234)

3. **Total Impressions** 👁️
   - `totalImpressions` - Total times ads were shown
   - Displayed as formatted number (e.g., 12,345)

4. **Total Conversions** ✅
   - `totalConversions` - Total conversion actions completed
   - Displayed as formatted number (e.g., 50)

5. **CTR (Click-Through Rate)** 📈
   - `avgCtr` - Percentage of impressions that resulted in clicks
   - Calculated as: (clicks / impressions) × 100
   - Displayed as percentage (e.g., 3.45%)

6. **CPA (Cost Per Acquisition)** 💵
   - `avgCpa` - Average cost per conversion
   - Calculated as: total cost / total conversions
   - Displayed as currency (e.g., $25.50)

---

## AI-Generated Insights Cards 🤖

### Insight 1: Performance Overview
- Shows overall campaign performance summary
- Displays clicks, impressions, and total spend
- Explains performance trends

### Insight 2: Conversion Analysis  
- Shows conversion rate percentage
- Displays cost per acquisition
- Explains conversion performance quality

### Insight 3: Campaign Management Update
- Lists number of active campaigns
- Shows top performing campaign spend
- Provides next optimization date

---

## Performance Charts 📈

### Daily Performance Trends
Displays **daily data** over selected time period:
- **Spend per day** (blue bars)
- **Clicks per day** (green bars)
- **Date range** - Last 7 days, 30 days, or custom range
- Interactive chart showing trends

---

## Campaign Performance Table 🎯

For each campaign, displays:

### Campaign Information:
- **Campaign Name** - Name of the campaign
- **Campaign ID** - Internal Google Ads ID
- **Channel Type** - SEARCH, DISPLAY, VIDEO, SHOPPING, etc.

### Status Badge:
- 🟢 **ENABLED** (green) - Active and running
- 🟡 **PAUSED** (yellow) - Temporarily stopped
- 🔴 **REMOVED** (red) - Deleted
- ⚪ **UNKNOWN** (gray) - Other status

### Performance Metrics per Campaign:
1. **Spend** - Total money spent on this campaign
2. **Clicks** - Total clicks from this campaign
3. **Impressions** - Times this campaign was shown
4. **Conversions** - Conversions from this campaign
5. **CPA** - Cost per acquisition for this campaign

---

## API Data Structure

### Expected API Response Format:

```javascript
{
  summary: {
    totalCost: 1234.56,
    totalClicks: 1234,
    totalImpressions: 12345,
    totalConversions: 50,
    avgCtr: 0.10,  // 10% CTR
    avgCpa: 24.69
  },
  campaigns: [
    {
      campaignId: "123456789",
      campaignName: "Search Campaign - Brand Terms",
      status: "ENABLED",
      channelType: "SEARCH",
      cost: 567.89,
      clicks: 234,
      impressions: 5678,
      conversions: 12,
      cpa: 47.32,
      ctr: 4.12,
      averageCpc: 2.43
    }
  ],
  insights: {
    dailyPerformance: {
      "2024-01-01": {
        cost: 45.67,
        clicks: 12,
        impressions: 234,
        conversions: 2,
        conversionsValue: 100.00
      }
      // ... more dates
    }
  },
  accountInfo: {
    id: "customer_id",
    descriptive_name: "CliniMedia - Main Account",
    currency_code: "CAD",
    time_zone: "America/Toronto"
  }
}
```

---

## Google Ads API Queries (What to Implement) 🔧

When you re-implement, you'll need these GAQL queries:

### 1. Account Info Query:
```sql
SELECT 
  customer.id, 
  customer.descriptive_name, 
  customer.currency_code, 
  customer.time_zone
FROM customer
LIMIT 1
```

### 2. Daily Performance Metrics:
```sql
SELECT 
  segments.date, 
  metrics.impressions, 
  metrics.clicks, 
  metrics.cost_micros,
  metrics.conversions, 
  metrics.conversions_value
FROM customer
WHERE segments.date DURING LAST_30_DAYS
ORDER BY segments.date
```

### 3. Campaign Performance:
```sql
SELECT 
  campaign.id, 
  campaign.name, 
  campaign.status, 
  campaign.primary_status,
  campaign.advertising_channel_type,
  metrics.impressions, 
  metrics.clicks, 
  metrics.conversions, 
  metrics.cost_micros
FROM campaign
WHERE campaign.status IN ('ENABLED', 'PAUSED')
  AND segments.date DURING LAST_30_DAYS
ORDER BY metrics.cost_micros DESC
LIMIT 10
```

### 4. Account Hierarchy (for admin):
```sql
SELECT
  customer_client.client_customer,
  customer_client.descriptive_name,
  customer_client.level,
  customer_client.currency_code,
  customer_client.status
FROM customer_client
WHERE customer_client.level <= 1
ORDER BY customer_client.descriptive_name
```

---

## Data Calculations 📐

### CTR Calculation:
```javascript
const ctr = (totalClicks / totalImpressions) * 100
```

### CPA Calculation:
```javascript
const cpa = totalCost / totalConversions
```

### Cost Conversion:
```javascript
const cost = costMicros / 1_000_000  // Convert from micros
```

### Conversions Value:
Often tied to conversion actions (e.g., form submissions, phone calls)

---

## Date Range Options 📅

Users can select:
- **Last 7 days** - Recent performance
- **Last 30 days** - Monthly overview
- **Custom range** - Any date range they choose

This filters all metrics, charts, and campaign data.

---

## What's NOT Being Displayed (But Could Be Added) 🔮

### Additional Metrics Available:
- **Conversion Rate** - (conversions / clicks) × 100
- **Revenue** - Total revenue from conversions
- **ROAS** - Return on ad spend
- **Search Impression Share** - How often you show vs. eligible impressions
- **Quality Score** - Keyword performance rating
- **Average CPC** - Average cost per click
- **Average CPM** - Cost per 1,000 impressions
- **Video Views** - For video campaigns
- **Video Completion Rate** - Percentage who watched entire video

### Additional Campaign Details:
- **Ad Groups** - Breakdown within campaigns
- **Keywords** - Individual keyword performance
- **Ads** - Specific ad performance
- **Devices** - Performance by device (mobile, desktop, tablet)
- **Locations** - Performance by geographic area
- **Time of Day** - Performance by hour/day

---

## Current State 📝

**Frontend:** ✅ Ready and waiting for data
- Beautiful UI with charts and KPIs
- Error handling in place
- Date range selectors working

**Backend:** ❌ Need to implement
- Create simple endpoints
- Query Google Ads API
- Return data in expected format

---

**This is your blueprint for when you re-implement Google Ads! 🚀**

