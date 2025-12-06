import axios from 'axios';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

const FILEN_API_BASE = 'https://api.filen.io';
const UPLOAD_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

class FilenService {
  constructor() {
    this.email = process.env.FILEN_EMAIL;
    this.password = process.env.FILEN_PASSWORD;
    this.masterKeys = null;
    this.authToken = null;
    this.isInitialized = false;
  }

  /**
   * Initialize Filen service by logging in and getting auth token
   */
  async initialize() {
    if (this.isInitialized && this.authToken) {
      return;
    }

    try {
      logger.info('🔐 Initializing Filen.io service...');

      if (!this.email || !this.password) {
        throw new Error('FILEN_EMAIL and FILEN_PASSWORD environment variables are required');
      }

      const response = await axios.post(`${FILEN_API_BASE}/v3/auth/login`, {
        email: this.email,
        password: this.password,
      });

      if (!response.data.status) {
        throw new Error(`Filen login failed: ${response.data.message}`);
      }

      this.authToken = response.data.data.authToken;
      this.masterKeys = response.data.data.masterKeys;
      this.isInitialized = true;

      logger.info('✅ Filen.io initialized successfully');
    } catch (error) {
      logger.error('❌ Filen initialization failed:', error.message);
      throw new Error('Filen initialization failed: ' + error.message);
    }
  }

  /**
   * Upload file to Filen.io
   * @param {Object} file - Multer file object
   * @param {String} folder - Folder name in Filen (e.g., 'noto/notes')
   * @returns {Promise<Object>} Upload result with fileUrl and metadata
   */
  async uploadFile(file, folder = 'uploads') {
    try {
      await this.initialize();

      logger.info('📤 Uploading to Filen.io:', {
        originalName: file.originalname,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        folder: folder
      });

      // Read file from disk
      const fileBuffer = fs.readFileSync(file.path);
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}_${file.originalname}`;

      // Create parent folder path
      const folderPath = `/noto/${folder}`;

      // Step 1: Get folder UUID
      const folderUUID = await this.getOrCreateFolder(folderPath);

      // Step 2: Upload file chunks
      const uploadKey = await this.uploadFileChunks(
        fileBuffer,
        fileName,
        folderUUID,
        file.mimetype
      );

      logger.info('✅ Filen.io upload successful:', {
        fileName: file.originalname,
        key: uploadKey,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
      });

      // Construct file URL (Filen shares or direct access)
      const fileUrl = `${FILEN_API_BASE}/v3/download?fileUUID=${uploadKey}`;

      return {
        fileUrl: fileUrl,
        publicId: uploadKey, // Store UUID as publicId for later deletion
        provider: 'filen',
        fileSize: file.size,
        fileName: file.originalname
      };
    } catch (error) {
      logger.error('❌ Filen upload failed:', error.message);
      throw new Error('Filen upload failed: ' + error.message);
    }
  }

  /**
   * Get or create folder in Filen
   * @private
   */
  async getOrCreateFolder(folderPath) {
    try {
      // For MVP, we'll use a default folder UUID
      // In production, implement proper folder hierarchy management
      const response = await axios.post(
        `${FILEN_API_BASE}/v3/dir/create`,
        {
          name: 'noto_uploads',
          parent: '/'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.authToken}`
          }
        }
      );

      if (!response.data.status) {
        throw new Error(`Folder creation failed: ${response.data.message}`);
      }

      return response.data.data.uuid;
    } catch (error) {
      // If folder already exists, continue
      logger.warn('⚠️ Folder operation warning:', error.message);
      return null;
    }
  }

  /**
   * Upload file in chunks to Filen
   * @private
   */
  async uploadFileChunks(fileBuffer, fileName, folderUUID, mimeType) {
    try {
      const totalChunks = Math.ceil(fileBuffer.length / UPLOAD_CHUNK_SIZE);

      logger.info(`📦 Uploading ${totalChunks} chunks...`);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * UPLOAD_CHUNK_SIZE;
        const end = Math.min(start + UPLOAD_CHUNK_SIZE, fileBuffer.length);
        const chunk = fileBuffer.slice(start, end);

        await this.uploadChunk(chunk, fileName, i, totalChunks, mimeType);

        logger.info(`✅ Chunk ${i + 1}/${totalChunks} uploaded`);
      }

      // Finalize upload
      const response = await axios.post(
        `${FILEN_API_BASE}/v3/upload/done`,
        {
          fileUUIDs: [fileName],
          parent: folderUUID || '/'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.authToken}`
          }
        }
      );

      if (!response.data.status) {
        throw new Error(`Upload finalization failed: ${response.data.message}`);
      }

      return response.data.data.fileUUID || fileName;
    } catch (error) {
      throw new Error('File chunk upload failed: ' + error.message);
    }
  }

  /**
   * Upload a single chunk
   * @private
   */
  async uploadChunk(chunk, fileName, chunkIndex, totalChunks, mimeType) {
    try {
      const formData = new FormData();
      const blob = new Blob([chunk], { type: mimeType });

      formData.append('file', blob);
      formData.append('filename', fileName);
      formData.append('chunkIndex', chunkIndex.toString());
      formData.append('totalChunks', totalChunks.toString());

      const response = await axios.post(
        `${FILEN_API_BASE}/v3/upload`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (!response.data.status) {
        throw new Error(`Chunk upload failed: ${response.data.message}`);
      }

      return response.data.data;
    } catch (error) {
      throw new Error(`Chunk ${chunkIndex} upload failed: ` + error.message);
    }
  }

  /**
   * Delete file from Filen
   * @param {String} fileUUID - File UUID to delete
   */
  async deleteFile(fileUUID) {
    try {
      if (!fileUUID) {
        logger.warn('⚠️ No fileUUID provided for deletion');
        return;
      }

      await this.initialize();

      logger.info('🗑️ Deleting from Filen.io:', fileUUID);

      const response = await axios.post(
        `${FILEN_API_BASE}/v3/file/delete`,
        {
          fileUUID: fileUUID
        },
        {
          headers: {
            'Authorization': `Bearer ${this.authToken}`
          }
        }
      );

      if (!response.data.status) {
        throw new Error(`File deletion failed: ${response.data.message}`);
      }

      logger.info('✅ File deleted from Filen.io');
    } catch (error) {
      logger.error('❌ Filen deletion failed:', error.message);
      // Don't throw - continue operation even if deletion fails
    }
  }

  /**
   * Get file info from Filen
   * @param {String} fileUUID - File UUID
   */
  async getFileInfo(fileUUID) {
    try {
      await this.initialize();

      const response = await axios.post(
        `${FILEN_API_BASE}/v3/file/info`,
        {
          fileUUID: fileUUID
        },
        {
          headers: {
            'Authorization': `Bearer ${this.authToken}`
          }
        }
      );

      if (!response.data.status) {
        throw new Error(`Get file info failed: ${response.data.message}`);
      }

      return response.data.data;
    } catch (error) {
      logger.error('❌ Failed to get file info:', error.message);
      return null;
    }
  }

  /**
   * Health check - verify Filen connection
   */
  async healthCheck() {
    try {
      await this.initialize();
      return {
        status: 'connected',
        provider: 'filen',
        authenticated: !!this.authToken
      };
    } catch (error) {
      return {
        status: 'disconnected',
        provider: 'filen',
        error: error.message
      };
    }
  }
}

// Export singleton instance
export default new FilenService();
