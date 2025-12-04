import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import adminRoutes from './routes/admin.js';
import donationRoutes from './routes/donations.js';
import eventRoutes from './routes/events.js';
import messageRoutes from './routes/messages.js';
import ocrRoutes from './routes/ocr.js'; // NEW: OCR status route
// import professorRoutes from './routes/professors.js'; // REMOVE: this static import crashes if model is missing
import materialManagementRoutes from './routes/materialManagement.js'; // NEW: Material management routes

// Import routes
import authRoutes from './routes/auth.js';
import fileRoutes from './routes/files.js';
import userRoutes from './routes/users.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import logger from './utils/logger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust proxy (needed when behind reverse proxies like Nginx/Heroku)
app.set('trust proxy', 1);
// Hide X-Powered-By header
app.disable('x-powered-by');

// Security headers (Helmet)
app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginEmbedderPolicy: false,
  // API server; we don't need CSP here; set to false to avoid accidental blocks
  contentSecurityPolicy: false,
}));

// CORS configuration - env-driven allowlist
const parseOrigins = (value) => {
  if (!value) return [];
  
  // Support both comma-separated and || separated values
  const separator = value.includes('||') ? '||' : ',';
  
  return value
    .split(separator)
    .map(o => o.trim())
    .filter(Boolean)
    .map(url => {
      // Ensure URLs have proper protocol
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return `https://${url}`;
      }
      return url;
    });
};

const corsAllowlist = [
  ...parseOrigins(process.env.CORS_ORIGINS),
  ...parseOrigins(process.env.FRONTEND_URL)
];

// Add development localhost if not already included
if (NODE_ENV === 'development' && !corsAllowlist.includes('http://localhost:5173')) {
  corsAllowlist.push('http://localhost:5173');
}
if (NODE_ENV === 'development' && !corsAllowlist.includes('http://localhost:5174')) {
  corsAllowlist.push('http://localhost:5174');
}

// Log CORS configuration for debugging
console.log('🔒 CORS Configuration:');
console.log('   Allowed origins:', corsAllowlist);
console.log('   Environment:', NODE_ENV);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server (no origin) and allowlisted origins
    if (!origin || corsAllowlist.includes(origin)) return callback(null, true);
    
    // Log rejected origins for debugging
    console.warn(`⚠️  CORS rejected origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
// Preflight
app.options(/.*/, cors(corsOptions));

// Enable gzip compression for all responses
app.use(compression());

// Prevent HTTP Parameter Pollution
app.use(hpp());

// Use 'combined' for production, 'dev' for development
const logFormat = NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(logFormat, { stream: logger.stream }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Basic rate limiting
const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000); // 15 minutes
const maxReq = Number(process.env.RATE_LIMIT_MAX || 100);
app.use(rateLimit({ windowMs, max: maxReq, standardHeaders: true, legacyHeaders: false }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes); 
app.use('/api/donations', donationRoutes); 
app.use('/api/events', eventRoutes); 
app.use('/api/messages', messageRoutes);
app.use('/api/ocr', ocrRoutes); // NEW: OCR status endpoint
// app.use('/api/professors', professorRoutes); // REMOVE: will register below if available
app.use('/api/materials', materialManagementRoutes); // NEW: Material management endpoints

// ✅ Safe, optional registration of professor routes (prevents crash if model/file missing)
try {
  const { default: professorRoutes } = await import('./routes/professors.js');
  app.use('/api/professors', professorRoutes);
  console.log('✅ Professor routes registered');
} catch (err) {
  console.warn('⚠️ Professor routes disabled:', err.message);
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    message: 'NATO API is running!',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV
  });
});

// 404 and error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Connect to MongoDB
mongoose.set('strictQuery', true);
mongoose.connect(process.env.MONGODB_URI, {} )
  .then(() => {
    logger.info('✅ Connected to MongoDB');
    app.listen(PORT, () => {
      logger.info(`🚀 NATO Server running on port ${PORT}`);
      logger.info(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    });
  })
  .catch((error) => {
    logger.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

// Global process error handlers
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
});