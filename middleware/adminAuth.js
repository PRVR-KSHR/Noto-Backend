import { authenticateUser } from './auth.js';
import logger from '../utils/logger.js';

// Read admin emails from environment variable ADMIN_EMAILS (comma-separated)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

// Middleware to check if user is admin
export const requireAdmin = async (req, res, next) => {
  try {
    // First authenticate the user
    await new Promise((resolve, reject) => {
      authenticateUser(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    // Check if user email is in admin list
    const userEmail = req.user.email.toLowerCase();
    
    if (!ADMIN_EMAILS.includes(userEmail)) {
  logger.warn(`❌ Admin access denied for: ${userEmail}`);
      return res.status(403).json({
        success: false,
        message: 'Admin access required. Contact administrator.'
      });
    }

  logger.info(`✅ Admin access granted for: ${userEmail}`);
    next();
  } catch (error) {
  logger.error('❌ Admin auth error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
};

// Helper function to check if user is admin (for frontend)
export const checkAdminStatus = async (req, res, next) => {
  try {
    // First authenticate the user
    await new Promise((resolve, reject) => {
      authenticateUser(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    // Check admin status
    const userEmail = req.user.email.toLowerCase();
  const isAdmin = ADMIN_EMAILS.includes(userEmail);

    req.isAdmin = isAdmin;
    next();
  } catch (error) {
    // If authentication fails, user is not admin
    req.isAdmin = false;
    next();
  }
};
