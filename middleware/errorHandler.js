// Centralized error and 404 handling
import logger from '../utils/logger.js';

// 404 Not Found handler
export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
};

// General error handler
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';

  // Log the error (stack in non-production only)
  if (process.env.NODE_ENV === 'production') {
    logger.error('[Error]', { message: err.message, status, code });
  } else {
    logger.error(err.stack || err);
  }

  res.status(status).json({
    success: false,
    message: err.message || 'Something went wrong',
    code,
    ...(process.env.NODE_ENV !== 'production' && err.stack ? { stack: err.stack } : {}),
  });
};

export default errorHandler;
