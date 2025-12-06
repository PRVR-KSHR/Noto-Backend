import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import logger from '../utils/logger.js';
import filenService from './filenService.js';

// Initialize storage providers
let s3Client = null;

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

// Abstracted upload function - Routes to appropriate provider
export const uploadFile = async (file, folder = 'uploads') => {
  const provider = process.env.STORAGE_PROVIDER || 'filen';
  
  logger.info(`📦 Uploading with provider: ${provider}`);
  
  switch (provider) {
    case 'filen':
      try {
        return await uploadToFilen(file, folder);
      } catch (filenError) {
        logger.error('❌ Filen upload failed, attempting R2 fallback:', filenError.message);
        // Fallback to R2 if Filen fails
        if (process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
          return await uploadToR2(file, folder);
        }
        throw filenError; // Re-throw if no fallback available
      }
    case 'r2':
      return await uploadToR2(file, folder);
    default:
      throw new Error(`Invalid storage provider: ${provider}. Use 'filen' or 'r2'.`);
  }
};

// Filen.io upload
const uploadToFilen = async (file, folder) => {
  try {
    // Check if credentials are set
    if (!process.env.FILEN_EMAIL || !process.env.FILEN_PASSWORD) {
      const missingVars = [];
      if (!process.env.FILEN_EMAIL) missingVars.push('FILEN_EMAIL');
      if (!process.env.FILEN_PASSWORD) missingVars.push('FILEN_PASSWORD');
      
      const errorMsg = `Missing Filen credentials in environment: ${missingVars.join(', ')}. Set these in Render dashboard.`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

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
  const storageProvider = provider || process.env.STORAGE_PROVIDER || 'filen';
  
  switch (storageProvider) {
    case 'filen':
      return await deleteFromFilen(publicId);
    case 'r2':
      return await deleteFromR2(publicId);
    default:
      throw new Error(`Invalid storage provider: ${storageProvider}`);
  }
};

// Filen delete
const deleteFromFilen = async (fileUUID) => {
  try {
    await filenService.deleteFile(fileUUID);
    return { success: true };
  } catch (error) {
    logger.error('❌ Filen delete error:', error);
    return { success: false, error: error.message };
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
