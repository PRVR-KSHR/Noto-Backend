import express from 'express';
import File from '../models/File.js';
import ProfessorValidator from '../models/ProfessorValidator.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { authenticateUser } from '../middleware/auth.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = express.Router();

// ✅ 1. Get all materials (Admin Dashboard - Material Management)
router.get('/admin/all-materials', requireAdmin, async (req, res) => {
  try {
    const {
      search = '',
      category = 'all',
      status = 'all',
      isHidden = 'all',
      page = 1,
      limit = 20
    } = req.query;

    // Build filter
    let filter = {};

    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { 'metadata.subject': new RegExp(search, 'i') },
        { 'metadata.professorName': new RegExp(search, 'i') }
      ];
    }

    if (category !== 'all') {
      filter['category.type'] = category;
    }

    if (status !== 'all') {
      filter['verification.status'] = status;
    }

    if (isHidden !== 'all') {
      filter.isHidden = isHidden === 'true';
    }

    // Pagination
    const skip = (page - 1) * limit;

    const materials = await File.find(filter)
      .select('_id title fileName fileType fileSize category uploadedBy metadata stats verification isHidden createdAt')
      .populate('uploadedBy', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await File.countDocuments(filter);

    res.json({
      success: true,
      materials,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching all materials:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch materials',
      error: error.message
    });
  }
});

// ✅ 2. Get material details (Admin)
router.get('/admin/material/:materialId', requireAdmin, async (req, res) => {
  try {
    const { materialId } = req.params;

    const material = await File.findById(materialId)
      .populate('uploadedBy', 'username email')
      .populate('taggedProfessors.professorId', 'fullName email collegeName');

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    res.json({
      success: true,
      material
    });
  } catch (error) {
    console.error('Error fetching material:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch material',
      error: error.message
    });
  }
});

// ✅ 3. Delete material (Admin)
router.delete('/admin/material/:materialId', requireAdmin, async (req, res) => {
  try {
    const { materialId } = req.params;
    
    // Validate MongoDB ObjectId format
    if (!materialId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid material ID format'
      });
    }

    const material = await File.findById(materialId);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    // Delete from database
    const deletedMaterial = await File.findByIdAndDelete(materialId);

    if (!deletedMaterial) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete material from database'
      });
    }

    // TODO: Delete from Cloudinary/R2 storage
    // await deleteFromStorage(material.fileUrl);

    res.json({
      success: true,
      message: 'Material deleted successfully',
      material: deletedMaterial
    });
  } catch (error) {
    console.error('Error deleting material:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete material',
      error: error.message
    });
  }
});

// ✅ 4. Hide material (Soft delete - Admin)
router.patch('/admin/material/:materialId/hide', requireAdmin, async (req, res) => {
  try {
    const { materialId } = req.params;
    const { reason = 'No reason provided' } = req.body;
    const adminId = req.user.uid;

    const material = await File.findByIdAndUpdate(
      materialId,
      {
        isHidden: true,
        hiddenAt: new Date(),
        hiddenBy: adminId,
        hideReason: reason.trim()
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
      message: 'Material hidden successfully',
      material
    });
  } catch (error) {
    console.error('Error hiding material:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to hide material',
      error: error.message
    });
  }
});

// ✅ 5. Unhide material (Admin)
router.patch('/admin/material/:materialId/unhide', requireAdmin, async (req, res) => {
  try {
    const { materialId } = req.params;

    const material = await File.findByIdAndUpdate(
      materialId,
      {
        isHidden: false,
        hiddenAt: null,
        hiddenBy: null,
        hideReason: null
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
      message: 'Material unhidden successfully',
      material
    });
  } catch (error) {
    console.error('Error unhiding material:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unhide material',
      error: error.message
    });
  }
});

// ✅ 6. Get materials tagged to a professor (Professor verification)
router.get('/professor/tagged-materials', authenticateUser, asyncHandler(async (req, res) => {
  // Get the professor's record to get their MongoDB ID
  const { default: ProfessorValidator } = await import('../models/ProfessorValidator.js');
  const professor = await ProfessorValidator.findOne({ userId: req.user.uid });
  
  if (!professor) {
    return res.json({
      success: true,
      materials: []
    });
  }

  // Find materials where this professor is tagged
  const materials = await File.find({
    'taggedProfessors.professorId': professor._id
  })
    .select('_id title subject collegeName uploadedBy verification taggedProfessors createdAt')
    .populate('uploadedBy', 'displayName email')
    .lean();

  res.json({
    success: true,
    materials: materials || []
  });
}));

// ✅ 7. Professor approves/rejects material
router.patch('/professor/material/:materialId/verify', authenticateUser, asyncHandler(async (req, res) => {
  const { materialId } = req.params;
  const { verificationStatus, feedback } = req.body;
  const professorId = req.user.uid;

  if (!['approved', 'rejected'].includes(verificationStatus)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid verification status'
    });
  }

  // Verify professor is approved
  const professor = await ProfessorValidator.findOne({
    userId: professorId,
    status: 'approved'
  });

  if (!professor) {
    return res.status(403).json({
      success: false,
      message: 'You are not an approved professor validator'
    });
  }

  // Update material verification status for this professor
  const material = await File.findOne({
    _id: materialId,
    'taggedProfessors.professorId': professor._id
  });

  if (!material) {
    return res.status(404).json({
      success: false,
      message: 'Material not found or not tagged to you'
    });
  }

  // ✅ NEW: Check if already admin-verified
  if (material.verification.adminVerified) {
    return res.status(200).json({
      success: true,  // Still success, just inform user
      message: 'This material has already been verified by admin and is now visible on Materials page',
      material
    });
  }

  // Find and update the professor's verification in the array
  const profVerificationIndex = material.taggedProfessors.findIndex(
    p => p.professorId.toString() === professor._id.toString()
  );

  if (profVerificationIndex !== -1) {
    material.taggedProfessors[profVerificationIndex].verificationStatus = verificationStatus;
    material.taggedProfessors[profVerificationIndex].verifiedAt = new Date();
    material.taggedProfessors[profVerificationIndex].feedback = feedback || '';
  }

  // ✅ UPDATED: Check if all professors have approved the material
  const allApproved = material.taggedProfessors.every(p => p.verificationStatus === 'approved');
  const anyRejected = material.taggedProfessors.some(p => p.verificationStatus === 'rejected');

  if (allApproved) {
    // All professors approved → set to verified so it shows on Materials page
    material.verification.status = 'verified';
    material.verification.verifiedAt = new Date();
    material.verification.verifiedBy = 'professor_validators';  // Mark as professor-verified
    material.verification.professorVerified = true;             // ✅ NEW: Mark as professor-verified
  } else if (anyRejected) {
    // At least one professor rejected → set to rejected
    material.verification.status = 'rejected';
    material.verification.rejectedAt = new Date();
    material.verification.rejectedBy = 'professor_validators';
  }

  await material.save();

  res.json({
    success: true,
    message: allApproved ? 
      `Material verified by all professors and is now visible on Materials page` :
      anyRejected ?
      `Material rejected` :
      `Material verification status updated`,
    material
  });
}));

// ✅ 8. Get admin dashboard stats for material management
router.get('/admin/stats', requireAdmin, async (req, res) => {
  try {
    const totalMaterials = await File.countDocuments({});
    const pendingVerification = await File.countDocuments({
      'verification.status': 'pending'
    });
    const verifiedMaterials = await File.countDocuments({
      'verification.status': 'verified'
    });
    const hiddenMaterials = await File.countDocuments({
      isHidden: true
    });

    res.json({
      success: true,
      stats: {
        total: totalMaterials,
        pending: pendingVerification,
        verified: verifiedMaterials,
        hidden: hiddenMaterials
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

export default router;
