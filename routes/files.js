import express from 'express';
import { authenticateUser, optionalAuth } from '../middleware/auth.js';
import asyncHandler from '../utils/asyncHandler.js';
import { 
  uploadMaterial, 
  getFiles, 
  getFileDownload,
  getFilesByCategory,
  uploadMiddleware,
  addBookmark,           // ✅ ADD THIS
  removeBookmark,        // ✅ ADD THIS  
  getUserBookmarks,
  addStar,              // ✅ NEW: Star functionality
  removeStar,           // ✅ NEW: Star functionality  
  getUserStars,         // ✅ NEW: Star functionality
  getFileWithText,
  deleteMaterial
} from '../controllers/fileController.js';
import File from '../models/File.js';
import filenService from '../services/filenService.js';

const router = express.Router();

// ✅ NEW: Storage health check endpoint
router.get('/health/storage', asyncHandler(async (req, res) => {
  try {
    const health = await filenService.healthCheck();
    res.json({
      success: true,
      storage: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// Get all files with filters
router.get('/', asyncHandler(getFiles));

// 🎯 NEW: Get files by category
router.get('/category/:category', optionalAuth, asyncHandler(getFilesByCategory));

// Search files
router.get('/search', optionalAuth, asyncHandler(getFiles));

// NEW: Route to get file with extracted text (BEFORE generic /:fileId)
router.get('/view/:fileId', optionalAuth, asyncHandler(getFileWithText));

// Download file (BEFORE generic /:fileId)
router.get('/download/:fileId', optionalAuth, asyncHandler(getFileDownload));

// Bookmark routes (GET before generic /:fileId)
router.get('/bookmarks', authenticateUser, asyncHandler(getUserBookmarks));
router.get('/stars', authenticateUser, asyncHandler(getUserStars));

// Get user's uploads
router.get('/my-uploads', authenticateUser, asyncHandler(async (req, res) => {
  try {
    const files = await File.find({ uploadedBy: req.user.uid })
      .sort({ createdAt: -1 })
      .lean();

    // Group by category
    const filesByCategory = files.reduce((acc, file) => {
      const category = file.category.type;
      if (!acc[category]) acc[category] = [];
      acc[category].push(file);
      return acc;
    }, {});

    res.json({
      success: true,
      data: { 
        files,
        filesByCategory,
        stats: {
          total: files.length,
          notes: filesByCategory.notes?.length || 0,
          assignments: filesByCategory.assignments?.length || 0,
          practical: filesByCategory.practical?.length || 0,
          prevquestionpaper: filesByCategory.prevquestionpaper?.length || 0,
          researchpaper: filesByCategory.researchpaper?.length || 0
        }
      }
    });
  } catch (error) {
    // Will be handled by error middleware
    throw error;
  }
}));

// ⚠️ THIS MUST BE LAST GET ROUTE - catches any other /:fileId
router.get('/:fileId', optionalAuth, asyncHandler(async (req, res) => {
  try {
    const { fileId } = req.params;
    const file = await File.findById(fileId);
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    res.json({
      success: true,
      file: file
    });
  } catch (error) {
    throw error;
  }
}));

// Upload file
router.post('/upload', authenticateUser, uploadMiddleware, asyncHandler(uploadMaterial));

// Delete material (only owner can delete)
router.delete('/:fileId', authenticateUser, asyncHandler(deleteMaterial));

// Add these routes before export default router;
// Bookmark routes
router.post('/bookmark/:fileId', authenticateUser, asyncHandler(addBookmark));
router.delete('/bookmark/:fileId', authenticateUser, asyncHandler(removeBookmark));

// Star routes
router.post('/star/:fileId', authenticateUser, asyncHandler(addStar));
router.delete('/star/:fileId', authenticateUser, asyncHandler(removeStar));


export default router;
