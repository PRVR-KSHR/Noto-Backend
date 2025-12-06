import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import asyncHandler from '../utils/asyncHandler.js';
import ProfessorValidator from '../models/ProfessorValidator.js';
import File from '../models/File.js';

const router = express.Router();

// Get my professor application
router.get('/my-application', authenticateUser, asyncHandler(async (req, res) => {
  const application = await ProfessorValidator.findOne({ 
    userId: req.user.uid 
  }).sort({ createdAt: -1 });

  res.json({
    success: true,
    application: application || null
  });
}));

// Apply for professor validator role
router.post('/apply', authenticateUser, asyncHandler(async (req, res) => {
  const existingApplication = await ProfessorValidator.findOne({
    userId: req.user.uid,
    status: { $in: ['pending', 'approved'] }
  });

  if (existingApplication) {
    return res.status(400).json({
      success: false,
      message: 'You already have a pending or approved application'
    });
  }

  const application = await ProfessorValidator.create({
    userId: req.user.uid,
    ...req.body
  });

  res.status(201).json({
    success: true,
    application
  });
}));

// ✅ NEW: Search approved professors by name, college, and subject
router.get('/search', asyncHandler(async (req, res) => {
  const { query, collegeName, subject } = req.query;

  // Validation: at least one search parameter required
  if (!query || !query.trim()) {
    return res.json({
      success: true,
      professors: []
    });
  }

  // Build filter for approved professors only
  let filter = {
    status: 'approved'
  };

  // Add college filter if provided
  if (collegeName && collegeName.trim()) {
    filter.collegeName = { $regex: collegeName.trim(), $options: 'i' };
  }

  // Add subject filter if provided - search in subjects array
  if (subject && subject.trim()) {
    filter.subjects = { $elemMatch: { $regex: subject.trim(), $options: 'i' } };
  }

  // Search for professors by name, email, or professorId matching query
  const professors = await ProfessorValidator.find({
    ...filter,
    $or: [
      { fullName: { $regex: query.trim(), $options: 'i' } },
      { email: { $regex: query.trim(), $options: 'i' } },
      { professorId: { $regex: query.trim(), $options: 'i' } }
    ]
  })
    .select('_id userId fullName email collegeName professorId subjects')
    .limit(10);

  res.json({
    success: true,
    professors
  });
}));

// ✅ NEW: Admin - Get all professor applications with filters
router.get('/admin/all', requireAdmin, asyncHandler(async (req, res) => {
  const { status = 'all', collegeName = 'all', page = 1 } = req.query;
  const limit = 10;
  const skip = (page - 1) * limit;

  // Build filter object
  let filter = {};
  if (status && status !== 'all') {
    filter.status = status;
  }
  if (collegeName && collegeName !== 'all') {
    filter.collegeName = { $regex: collegeName, $options: 'i' };
  }

  // Get total count for pagination
  const total = await ProfessorValidator.countDocuments(filter);

  // Get filtered applications with user details
  const applications = await ProfessorValidator.find(filter)
    .populate('userId', 'name email photoURL')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    success: true,
    data: applications,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    }
  });
}));

// ✅ NEW: Admin - Approve professor application
router.post('/admin/:applicationId/approve', requireAdmin, asyncHandler(async (req, res) => {
  const application = await ProfessorValidator.findByIdAndUpdate(
    req.params.applicationId,
    {
      status: 'approved',
      approvedBy: req.user.uid,
      approvedAt: new Date()
    },
    { new: true }
  ).populate('userId', 'name email');

  if (!application) {
    return res.status(404).json({
      success: false,
      message: 'Application not found'
    });
  }

  res.json({
    success: true,
    message: 'Professor application approved',
    data: application
  });
}));

// ✅ NEW: Admin - Reject professor application
router.post('/admin/:applicationId/reject', requireAdmin, asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const application = await ProfessorValidator.findByIdAndUpdate(
    req.params.applicationId,
    {
      status: 'rejected',
      rejectionReason: reason,
      rejectedBy: req.user.uid,
      rejectedAt: new Date()
    },
    { new: true }
  ).populate('userId', 'name email');

  if (!application) {
    return res.status(404).json({
      success: false,
      message: 'Application not found'
    });
  }

  res.json({
    success: true,
    message: 'Professor application rejected',
    data: application
  });
}));

// ✅ NEW: Get materials assigned to logged-in professor for verification
router.get('/verification/assigned', authenticateUser, asyncHandler(async (req, res) => {
  // Get the professor's record
  const professor = await ProfessorValidator.findOne({ userId: req.user.uid });
  
  if (!professor) {
    return res.status(404).json({
      success: false,
      message: 'Professor profile not found'
    });
  }

  // Find materials where this professor is tagged
  const materials = await File.find({
    'taggedProfessors.professorId': professor._id
  })
    .select('_id title subject collegeName uploadedBy verification taggedProfessors createdAt')
    .populate('uploadedBy', 'name email')
    .sort({ createdAt: -1 });

  // Filter to show only materials assigned to this professor
  const assignedMaterials = materials.map(material => {
    const professorTag = material.taggedProfessors.find(
      p => p.professorId && p.professorId.toString() === professor._id.toString()
    );
    
    return {
      _id: material._id,
      title: material.title,
      subject: material.subject,
      collegeName: material.collegeName,
      uploadedBy: material.uploadedBy,
      createdAt: material.createdAt,
      verificationStatus: professorTag?.verificationStatus || 'pending',
      professorsComments: professorTag?.comments || ''
    };
  });

  res.json({
    success: true,
    data: assignedMaterials,
    count: assignedMaterials.length
  });
}));

// ✅ NEW: Professor verifies/approves assigned material
router.post('/verification/:materialId/approve', authenticateUser, asyncHandler(async (req, res) => {
  const { materialId } = req.params;
  const { comments } = req.body;

  // Get the professor's record
  const professor = await ProfessorValidator.findOne({ userId: req.user.uid });
  
  if (!professor) {
    return res.status(404).json({
      success: false,
      message: 'Professor profile not found'
    });
  }

  // Find and update the material
  const material = await File.findByIdAndUpdate(
    materialId,
    {
      $set: {
        'taggedProfessors.$[elem].verificationStatus': 'approved',
        'taggedProfessors.$[elem].comments': comments || '',
        'taggedProfessors.$[elem].verifiedAt': new Date()
      }
    },
    {
      arrayFilters: [{ 'elem.professorId': professor._id }],
      new: true
    }
  ).populate('uploadedBy', 'name email');

  if (!material) {
    return res.status(404).json({
      success: false,
      message: 'Material not found'
    });
  }

  res.json({
    success: true,
    message: 'Material approved successfully',
    data: material
  });
}));

// ✅ NEW: Professor rejects assigned material
router.post('/verification/:materialId/reject', authenticateUser, asyncHandler(async (req, res) => {
  const { materialId } = req.params;
  const { comments } = req.body;

  // Get the professor's record
  const professor = await ProfessorValidator.findOne({ userId: req.user.uid });
  
  if (!professor) {
    return res.status(404).json({
      success: false,
      message: 'Professor profile not found'
    });
  }

  // Find and update the material
  const material = await File.findByIdAndUpdate(
    materialId,
    {
      $set: {
        'taggedProfessors.$[elem].verificationStatus': 'rejected',
        'taggedProfessors.$[elem].comments': comments || 'Rejected by professor',
        'taggedProfessors.$[elem].rejectedAt': new Date()
      }
    },
    {
      arrayFilters: [{ 'elem.professorId': professor._id }],
      new: true
    }
  ).populate('uploadedBy', 'name email');

  if (!material) {
    return res.status(404).json({
      success: false,
      message: 'Material not found'
    });
  }

  res.json({
    success: true,
    message: 'Material rejected',
    data: material
  });
}));

export default router;
