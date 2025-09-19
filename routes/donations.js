import express from 'express';
import { getDonations } from '../controllers/donationController.js';

const router = express.Router();

// ✅ PUBLIC: Get donations for marquee
router.get('/', getDonations);

export default router;
