import express from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import Visitor from '../models/Visitor.js';
import ActiveSession from '../models/ActiveSession.js';

const router = express.Router();

// ✅ NEW: Track active user session
router.post('/session/start', asyncHandler(async (req, res) => {
  try {
    const sessionId = req.body.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { page } = req.body;

    // Create or update active session
    await ActiveSession.findOneAndUpdate(
      { sessionId },
      {
        sessionId,
        page: page || '/',
        lastActive: new Date(),
        startedAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      sessionId
    });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start session'
    });
  }
}));

// ✅ NEW: Update active session (keep-alive)
router.post('/session/ping', asyncHandler(async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'sessionId required'
      });
    }

    await ActiveSession.findOneAndUpdate(
      { sessionId },
      { lastActive: new Date() },
      { new: true }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error pinging session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to ping session'
    });
  }
}));

// ✅ NEW: Get current active users count
router.get('/active-users', asyncHandler(async (req, res) => {
  try {
    // Count sessions active in last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const activeCount = await ActiveSession.countDocuments({
      lastActive: {
        $gte: fiveMinutesAgo
      }
    });

    res.json({
      success: true,
      activeUsers: activeCount
    });
  } catch (error) {
    console.error('Error getting active users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active users'
    });
  }
}));

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

// ✅ NEW: Get historical visitor data (last N days)
router.get('/history', asyncHandler(async (req, res) => {
  try {
    const { days = 30 } = req.query; // Default to last 30 days
    const numDays = Math.min(parseInt(days), 90); // Max 90 days

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - numDays);

    // Get daily visitor counts for the specified period
    const dailyStats = await Visitor.aggregate([
      {
        $match: {
          visitDate: {
            $gte: startDate
          }
        }
      },
      {
        $group: {
          _id: '$visitDate',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Get unique visitors per day (by IP)
    const uniqueVisitorsDaily = await Visitor.aggregate([
      {
        $match: {
          visitDate: {
            $gte: startDate
          }
        }
      },
      {
        $group: {
          _id: {
            date: '$visitDate',
            ip: '$ip'
          }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          uniqueCount: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Get popular pages
    const popularPages = await Visitor.aggregate([
      {
        $match: {
          visitDate: {
            $gte: startDate
          }
        }
      },
      {
        $group: {
          _id: '$page',
          views: { $sum: 1 }
        }
      },
      {
        $sort: { views: -1 }
      },
      {
        $limit: 10
      }
    ]);

    // Calculate total and average
    const totalVisitsInPeriod = dailyStats.reduce((sum, day) => sum + day.count, 0);
    const totalUniqueVisitors = uniqueVisitorsDaily.reduce((sum, day) => sum + day.uniqueCount, 0);
    const avgDailyVisits = Math.round(totalVisitsInPeriod / numDays);

    res.json({
      success: true,
      period: {
        days: numDays,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString()
      },
      summary: {
        totalVisits: totalVisitsInPeriod,
        uniqueVisitors: totalUniqueVisitors,
        avgDailyVisits
      },
      dailyData: dailyStats.map(day => ({
        date: day._id,
        visits: day.count
      })),
      uniqueVisitorsDaily: uniqueVisitorsDaily.map(day => ({
        date: day._id,
        uniqueVisitors: day.uniqueCount
      })),
      popularPages
    });
  } catch (error) {
    console.error('Error fetching visitor history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch visitor history'
    });
  }
}));

// ✅ NEW: Get visitor stats for specific date range
router.get('/stats/range', asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    start.setHours(0, 0, 0, 0);

    const totalVisits = await Visitor.countDocuments({
      visitDate: {
        $gte: start,
        $lte: end
      }
    });

    const uniqueVisitors = await Visitor.aggregate([
      {
        $match: {
          visitDate: {
            $gte: start,
            $lte: end
          }
        }
      },
      {
        $group: {
          _id: '$ip'
        }
      },
      {
        $count: 'count'
      }
    ]);

    res.json({
      success: true,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalVisits,
      uniqueVisitors: uniqueVisitors[0]?.count || 0
    });
  } catch (error) {
    console.error('Error fetching stats range:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stats range'
    });
  }
}));

export default router;
