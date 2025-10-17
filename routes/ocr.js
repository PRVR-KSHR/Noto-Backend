import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import ocrService from '../services/ocrService.js';

const router = express.Router();

/**
 * GET /api/ocr/status
 * Check OCR service status
 */
router.get('/status', authenticateUser, (req, res) => {
  try {
    const status = ocrService.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
