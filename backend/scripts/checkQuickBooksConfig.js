/**
 * QuickBooks Configuration Checker
 * Run this script to verify QuickBooks OAuth configuration
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env'), override: true });

console.log('\n🔍 QuickBooks Configuration Check\n');
console.log('='.repeat(50));

// Check required environment variables
const requiredVars = {
  'QUICKBOOKS_CLIENT_ID': process.env.QUICKBOOKS_CLIENT_ID,
  'QUICKBOOKS_CLIENT_SECRET': process.env.QUICKBOOKS_CLIENT_SECRET,
};

console.log('\n📋 Required Environment Variables:');
let allSet = true;
for (const [key, value] of Object.entries(requiredVars)) {
  const isSet = value && value !== '';
  console.log(`  ${key}: ${isSet ? '✅ SET' : '❌ NOT SET'}`);
  if (!isSet) allSet = false;
}

// Check optional environment variables
console.log('\n📋 Optional Environment Variables:');
const optionalVars = {
  'QUICKBOOKS_REDIRECT_URI': process.env.QUICKBOOKS_REDIRECT_URI,
  'NODE_ENV': process.env.NODE_ENV,
  'RAILWAY_PUBLIC_DOMAIN': process.env.RAILWAY_PUBLIC_DOMAIN,
  'BACKEND_URL': process.env.BACKEND_URL,
};

for (const [key, value] of Object.entries(optionalVars)) {
  console.log(`  ${key}: ${value || 'NOT SET'}`);
}

// Calculate redirect URI (matches quickbooksService.js logic)
console.log('\n🔗 Redirect URI Calculation:');
let redirectUri;

// Priority: QUICKBOOKS_REDIRECT_URI > RAILWAY_PUBLIC_DOMAIN > BACKEND_URL > Production fallback
if (process.env.QUICKBOOKS_REDIRECT_URI) {
  // Highest priority: Use explicitly set redirect URI (e.g., ngrok URL)
  redirectUri = process.env.QUICKBOOKS_REDIRECT_URI;
  console.log('  ✅ Using QUICKBOOKS_REDIRECT_URI from environment');
} else {
  // Construct redirect URI from backend URL
  let backendUrl;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    backendUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
    console.log('  ✅ Using RAILWAY_PUBLIC_DOMAIN to construct redirect URI');
  } else if (process.env.BACKEND_URL) {
    backendUrl = process.env.BACKEND_URL;
    console.log('  ✅ Using BACKEND_URL to construct redirect URI');
  } else if (process.env.NODE_ENV === 'development') {
    // Use localhost only in development
    const backendPort = process.env.PORT || 5000;
    backendUrl = `http://localhost:${backendPort}`;
    console.log('  ✅ Using localhost (development mode)');
  } else {
    // Production fallback
    backendUrl = 'https://api.clinimediaportal.ca';
    console.log('  ✅ Using production fallback');
  }
  redirectUri = `${backendUrl}/api/quickbooks/callback`;
}

console.log(`\n✅ Final Redirect URI: ${redirectUri}`);

// Validation
console.log('\n✅ Validation:');
if (!allSet) {
  console.log('  ❌ Missing required environment variables!');
  process.exit(1);
}

if (!redirectUri || redirectUri === 'undefined') {
  console.log('  ❌ Redirect URI is undefined!');
  console.log('  💡 Please set QUICKBOOKS_REDIRECT_URI, BACKEND_URL, or RAILWAY_PUBLIC_DOMAIN');
  process.exit(1);
}

console.log('  ✅ All required variables are set');
console.log('\n📝 Next Steps:');
console.log('  1. Verify the redirect URI above matches EXACTLY what is configured in:');
console.log('     https://developer.intuit.com/app/developer/dashboard');
console.log('  2. The redirect URI must match character-for-character (including http/https, trailing slashes, etc.)');
console.log('  3. For local development, ensure you have added:');
console.log('     http://localhost:5000/api/quickbooks/callback');
console.log('     to your Intuit app\'s redirect URIs');
console.log('  4. For production, ensure you have added:');
console.log(`     ${redirectUri}`);
console.log('     to your Intuit app\'s redirect URIs');
console.log('\n' + '='.repeat(50) + '\n');

