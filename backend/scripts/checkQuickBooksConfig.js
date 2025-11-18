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

if (process.env.NODE_ENV === 'development') {
  redirectUri = 'http://localhost:5000/api/quickbooks/callback';
  console.log('  Using development mode (hardcoded): http://localhost:5000/api/quickbooks/callback');
} else {
  // Production: Hardcoded to production API URL
  redirectUri = 'https://api.clinimediaportal.ca/api/quickbooks/callback';
  console.log('  Using production mode (hardcoded): https://api.clinimediaportal.ca/api/quickbooks/callback');
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
  console.log('  💡 This should not happen - redirect URI is hardcoded in the service');
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

