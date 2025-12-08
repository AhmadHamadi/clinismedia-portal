const path = require("path");
const fs = require("fs/promises");
const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const s3Client = require("../config/s3Client");

const BUCKET = process.env.AWS_S3_BUCKET_NAME;

/**
 * Storage Service - Handles file storage
 * - Production: Uses Railway Storage Buckets (S3-compatible) with presigned URLs
 * - Development: Uses local filesystem
 */
class StorageService {
  constructor() {
    // Check if Railway Storage Bucket is configured
    this.useS3 = !!(BUCKET && 
                   process.env.AWS_ACCESS_KEY_ID && 
                   process.env.AWS_SECRET_ACCESS_KEY &&
                   process.env.AWS_ENDPOINT_URL);
    
    if (this.useS3) {
      console.log('✅ Storage Service: Using Railway Storage Bucket for persistent storage');
      console.log(`   Bucket: ${BUCKET}, Endpoint: ${process.env.AWS_ENDPOINT_URL}`);
    } else {
      console.log('⚠️  Storage Service: Using local filesystem (files will be lost on server restart)');
      console.log('   To enable persistent storage: Add Railway Storage Bucket and set AWS_* env vars');
    }
  }

  /**
   * Upload Instagram Insights image to Railway Storage Bucket
   * @param {string} localPath - Local file path (from multer)
   * @param {string} originalName - Original filename
   * @param {string} mimeType - File MIME type
   * @param {string} clinicId - Optional clinic ID for organization
   * @returns {Promise<{key: string}>} - Object key in bucket
   */
  async uploadInstagramImage(localPath, originalName, mimeType, clinicId = null) {
    if (!this.useS3) {
      // Local storage fallback - file is already saved by multer
      // Return the actual path where multer saved it
      const filename = path.basename(localPath);
      // Multer saves to: ../uploads/instagram-insights/${filename}
      // Return path relative to server root
      return { key: `/uploads/instagram-insights/${filename}` };
    }

    const ext = path.extname(originalName) || ".jpg";
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const key = clinicId
      ? `uploads/instagram-insights/${clinicId}/${filename}`
      : `uploads/instagram-insights/${filename}`;

    const fileBuffer = await fs.readFile(localPath);

    if (!s3Client) {
      throw new Error('S3 client not initialized. Check Railway Storage Bucket configuration.');
    }

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
      })
    );

    // Delete local temp file
    try { 
      await fs.unlink(localPath); 
    } catch (_) {
      // Ignore errors - file might already be deleted
    }

    return { key };
  }

  /**
   * Delete image from storage
   * @param {string} key - Object key or local path
   */
  async deleteImage(key) {
    if (!key) return;

    // If it's a local path, delete from filesystem
    if (key.startsWith('/uploads/')) {
      try {
        const filePath = path.join(__dirname, '..', key);
        await fs.unlink(filePath);
        console.log(`✅ File deleted from local: ${key}`);
      } catch (error) {
        console.warn('⚠️  Could not delete local file:', error);
      }
      return;
    }

    // Delete from Railway Storage Bucket
    if (this.useS3) {
      try {
        if (!s3Client) {
          console.warn('⚠️  S3 client not initialized, cannot delete from Railway Bucket');
          return;
        }
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: BUCKET,
            Key: key,
          })
        );
        console.log(`✅ File deleted from Railway Storage Bucket: ${key}`);
      } catch (error) {
        console.error('❌ Error deleting from Railway Storage Bucket:', error);
        // Don't throw - file might not exist
      }
    }
  }

  /**
   * Get presigned URL for image (Railway Bucket) or direct path (local)
   * @param {string} key - Object key or local path
   * @param {number} expiresIn - URL expiration in seconds (default 1 hour)
   * @returns {Promise<string>} - Presigned URL or local path
   */
  async getImageUrl(key, expiresIn = 3600) {
    // If it's a local path, return direct URL
    if (key.startsWith('/uploads/')) {
      return key; // Frontend will construct full URL
    }

    // Get presigned URL from Railway Storage Bucket
    if (this.useS3) {
      try {
        if (!s3Client) {
          throw new Error('S3 client not initialized. Check Railway Storage Bucket configuration.');
        }
        return await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: BUCKET,
            Key: key,
          }),
          { expiresIn }
        );
      } catch (error) {
        console.error('❌ Error generating presigned URL:', error);
        throw new Error('Failed to generate image URL');
      }
    }

    return key;
  }

  /**
   * Check if a file exists
   * @param {string} key - Object key or local path
   * @returns {Promise<boolean>}
   */
  async fileExists(key) {
    // Check local filesystem
    if (key.startsWith('/uploads/')) {
      try {
        const filePath = path.join(__dirname, '..', key);
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    }

    // Check Railway Storage Bucket
    if (this.useS3) {
      try {
        if (!s3Client) {
          return false;
        }
        await s3Client.send(
          new GetObjectCommand({
            Bucket: BUCKET,
            Key: key,
          })
        );
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Get file stream (for proxy route if needed)
   * @param {string} key - Object key
   * @returns {Promise<Stream>} - File stream
   */
  async getFileStream(key) {
    if (!this.useS3) {
      throw new Error('getFileStream only works with Railway Storage Bucket');
    }

    if (!s3Client) {
      throw new Error('S3 client not initialized. Check Railway Storage Bucket configuration.');
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    const response = await s3Client.send(command);
    return response.Body;
  }
}

// Export singleton instance
module.exports = new StorageService();
