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

const router = express.Router();

// Get all files with filters
router.get('/', asyncHandler(getFiles));

// 🎯 NEW: Get files by category
router.get('/category/:category', optionalAuth, asyncHandler(getFilesByCategory));

// Search files
router.get('/search', optionalAuth, asyncHandler(getFiles));

// Upload file
router.post('/upload', authenticateUser, uploadMiddleware, asyncHandler(uploadMaterial));

// Download file
router.get('/download/:fileId', optionalAuth, asyncHandler(getFileDownload));

// NEW: Route to get file with extracted text
router.get('/view/:fileId', optionalAuth, asyncHandler(getFileWithText));

// Delete material (only owner can delete)
router.delete('/:fileId', authenticateUser, asyncHandler(deleteMaterial));

// Add these routes before export default router;
// Bookmark routes
router.post('/bookmark/:fileId', authenticateUser, asyncHandler(addBookmark));
router.delete('/bookmark/:fileId', authenticateUser, asyncHandler(removeBookmark));
router.get('/bookmarks', authenticateUser, asyncHandler(getUserBookmarks));

// Star routes
router.post('/star/:fileId', authenticateUser, asyncHandler(addStar));
router.delete('/star/:fileId', authenticateUser, asyncHandler(removeStar));
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

// Add this route in routes/files.js
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
    // Will be handled by error middleware
    throw error;
  }
}));


export default router;
