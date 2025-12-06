import { v2 as cloudinary } from 'cloudinary';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import logger from '../utils/logger.js';
import filenService from './filenService.js';

// Initialize storage providers
let cloudinaryConfigured = false;
let s3Client = null;

// Configure Cloudinary
const configureCloudinary = () => {
  if (!cloudinaryConfigured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    cloudinaryConfigured = true;
  }
};

// Configure R2 (Future use)
const configureR2 = () => {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
};

// Abstracted upload function
export const uploadFile = async (file, folder = 'uploads') => {
  const provider = process.env.STORAGE_PROVIDER || 'cloudinary';
  switch (provider) {
    case 'filen':
      return await uploadToFilen(file, folder);
    case 'cloudinary':
      return await uploadToCloudinary(file, folder);
    case 'r2':
      return await uploadToR2(file, folder);
    default:
      throw new Error('Invalid storage provider');
  }
};

// ✅ FIXED: Cloudinary upload with proper extension handling
const uploadToFilen = async (file, folder) => {
  try {
    const result = await filenService.uploadFile(file, folder);
    
    return {
      fileUrl: result.fileUrl,
      publicId: result.publicId,
      provider: 'filen'
    };
  } catch (error) {
    throw new Error('Filen upload failed: ' + error.message);
  }
};

const uploadToCloudinary = async (file, folder) => {
  try {
    configureCloudinary();

    // ✅ CRITICAL: Extract file extension from original filename
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    const timestamp = Date.now();
    const uniqueId = uuidv4();

    // ✅ CRITICAL: Include extension in public_id for raw files
    const publicIdWithExtension = `${timestamp}_${uniqueId}.${fileExtension}`;

    logger.info('📁 Uploading file:', {
      originalName: file.originalname,
      extension: fileExtension,
      publicId: publicIdWithExtension,
      folder: `noto/${folder}`,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
    });

    // ✅ OPTIMIZED: Use upload_large for better performance with chunked upload
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder: `noto/${folder}`,
        resource_type: 'raw', // ✅ CRITICAL: Use 'raw' for documents
        public_id: publicIdWithExtension, // ✅ CRITICAL: Include extension
        use_filename: false, // ✅ We're setting public_id explicitly
        unique_filename: false, // ✅ We're handling uniqueness ourselves
        // ✅ CRITICAL: Make files publicly accessible
        type: 'upload',
        access_mode: 'public',
        // ✅ OPTIMIZED: Use chunked upload with larger chunk size for speed
        chunk_size: 10000000 // 10MB chunks for faster upload
      };

      // ✅ OPTIMIZED: Use upload_large for files > 5MB, regular upload for smaller files
      const uploadMethod = file.size > 5 * 1024 * 1024 
        ? cloudinary.uploader.upload_large 
        : cloudinary.uploader.upload;

      uploadMethod(file.path, uploadOptions, (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload error:', error);
          reject(new Error('Cloudinary upload failed: ' + error.message));
        } else {
          logger.info('✅ Cloudinary upload successful:', {
            publicId: result.public_id,
            secureUrl: result.secure_url,
            format: result.format,
            resourceType: result.resource_type,
            size: `${(result.bytes / 1024 / 1024).toFixed(2)} MB`
          });

          // ✅ Generate optimized URLs for different use cases
          const baseUrl = result.secure_url;
          const publicId = result.public_id;
          
          // Generate thumbnail URL (for preview/listing pages) - significantly reduces bandwidth
          const thumbnailUrl = cloudinary.url(publicId, {
            resource_type: 'raw',
            format: 'jpg', // Convert first page to JPG
            page: 1, // Only first page for preview
            quality: 'auto:low', // Automatic quality optimization
            fetch_format: 'auto', // Automatic format selection
          });

          resolve({
            fileUrl: baseUrl, // Original file URL (for download)
            thumbnailUrl: thumbnailUrl, // Optimized preview URL
            publicId: result.public_id,
            provider: 'cloudinary'
          });
        }
      });
    });

  } catch (error) {
    throw new Error('Cloudinary upload failed: ' + error.message);
  }
};



// R2 upload implementation (Future)
const uploadToR2 = async (file, folder) => {
  try {
    configureR2();
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${folder}/${Date.now()}_${uuidv4()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        originalName: file.originalname,
        uploadedAt: new Date().toISOString()
      }
    });

    await s3Client.send(command);

    // R2 public URL format
    const fileUrl = `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev/${fileName}`;
    
    return {
      fileUrl,
      publicId: fileName,
      provider: 'r2'
    };
  } catch (error) {
    throw new Error('R2 upload failed: ' + error.message);
  }
};

// Abstracted delete function
export const deleteFile = async (publicId, provider = null) => {
  const storageProvider = provider || process.env.STORAGE_PROVIDER || 'cloudinary';
  switch (storageProvider) {
    case 'filen':
      return await deleteFromFilen(publicId);
    case 'cloudinary':
      return await deleteFromCloudinary(publicId);
    case 'r2':
      return await deleteFromR2(publicId);
    default:
      throw new Error('Invalid storage provider for deletion');
  }
};

// ✅ NEW: Filen delete
const deleteFromFilen = async (fileUUID) => {
  try {
    await filenService.deleteFile(fileUUID);
    return { success: true };
  } catch (error) {
    logger.error('❌ Filen delete error:', error);
    // Don't throw - continue operation
    return { success: false, error: error.message };
  }
};

// ✅ FIXED: Cloudinary delete with correct resource_type
const deleteFromCloudinary = async (publicId) => {
  try {
    configureCloudinary();
    
    console.log('🗑️ Attempting to delete from Cloudinary:', publicId);
    
    // ✅ CRITICAL: Add resource_type: 'raw' for non-image files
    const result = await cloudinary.uploader.destroy(publicId, { 
      resource_type: 'raw',
      invalidate: true  // Clear CDN cache
    });
    
    console.log('🗑️ Cloudinary delete result:', result);
    
    // Handle different result types
    if (result.result === 'ok') {
      console.log('✅ File successfully deleted from Cloudinary');
      return { success: true };
    } else if (result.result === 'not found') {
      console.warn('⚠️ File not found in Cloudinary (may already be deleted):', publicId);
      return { success: true }; // Consider successful since file doesn't exist
    } else {
      throw new Error(`Cloudinary deletion failed with result: ${result.result}`);
    }
  } catch (error) {
    logger.error('❌ Cloudinary delete error:', error);
    throw new Error('Cloudinary delete failed: ' + error.message);
  }
};

const deleteFromR2 = async (fileName) => {
  try {
    configureR2();
    const command = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
    });

    await s3Client.send(command);
    return { success: true };
  } catch (error) {
    throw new Error('R2 delete failed: ' + error.message);
  }
};
