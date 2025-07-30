require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('🔍 Checking production setup for file serving...');

// Check if uploads directories exist
const uploadsDir = path.join(__dirname, '../uploads');
const invoicesDir = path.join(__dirname, '../uploads/invoices');
const instagramDir = path.join(__dirname, '../uploads/instagram-insights');

console.log('\n📁 Directory Status:');
console.log(`Uploads directory: ${fs.existsSync(uploadsDir) ? '✅ Exists' : '❌ Missing'}`);
console.log(`Invoices directory: ${fs.existsSync(invoicesDir) ? '✅ Exists' : '❌ Missing'}`);
console.log(`Instagram directory: ${fs.existsSync(instagramDir) ? '✅ Exists' : '❌ Missing'}`);

// List files in invoices directory
if (fs.existsSync(invoicesDir)) {
  const files = fs.readdirSync(invoicesDir);
  console.log(`\n📄 Invoice files (${files.length}):`);
  files.forEach(file => {
    const filePath = path.join(invoicesDir, file);
    const stats = fs.statSync(filePath);
    console.log(`- ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
  });
}

// Check environment variables
console.log('\n🌐 Environment Variables:');
console.log(`PORT: ${process.env.PORT || 'Not set (will use 3000)'}`);
console.log(`MONGODB_URI: ${process.env.MONGODB_URI ? '✅ Set' : '❌ Not set'}`);
console.log(`FRONTEND_URL: ${process.env.FRONTEND_URL || '❌ Not set'}`);

console.log('\n✅ Production setup check complete!'); 