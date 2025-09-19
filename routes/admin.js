import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAdmin, checkAdminStatus } from '../middleware/adminAuth.js';
import { deleteFile } from '../services/storageService.js'; // NEW: For Cloudinary deletion
import {
  getAllDonationsAdmin,
  addDonation,
  updateDonation,
  deleteDonation,
  getDonationStats
} from '../controllers/donationController.js';
import {
  getAllEventsAdmin,
  createEvent,
  updateEvent,
  deleteEvent,
  toggleEventStatus
} from '../controllers/eventController.js';

const router = express.Router();

// Configure multer for file uploads (disk storage so Cloudinary can read file.path)
const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'temp-uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: diskStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// ✅ Check if user has admin access
router.get('/check-access', checkAdminStatus, (req, res) => {
  res.json({
    success: true,
    isAdmin: req.isAdmin,
    message: req.isAdmin ? 'Admin access granted' : 'Regular user access'
  });
});

// ✅ ADMIN DASHBOARD ROUTES - DONATIONS
router.get('/donations', requireAdmin, getAllDonationsAdmin);
router.post('/donations', requireAdmin, addDonation);
router.put('/donations/:donationId', requireAdmin, updateDonation);
router.delete('/donations/:donationId', requireAdmin, deleteDonation);
router.get('/donations/stats', requireAdmin, getDonationStats);

// ✅ ADMIN DASHBOARD ROUTES - EVENTS
router.get('/events', requireAdmin, getAllEventsAdmin);
router.post('/events', 
  (req, res, next) => {
    console.log('🎯 POST /admin/events endpoint hit');
    console.log('Request content-type:', req.headers['content-type']);
    next();
  },
  upload.single('eventImage'),
  (req, res, next) => {
    console.log('📁 After multer - File present:', !!req.file);
    console.log('📝 Body keys:', Object.keys(req.body));
    next();
  },
  requireAdmin, 
  createEvent
);
router.put('/events/:eventId', requireAdmin, upload.single('eventImage'), updateEvent);
router.delete('/events/:eventId', requireAdmin, deleteEvent);
router.patch('/events/:eventId/toggle', requireAdmin, toggleEventStatus);

// ✅ NEW: MATERIAL VERIFICATION ROUTES
router.get('/materials/pending', requireAdmin, async (req, res) => {
  try {
    const File = (await import('../models/File.js')).default;
    const pendingMaterials = await File.find({ 'verification.status': 'pending' })
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'name email')
      .lean();

    res.json({
      success: true,
      data: pendingMaterials,
      count: pendingMaterials.length
    });
  } catch (error) {
    console.error('Error fetching pending materials:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending materials'
    });
  }
});

router.post('/materials/:materialId/verify', requireAdmin, async (req, res) => {
  try {
    const File = (await import('../models/File.js')).default;
    const { materialId } = req.params;
    
    const material = await File.findByIdAndUpdate(
      materialId,
      {
        'verification.status': 'verified',
        'verification.verifiedBy': req.user.uid,
        'verification.verifiedAt': new Date()
      },
      { new: true }
    );

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    res.json({
      success: true,
      message: 'Material verified successfully',
      data: material
    });
  } catch (error) {
    console.error('Error verifying material:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify material'
    });
  }
});

router.post('/materials/:materialId/reject', requireAdmin, async (req, res) => {
  try {
    const File = (await import('../models/File.js')).default;
    const { materialId } = req.params;
    const { reason } = req.body;
    
    const material = await File.findByIdAndUpdate(
      materialId,
      {
        'verification.status': 'rejected',
        'verification.verifiedBy': req.user.uid,
        'verification.verifiedAt': new Date(),
        'verification.rejectionReason': reason || 'No reason provided'
      },
      { new: true }
    );

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    // NEW: Delete from Cloudinary when material is rejected
    try {
      if (material.storage?.publicId && material.storage?.provider) {
        console.log(`🗑️ Deleting rejected material from ${material.storage.provider}: ${material.storage.publicId}`);
        await deleteFile(material.storage.publicId, material.storage.provider);
        console.log('✅ File deleted from cloud storage successfully');
      }
    } catch (deleteError) {
      console.error('❌ Error deleting file from cloud storage:', deleteError);
      // Continue with rejection even if cloud deletion fails
    }

    res.json({
      success: true,
      message: 'Material rejected and removed from storage',
      data: material
    });
  } catch (error) {
    console.error('Error rejecting material:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject material'
    });
  }
});

export default router;
