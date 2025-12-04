import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
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

export default router;
