import axios from 'axios';
import FormData from 'form-data';

// ImageBB API configuration
const IMAGEBB_API_KEY = process.env.IMAGEBB_API_KEY;
const IMAGEBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

/**
 * Upload image to ImageBB
 * @param {Object} file - The file object from multer
 * @param {string} folder - Folder name (optional, for organization)
 * @returns {Object} Upload result with URL and delete URL
 */
export const uploadToImageBB = async (file, folder = 'events') => {
  try {
    if (!IMAGEBB_API_KEY) {
      throw new Error('ImageBB API key not configured');
    }

    if (!file || !file.buffer) {
      throw new Error('Invalid file provided');
    }

    // Create form data for ImageBB
    const formData = new FormData();
    formData.append('key', IMAGEBB_API_KEY);
    formData.append('image', file.buffer.toString('base64'));
    
    // Add name with folder prefix for organization
    const imageName = `${folder}_${Date.now()}_${file.originalname.split('.')[0]}`;
    formData.append('name', imageName);

    console.log('📤 Uploading image to ImageBB:', {
      name: imageName,
      size: file.size,
      type: file.mimetype
    });

    const response = await axios.post(IMAGEBB_UPLOAD_URL, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 30000, // 30 second timeout
    });

    if (response.data.success) {
      const result = {
        secure_url: response.data.data.url,
        public_id: response.data.data.delete_url, // Store delete URL as public_id
        url: response.data.data.url,
        display_url: response.data.data.display_url,
        delete_url: response.data.data.delete_url,
        id: response.data.data.id,
        title: response.data.data.title,
        url_viewer: response.data.data.url_viewer,
        thumb: response.data.data.thumb,
        medium: response.data.data.medium,
        size: response.data.data.size
      };

      console.log('✅ ImageBB upload successful:', {
        url: result.secure_url,
        id: result.id,
        size: result.size
      });

      return result;
    } else {
      throw new Error('ImageBB upload failed: ' + JSON.stringify(response.data));
    }
  } catch (error) {
    console.error('❌ ImageBB upload error:', error.response?.data || error.message);
    throw new Error('ImageBB upload failed: ' + (error.response?.data?.error?.message || error.message));
  }
};

/**
 * Delete image from ImageBB using delete URL
 * @param {string} deleteUrl - The delete URL returned during upload
 * @returns {Object} Deletion result
 */
export const deleteFromImageBB = async (deleteUrl) => {
  try {
    if (!deleteUrl) {
      console.warn('⚠️ No delete URL provided for ImageBB deletion');
      return { success: true }; // Consider successful since there's nothing to delete
    }

    console.log('🗑️ Attempting to delete from ImageBB:', {
      deleteUrl: deleteUrl.substring(0, 50) + '...', // Log partial URL for privacy
      isValidUrl: deleteUrl.startsWith('https://ibb.co/'),
    });

    // Validate delete URL format
    if (!deleteUrl.startsWith('https://ibb.co/')) {
      console.warn('⚠️ Invalid ImageBB delete URL format:', deleteUrl);
      throw new Error('Invalid ImageBB delete URL format');
    }

    // ImageBB delete URLs are direct delete endpoints, just make a request to them
    const response = await axios.get(deleteUrl, {
      timeout: 15000, // 15 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    console.log('✅ ImageBB deletion successful:', {
      status: response.status,
      message: 'Image deleted from ImageBB',
    });
    
    return { success: true, message: 'Image deleted successfully' };
  } catch (error) {
    // Log the error details for debugging
    console.error('❌ ImageBB deletion error details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: deleteUrl ? deleteUrl.substring(0, 50) + '...' : 'undefined',
    });

    // ImageBB delete URLs sometimes expire or may already be deleted
    // Don't fail the entire operation for image deletion issues
    if (error.response?.status === 404) {
      console.warn('⚠️ Image already deleted or not found on ImageBB');
      return { success: true, message: 'Image not found (may already be deleted)' };
    }

    // For other errors, log but don't fail the operation
    console.warn('⚠️ ImageBB deletion failed, but continuing operation:', error.message);
    throw new Error(`ImageBB deletion failed: ${error.message}`);
  }
};

/**
 * Upload file to ImageBB (main export function)
 * @param {Object} file - The file object from multer
 * @param {string} folder - Folder name for organization
 * @returns {Object} Upload result
 */
export const uploadFile = async (file, folder = 'uploads') => {
  return await uploadToImageBB(file, folder);
};

/**
 * Delete file from ImageBB (main export function)
 * @param {string} publicId - The delete URL (stored as publicId)
 * @returns {Object} Deletion result
 */
export const deleteFile = async (publicId) => {
  return await deleteFromImageBB(publicId);
};