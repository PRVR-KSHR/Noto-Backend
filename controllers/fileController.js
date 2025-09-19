import File from '../models/File.js';
import User from '../models/User.js';
import { uploadFile, deleteFile } from '../services/storageService.js';
import multer from 'multer';
import path from 'path'; // ✅ NEW: Added path import
import fs from 'fs'; // ✅ NEW: Added fs import  
import { TextExtractionService } from '../services/textExtraction.js'; // ✅ NEW: Added text extraction service

// ✅ UPDATED: Configure multer for disk storage (was memory storage)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'temp-uploads');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename to avoid conflicts
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // ✅ UPDATED: Removed image types (only PDF, DOC, DOCX, PPT, PPTX, TXT)
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported. Only PDF, DOC, DOCX, PPT, PPTX, and TXT files are allowed.'), false);
    }
  }
}).single('file');

// Category-to-folder mapping
const getCategoryFolder = (category) => {
  const folderMap = {
    'notes': 'Notes',
    'assignments': 'Assignments',
    'practical': 'Practicals',
    'prevquestionpaper': 'Previous-Year-Questions',
    'researchpaper': 'Research-Papers'
  };
  return folderMap[category] || 'Others';
};

// ✅ NEW: Add text extraction endpoint
export const getFileWithText = async (req, res) => {
  try {
    const { fileId } = req.params;
    console.log('📖 Fetching file with text extraction:', fileId);

    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    console.log('📄 File details:', {
      name: file.fileName,
      type: file.fileType,
      url: file.fileUrl.substring(0, 50) + '...'
    });

    // Extract text content from the actual file
    let extractedText = '';
    let extractionFailed = false;
    
    // ✅ NEW: Use stored extracted text if available
    if (file.extractedText) {
      console.log('✅ Using stored extracted text, length:', file.extractedText.length);
      extractedText = file.extractedText;
    } else {
      // Fallback: try to extract from URL (legacy files)
      console.log('⚠️ No stored text found, attempting URL extraction...');
      try {
        extractedText = await TextExtractionService.extractTextFromFile(
          file.fileUrl,
          file.fileName,
          file.fileType
        );
        console.log('✅ Text extracted successfully, length:', extractedText.length);
      } catch (extractError) {
        console.error('❌ Text extraction failed:', extractError);
        extractionFailed = true;
        extractedText = `EXTRACTION_FAILED: ${extractError.message}`;
      }
    }

    // Update file stats
    await File.findByIdAndUpdate(fileId, {
      $inc: { 'stats.views': 1 }
    });

    // Return file data with extracted text
    res.json({
      success: true,
      data: {
        file: {
          _id: file._id,
          title: file.title,
          fileName: file.fileName,
          fileUrl: file.fileUrl,
          fileType: file.fileType,
          fileSize: file.fileSize,
          category: file.category,
          metadata: file.metadata,
          stats: file.stats,
          createdAt: file.createdAt,
          extractedText: extractedText // ✅ ACTUAL extracted text
        }
      }
    });
  } catch (error) {
    console.error('❌ Get file with text error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch file content'
    });
  }
};

// ✅ UPDATED: Upload material with category-based folders + upload limit + temp file cleanup
export const uploadMaterial = async (req, res) => {
  let tempFilePath = null; // ✅ NEW: Track temp file for cleanup
  
  try {
    console.log('📤 Upload request received from:', req.user.email);

    const {
      title,
      category,
      course,
      subject,
      collegeName,
      professorName,
      semester,
      year
    } = req.body;

    // Validate required fields
    const requiredFields = { title, category, course, subject, collegeName, semester, year };
    const missingFields = Object.entries(requiredFields).filter(([key, value]) => !value);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.map(([key]) => key).join(', ')}`
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // ✅ NEW: Check upload limit using fresh database count
    const currentUser = await User.findById(req.user._id);
    const UPLOAD_LIMIT = 5; // Upload limit per user

    // Count actual files in database for this user
    const actualFileCount = await File.countDocuments({ 
      uploadedBy: req.user.uid,
      'moderation.approved': true 
    });

    console.log(`📊 User ${req.user.email} has ${actualFileCount}/${UPLOAD_LIMIT} files`);

    if (actualFileCount >= UPLOAD_LIMIT) {
      return res.status(400).json({
        success: false,
        message: `Upload limit reached. Please delete some files to upload new ones.`
      });
    }

    // ✅ NEW: Store temp file path for cleanup
    tempFilePath = req.file.path;

    console.log('📁 File details:', {
      name: req.file.originalname,
      size: `${(req.file.size / 1024 / 1024).toFixed(2)} MB`,
      type: req.file.mimetype,
      category: category,
      tempPath: tempFilePath, // ✅ NEW: Log temp path
      currentUploadCount: currentUser.uploadCount
    });

    // Get category-specific folder
    const categoryFolder = getCategoryFolder(category);
    console.log(`📂 Uploading to folder: ${categoryFolder}`);

    // Upload file to category-specific folder
    const uploadResult = await uploadFile(req.file, categoryFolder);
    console.log('✅ File uploaded successfully:', uploadResult.fileUrl);

    // ✅ NEW: Extract text content during upload (more reliable than downloading later)
    let extractedText = '';
    try {
      console.log('📖 Extracting text during upload from temp file...');
      const fileBuffer = fs.readFileSync(req.file.path);
      extractedText = await TextExtractionService.extractTextFromBuffer(
        fileBuffer,
        req.file.originalname,
        req.file.mimetype
      );
      console.log('✅ Text extracted during upload, length:', extractedText.length);
    } catch (extractError) {
      console.error('❌ Text extraction during upload failed:', extractError);
      extractedText = `EXTRACTION_FAILED: ${extractError.message}`;
    }

    // Create comprehensive file record
    const newFile = new File({
      title: title.trim(),
      fileName: req.file.originalname,
      fileUrl: uploadResult.fileUrl,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      extractedText: extractedText, // ✅ NEW: Store extracted text
      storage: {
        provider: uploadResult.provider,
        publicId: uploadResult.publicId,
      },
      category: {
        type: category,
        branch: course,
        semester: semester.toString(),
        subject: subject.trim()
      },
      uploadedBy: req.user.uid,
      metadata: {
        collegeName: collegeName.trim(),
        professorName: professorName ? professorName.trim() : null,
        year: parseInt(year),
        course: course.trim(),
        originalSize: req.file.size,
        uploadFolder: categoryFolder
      },
      // Enhanced tags for better searchability
      tags: [
        category,
        course.toLowerCase(),
        subject.toLowerCase(),
        `sem-${semester}`,
        collegeName.toLowerCase()
      ],
      // Auto-approve for now, can be changed for moderation
      moderation: {
        approved: true,
        moderatedAt: new Date()
      },
      // NEW: Initialize verification status as pending
      verification: {
        status: 'pending' // Will be changed to 'verified' or 'rejected' by admin
      }
    });

    await newFile.save();

    // Update user's upload count and stats
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { uploadCount: 1 }
    });

    console.log('✅ File record saved to database');

    // Return success response with comprehensive data
    res.status(201).json({
      success: true,
      message: '🎉 Material uploaded successfully!',
      data: {
        file: {
          id: newFile._id,
          title: newFile.title,
          category: newFile.category,
          fileUrl: newFile.fileUrl,
          fileSize: newFile.fileSize,
          uploadedAt: newFile.createdAt,
          uploader: req.user.displayName,
          folder: categoryFolder,
          metadata: newFile.metadata
        }
      }
    });

  } catch (error) {
    if (error.response?.status !== 400 || !error.response?.data?.message?.includes('Upload limit')) {
      console.error("❌ Upload error:", error);
      console.error("❌ Error details:", error.response?.data);
    }
    
    res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  } finally {
    // ✅ NEW: Critical cleanup of temporary file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log('🧹 Cleaned up temp file:', tempFilePath);
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup temp file:', cleanupError);
      }
    }
  }
};

// Get files by category with robust uploader information
export const getFilesByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const filter = {
      'moderation.approved': true,
      'category.type': category
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get files first
    const files = await File.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get uploader information using robust UID lookup
    const uploaderUIDs = [...new Set(files.map(file => file.uploadedBy))];
    const uploaders = await User.find({ uid: { $in: uploaderUIDs } }).lean();
    
    const uploaderMap = uploaders.reduce((acc, user) => {
      acc[user.uid] = user;
      return acc;
    }, {});

    // Add uploader info to each file
    const filesWithUploaders = files.map(file => ({
      ...file,
      uploader: uploaderMap[file.uploadedBy] || null
    }));

    const total = await File.countDocuments(filter);

    res.json({
      success: true,
      data: {
        category: getCategoryFolder(category),
        files: filesWithUploaders,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          hasNext: skip + filesWithUploaders.length < total,
          count: filesWithUploaders.length,
          totalItems: total
        }
      }
    });

  } catch (error) {
    console.error('❌ Get files by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch files'
    });
  }
};

// Getting the files from the backend with robust uploader information
export const getFiles = async (req, res) => {
  console.log('📥 Files API called');
  try {
    const {
      category,
      course,
      semester,
      subject,
      search,
      page = 1,
      limit = 20
    } = req.query;

    // Build filter
    const filter = { 
      'moderation.approved': true,
      'verification.status': 'verified' // NEW: Only show verified materials
    };
    if (category) filter['category.type'] = category;
    if (course) filter['category.branch'] = new RegExp(course, 'i');
    if (semester) filter['category.semester'] = semester;
    if (subject) filter['category.subject'] = new RegExp(subject, 'i');

    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { 'category.subject': new RegExp(search, 'i') },
        { 'metadata.course': new RegExp(search, 'i') },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get the files first
    const files = await File.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get unique uploader UIDs
    const uploaderUIDs = [...new Set(files.map(file => file.uploadedBy))];
    
    // Fetch all uploaders in one query
    const uploaders = await User.find({ uid: { $in: uploaderUIDs } }).lean();
    
    // Create a lookup map
    const uploaderMap = uploaders.reduce((acc, user) => {
      acc[user.uid] = user;
      return acc;
    }, {});

    // Add uploader info to each file
    const filesWithUploaders = files.map(file => ({
      ...file,
      uploader: uploaderMap[file.uploadedBy] || null
    }));

    const total = await File.countDocuments(filter);

    console.log('✅ Files found:', filesWithUploaders.length);

    res.json({
      success: true,
      data: {
        files: filesWithUploaders,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          hasNext: skip + filesWithUploaders.length < total,
          count: filesWithUploaders.length,
          totalItems: total
        }
      }
    });

  } catch (error) {
    console.error('❌ Get files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch files',
      error: error.message
    });
  }
};

export const getFileDownload = async (req, res) => {
  try {
    const { fileId } = req.params;

    const file = await File.findById(fileId);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Increment stats
    await File.findByIdAndUpdate(fileId, {
      $inc: {
        'stats.downloadCount': 1,
        'stats.views': 1
      }
    });

    // Update user download count if logged in
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { downloadCount: 1 }
      });
    }

    res.json({
      success: true,
      data: {
        downloadUrl: file.fileUrl,
        fileName: file.fileName,
        fileSize: file.fileSize,
        title: file.title
      }
    });

  } catch (error) {
    console.error('❌ Download error:', error);
    res.status(500).json({
      success: false,
      message: 'Download failed'
    });
  }
};

// Add bookmark functionality
export const addBookmark = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user._id;

    // Check if file exists
    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check if already bookmarked
    const user = await User.findById(userId);
    if (user.bookmarks.includes(fileId)) {
      return res.status(400).json({
        success: false,
        message: 'File already bookmarked'
      });
    }

    // Add bookmark
    await User.findByIdAndUpdate(userId, {
      $addToSet: { bookmarks: fileId }
    });

    res.json({
      success: true,
      message: 'Bookmark added successfully'
    });
  } catch (error) {
    console.error('❌ Add bookmark error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add bookmark'
    });
  }
};

// Remove bookmark functionality
export const removeBookmark = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user._id;

    await User.findByIdAndUpdate(userId, {
      $pull: { bookmarks: fileId }
    });

    res.json({
      success: true,
      message: 'Bookmark removed successfully'
    });
  } catch (error) {
    console.error('❌ Remove bookmark error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove bookmark'
    });
  }
};

// Get user bookmarks functionality
export const getUserBookmarks = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const user = await User.findById(userId)
      .populate({
        path: 'bookmarks',
        match: { 'moderation.approved': true },
        options: {
          sort: { createdAt: -1 },
          skip: skip,
          limit: parseInt(limit)
        }
      });

    const bookmarks = user.bookmarks.filter(bookmark => bookmark !== null);
    const total = await User.findById(userId).then(u => u.bookmarks.length);

    res.json({
      success: true,
      data: {
        files: bookmarks,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          hasNext: skip + bookmarks.length < total,
          count: bookmarks.length,
          totalItems: total
        }
      }
    });
  } catch (error) {
    console.error('❌ Get bookmarks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookmarks'
    });
  }
};

// ============= STAR FUNCTIONALITY =============

// Add star functionality
export const addStar = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user._id;

    // Check if file exists
    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check if already starred
    const user = await User.findById(userId);
    if (user.stars.includes(fileId)) {
      return res.status(400).json({
        success: false,
        message: 'File already starred'
      });
    }

    // Add star to user and increment file star count
    await User.findByIdAndUpdate(userId, {
      $addToSet: { stars: fileId }
    });

    await File.findByIdAndUpdate(fileId, {
      $inc: { 'stats.starCount': 1 }
    });

    res.json({
      success: true,
      message: 'Star added successfully'
    });
  } catch (error) {
    console.error('❌ Add star error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add star'
    });
  }
};

// Remove star functionality
export const removeStar = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user._id;

    // Remove star from user and decrement file star count
    await User.findByIdAndUpdate(userId, {
      $pull: { stars: fileId }
    });

    await File.findByIdAndUpdate(fileId, {
      $inc: { 'stats.starCount': -1 }
    });

    res.json({
      success: true,
      message: 'Star removed successfully'
    });
  } catch (error) {
    console.error('❌ Remove star error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove star'
    });
  }
};

// Get user stars functionality
export const getUserStars = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const user = await User.findById(userId)
      .populate({
        path: 'stars',
        match: { 'moderation.approved': true },
        options: {
          sort: { createdAt: -1 },
          skip: skip,
          limit: parseInt(limit)
        }
      });

    const stars = user.stars.filter(star => star !== null);
    const total = await User.findById(userId).then(u => u.stars.length);

    res.json({
      success: true,
      data: {
        files: stars,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          hasNext: skip + stars.length < total,
          count: stars.length,
          totalItems: total
        }
      }
    });
  } catch (error) {
    console.error('❌ Get stars error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stars'
    });
  }
};

// Delete material functionality
export const deleteMaterial = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user._id;

    // Find the file and verify ownership
    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check if user owns this file
    if (file.uploadedBy !== req.user.uid) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own files'
      });
    }

    console.log('🗑️ Deleting file:', {
      title: file.title,
      publicId: file.storage.publicId,
      provider: file.storage.provider
    });

    // Delete from Cloudinary
    try {
      await deleteFile(file.storage.publicId, file.storage.provider);
      console.log('✅ File deleted from Cloudinary:', file.storage.publicId);
    } catch (cloudinaryError) {
      console.error('❌ Cloudinary deletion failed:', cloudinaryError);
      // Continue with database deletion even if Cloudinary fails
    }

    // Delete from database
    await File.findByIdAndDelete(fileId);

    // Update user's upload count
    await User.findByIdAndUpdate(userId, {
      $inc: { uploadCount: -1 }
    });

    // Remove from all users' bookmarks
    await User.updateMany(
      { bookmarks: fileId },
      { $pull: { bookmarks: fileId } }
    );

    console.log('✅ File deleted successfully:', file.title);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file'
    });
  }
};
