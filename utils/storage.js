// Storage abstraction for easy provider switching
export class StorageInterface {
  async uploadFile(file, fileName) {
    throw new Error('uploadFile must be implemented');
  }
  
  async getFileUrl(fileId) {
    throw new Error('getFileUrl must be implemented');
  }
  
  async deleteFile(fileId) {
    throw new Error('deleteFile must be implemented');
  }
}

// MEGA Storage Implementation
import { Storage } from 'megajs';

export class MegaStorage extends StorageInterface {
  constructor() {
    super();
    this.storage = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) return this.storage;

    try {
      console.log('🔌 Connecting to MEGA...');
      
      this.storage = await new Storage({
        email: process.env.MEGA_EMAIL,
        password: process.env.MEGA_PASSWORD,
        keepalive: false,
        autologin: true,
        autoload: true
      }).ready;

      this.isConnected = true;
      console.log('✅ Connected to MEGA successfully');
      return this.storage;
    } catch (error) {
      console.error('❌ MEGA connection failed:', error);
      throw new Error('Failed to connect to MEGA: ' + error.message);
    }
  }

  async uploadFile(file, fileName) {
    try {
      await this.connect();
      
      console.log('📤 Uploading to MEGA:', fileName);
      
      // Create NOTO folder if it doesn't exist
      let notoFolder = this.storage.root.children.find(child => child.name === 'NOTO');
      if (!notoFolder) {
        notoFolder = await this.storage.mkdir('NOTO');
        console.log('📁 Created NOTO folder');
      }

      // Upload file to NOTO folder
      const uploadedFile = await notoFolder.upload(fileName, file.buffer).complete;
      
      // Generate public link
      const link = await uploadedFile.link();
      
      console.log('✅ File uploaded to MEGA:', fileName);
      
      return {
        fileId: uploadedFile.nodeId,
        publicUrl: link,
        size: file.size,
        type: file.mimetype
      };
      
    } catch (error) {
      console.error('❌ MEGA upload failed:', error);
      throw new Error('MEGA upload failed: ' + error.message);
    }
  }

  async getFileUrl(fileId) {
    try {
      await this.connect();
      const file = this.storage.root.find(node => node.nodeId === fileId);
      if (!file) throw new Error('File not found');
      return await file.link();
    } catch (error) {
      throw new Error('Failed to get file URL: ' + error.message);
    }
  }

  async deleteFile(fileId) {
    try {
      await this.connect();
      const file = this.storage.root.find(node => node.nodeId === fileId);
      if (file) {
        await file.delete();
        return true;
      }
      return false;
    } catch (error) {
      throw new Error('Failed to delete file: ' + error.message);
    }
  }
}

// Future: Cloudflare R2 Implementation (Ready for migration)
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export class R2Storage extends StorageInterface {
  constructor() {
    super();
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  async uploadFile(file, fileName) {
    try {
      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: `noto/${fileName}`,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      });

      await this.client.send(command);
      
      const publicUrl = `https://${process.env.R2_PUBLIC_URL}/noto/${fileName}`;
      
      return {
        fileId: fileName,
        publicUrl,
        size: file.size,
        type: file.mimetype
      };
    } catch (error) {
      throw new Error('R2 upload failed: ' + error.message);
    }
  }

  async getFileUrl(fileId) {
    return `https://${process.env.R2_PUBLIC_URL}/noto/${fileId}`;
  }

  async deleteFile(fileId) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: `noto/${fileId}`,
      });
      await this.client.send(command);
      return true;
    } catch (error) {
      throw new Error('Failed to delete file: ' + error.message);
    }
  }
}

// Storage Factory - Switch providers easily
export function createStorage() {
  const provider = process.env.STORAGE_PROVIDER || 'mega';
  
  switch (provider.toLowerCase()) {
    case 'mega':
      return new MegaStorage();
    case 'r2':
      return new R2Storage();
    default:
      throw new Error('Unknown storage provider: ' + provider);
  }
}
