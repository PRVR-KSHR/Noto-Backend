import express from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import Visitor from '../models/Visitor.js';

const router = express.Router();

// Log a visitor visit
router.post('/visit', asyncHandler(async (req, res) => {
  try {
    const { page } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Create visitor record
    await Visitor.create({
      page: page || '/',
      visitedAt: new Date(),
      visitDate: today,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress
    });

    res.json({
      success: true,
      message: 'Visit logged'
    });
  } catch (error) {
    console.error('Error logging visit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log visit'
    });
  }
}));

// Get visitor statistics
router.get('/visits', asyncHandler(async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get today's visits
    const todayVisits = await Visitor.countDocuments({
      visitDate: {
        $gte: today
      }
    });

    // Get total visits
    const totalVisits = await Visitor.countDocuments();

    res.json({
      success: true,
      todayVisits,
      totalVisits
    });
  } catch (error) {
    console.error('Error fetching visitor stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch visitor stats'
    });
  }
}));

export default router;
