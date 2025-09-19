import express from 'express';
import { getActiveEvents } from '../controllers/eventController.js';

const router = express.Router();

// Public route to get active events
router.get('/active', getActiveEvents);

export default router;