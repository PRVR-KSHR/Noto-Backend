import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import {
  createMessage,
  getUserMessages,
  getAllMessages,
  updateMessageStatus,
  markAsRead,
  deleteMessage
} from '../controllers/messageController.js';

const router = express.Router();

// User routes (require authentication)
router.post('/', authenticateUser, createMessage);
router.get('/my-messages', authenticateUser, getUserMessages);
router.patch('/:messageId/read', authenticateUser, markAsRead);
router.delete('/:messageId', authenticateUser, deleteMessage); // User can delete their own messages

// Admin routes (require admin authentication)
router.get('/admin/all', requireAdmin, getAllMessages);
router.patch('/admin/:messageId/status', requireAdmin, updateMessageStatus);
router.delete('/admin/:messageId', requireAdmin, deleteMessage);

export default router;