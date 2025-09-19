import { verifyIdToken } from '../utils/firebaseAdmin.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

export const authenticateUser = async (req, res, next) => {
  try {
  logger.debug('🔐 Authenticating user...');
    
    const authHeader = req.headers.authorization || req.headers.Authorization;
  logger.debug('Auth header:', authHeader ? 'Present' : 'Missing');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
  logger.warn('❌ No valid auth header found');
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const idToken = authHeader.split('Bearer ')[1];
  logger.debug('Extracted token length:', idToken.length);

    // Verify Firebase token
    const decodedToken = await verifyIdToken(idToken);
  logger.debug('✅ Token verified for user:', decodedToken.email);

    // Find user in database (DON'T CREATE HERE)
    const user = await User.findOne({ uid: decodedToken.uid });
    
    if (!user) {
  logger.warn('❌ User not found in database');
      return res.status(401).json({
        success: false,
        message: 'User not found. Please login again.'
      });
    }

  logger.debug('✅ User found in database:', user.email);
    req.user = user;
    req.firebaseUser = decodedToken;
    next();

  } catch (error) {
  logger.error('❌ Authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      error: error.message
    });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await verifyIdToken(idToken);
      
      const user = await User.findOne({ uid: decodedToken.uid });
      if (user) {
        req.user = user;
        req.firebaseUser = decodedToken;
      }
    }
    next();
  } catch (error) {
    // Continue without authentication
  logger.warn('Optional auth failed, continuing...', error.message);
    next();
  }
};

export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }
    
    next();
  };
};
