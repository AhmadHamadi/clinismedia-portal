# Google Business Profile - 90-Day Fix with Batching

## Problem
- 7-day range: ✅ Works
- 30-day range: ✅ Works  
- 90-day range: ❌ Fails

## Solution: Intelligent Batching
Based on ChatGPT's recommendation to split long ranges into smaller batches.

### Implementation
- **Ranges ≤60 days**: Single API call (7, 30 days)
- **Ranges >60 days**: Split into 45-day batches (90 days = 2 requests)

### How It Works

1. **Calculate date range**: Determine if range is >60 days
2. **Split into batches**: 
   - Batch 1: Days 1-45
   - Batch 2: Days 46-90
3. **Fetch each batch**: Sequential requests with 500ms delay
4. **Merge results**: Combine all datedValues arrays
5. **Return merged data**: Same structure as single request

### Code Changes

**Files modified:**
- `backend/routes/googleBusiness.js`
  - `fetchBusinessInsightsData()` - Now handles batching
  - `fetchBusinessInsightsDataSingle()` - Handles single requests
  - `mergeBatchResults()` - Combines batch results

**What changed:**
```javascript
// OLD: Single request for all ranges
await fetchBusinessInsightsData(oauth2Client, locationName, startDate, endDate, accessToken);

// NEW: Automatically batches if range >60 days
// 7 days → 1 request
// 30 days → 1 request  
// 90 days → 2 requests (45 days each)
await fetchBusinessInsightsData(oauth2Client, locationName, startDate, endDate, accessToken);
```

### Benefits
✅ **Reliability**: Smaller requests are more stable
✅ **Rate limit friendly**: Spaced out requests
✅ **Same API**: Transparent to frontend
✅ **Error handling**: Can retry individual batches
✅ **Performance**: Parallel batching planned for future

### Testing
1. Try 90-day range in customer dashboard
2. Should see console logs: "📊 Range is 93 days, splitting into batches"
3. Should see: "📦 Fetching batch: 2025-07-27 to 2025-09-10"
4. Should see: "📊 Merged 2 batches into single response"

### Next Steps
- If still fails, check terminal for exact error
- Consider reducing batch size to 30 days (3 batches)
- Consider parallel batching for speed

