import express from 'express';
import { googleAuth, getProfile, updateProfile, logout, deleteAccount } from '../controllers/authController.js';
import { authenticateUser } from '../middleware/auth.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = express.Router();

// Public routes
router.post('/google', asyncHandler(googleAuth));

// Protected routes
router.get('/profile', authenticateUser, asyncHandler(getProfile));
router.put('/profile', authenticateUser, asyncHandler(updateProfile));
router.post('/logout', authenticateUser, asyncHandler(logout));
router.delete('/account', authenticateUser, asyncHandler(deleteAccount));

export default router;
