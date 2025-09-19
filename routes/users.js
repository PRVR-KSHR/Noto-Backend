import express from 'express';
import { authenticateUser, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Placeholder routes - we'll build these later
router.get('/', requireRole(['admin', 'moderator']), (req, res) => {
  res.json({
    success: true,
    message: 'Users routes working - Admin only',
    data: []
  });
});

router.get('/stats', authenticateUser, (req, res) => {
  res.json({
    success: true,
    message: 'User stats endpoint',
    data: {
      uploadCount: 0,
      downloadCount: 0
    }
  });
});  // ADD THIS CLOSING BRACE

export default router;
