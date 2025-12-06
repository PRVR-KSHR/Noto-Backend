import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import asyncHandler from '../utils/asyncHandler.js';
import ProfessorApplication from '../models/ProfessorApplication.js';
import File from '../models/File.js';

const router = express.Router();

// Get my professor application
router.get('/my-application', authenticateUser, asyncHandler(async (req, res) => {
  const application = await ProfessorApplication.findOne({ 
    userId: req.user.uid 
  }).sort({ createdAt: -1 });

  res.json({
    success: true,
    application: application || null
  });
}));

// Apply for professor validator role
router.post('/apply', authenticateUser, asyncHandler(async (req, res) => {
  const existingApplication = await ProfessorApplication.findOne({
    userId: req.user.uid,
    status: { $in: ['pending', 'approved'] }
  });

  if (existingApplication) {
    return res.status(400).json({
      success: false,
      message: 'You already have a pending or approved application'
    });
  }

  const application = await ProfessorApplication.create({
    userId: req.user.uid,
    ...req.body
  });

  res.status(201).json({
    success: true,
    application
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
  const total = await ProfessorApplication.countDocuments(filter);

  // Get filtered applications with user details
  const applications = await ProfessorApplication.find(filter)
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
  const application = await ProfessorApplication.findByIdAndUpdate(
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

  const application = await ProfessorApplication.findByIdAndUpdate(
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

export default router;
