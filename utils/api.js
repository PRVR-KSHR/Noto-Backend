import axios from 'axios';
import { auth } from '../firebase/config';

const API_BASE_URL = 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    const user = auth.currentUser;
    if (user) {
      try {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        console.error('Error getting ID token:', error);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.request.use(
  async (config) => {
    const user = auth.currentUser;
    if (user) {
      try {
        const token = await user.getIdToken(true); // Force refresh for fresh token
        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        console.error('Error getting ID token:', error);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);


// Auth API calls
export const authAPI = {
  googleLogin: async (idToken) => {
    const response = await api.post('/auth/google', { idToken });
    return response.data;
  },
  
  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },
  
  updateProfile: async (profileData) => {
    const response = await api.put('/auth/profile', profileData);
    return response.data;
  },
  
  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  }
};

// File API calls
export const fileAPI = {
  uploadFile: async (formData) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    const token = await user.getIdToken(true);
    
    const response = await axios.post(`${API_BASE_URL}/files/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${token}`
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        console.log(`Upload Progress: ${percentCompleted}%`);
      }
    });
    return response.data;
  },
  
  getFiles: async (params = {}) => {
    const response = await api.get('/files', { params });
    return response.data;
  },
  
  downloadFile: async (fileId) => {
    const response = await api.get(`/files/download/${fileId}`);
    return response.data;
  }
};

// Add this new section to your existing api.js file

// ✅ NEW: Admin API calls
export const adminAPI = {
  // Check if current user is admin
  checkAccess: async () => {
    const response = await api.get('/admin/check-access');
    return response.data;
  },

  // Get all donations (admin only)
  getDonations: async (params = {}) => {
    const response = await api.get('/admin/donations', { params });
    return response.data;
  },

  // Add new donation (admin only)
  addDonation: async (donationData) => {
    const response = await api.post('/admin/donations', donationData);
    return response.data;
  },

  // Update donation (admin only)
  updateDonation: async (donationId, donationData) => {
    const response = await api.put(`/admin/donations/${donationId}`, donationData);
    return response.data;
  },

  // Delete donation (admin only)
  deleteDonation: async (donationId) => {
    const response = await api.delete(`/admin/donations/${donationId}`);
    return response.data;
  },

  // Get donation statistics (admin only)
  getDonationStats: async () => {
    const response = await api.get('/admin/donations/stats');
    return response.data;
  }
};

// ✅ NEW: Public Donation API calls
export const donationAPI = {
  // Get all active donations (for marquee)
  getDonations: async () => {
    const response = await api.get('/donations');
    return response.data;
  }
};


export default api;
