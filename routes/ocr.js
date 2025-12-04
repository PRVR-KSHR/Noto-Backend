import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import File from '../models/File.js';
import asyncHandler from '../utils/asyncHandler.js';

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

// Get OCR status for a file
router.get('/status/:fileId', authenticateUser, asyncHandler(async (req, res) => {
  const { fileId } = req.params;
  
  const file = await File.findById(fileId);
  
  if (!file) {
    return res.status(404).json({
      success: false,
      message: 'File not found'
    });
  }

  res.json({
    success: true,
    data: {
      fileId: file._id,
      ocrStatus: file.ocrStatus || 'pending',
      extractedText: file.extractedText || null,
      processedAt: file.ocrProcessedAt || null
    }
  });
}));

export default router;
