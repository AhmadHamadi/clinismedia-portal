// Railway Storage Bucket S3 Client Configuration
const { S3Client } = require("@aws-sdk/client-s3");

// Only create S3 client if Railway Storage Bucket is configured
// This prevents errors when env vars are not set (local development)
let s3 = null;

if (process.env.AWS_S3_BUCKET_NAME && 
    process.env.AWS_ACCESS_KEY_ID && 
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_ENDPOINT_URL) {
  s3 = new S3Client({
    region: process.env.AWS_DEFAULT_REGION || 'auto',
    endpoint: process.env.AWS_ENDPOINT_URL,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    // Railway uses virtual-hosted-style URLs by default.
    // DO NOT set forcePathStyle: true unless debugging.
  });
}

module.exports = s3;

