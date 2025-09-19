import admin from 'firebase-admin';
import dotenv from 'dotenv';
import logger from './logger.js';

dotenv.config();

if (process.env.NODE_ENV !== 'production') {
  logger.debug('🔧 Initializing Firebase Admin...');
  logger.debug('Project ID:', process.env.FIREBASE_PROJECT_ID);
  logger.debug('Client Email:', process.env.FIREBASE_CLIENT_EMAIL ? 'Found' : 'Missing');
  logger.debug('Private Key:', process.env.FIREBASE_PRIVATE_KEY ? 'Found' : 'Missing');
}

// Check if Firebase is already initialized
const initializeFirebase = () => {
  if (admin.apps.length) {
    return; // Already initialized
  }

  try {
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    // Validate required fields
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      logger.error('❌ Firebase Admin initialization failed: Missing Firebase Admin SDK credentials in environment variables');
      logger.warn('⚠️  Server will continue running but Firebase features will be unavailable');
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });

    logger.info('✅ Firebase Admin initialized successfully');
  } catch (error) {
    logger.error('❌ Firebase Admin initialization failed:', error.message);
    logger.warn('⚠️  Server will continue running but Firebase features will be unavailable');
  }
};

// Initialize Firebase
initializeFirebase(); // FIX: Added missing closing brace

export const verifyIdToken = async (idToken) => {
  try {
    logger.debug('🔍 Verifying ID token...');
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    logger.debug('✅ Token verification successful');
    return decodedToken;
  } catch (error) {
    logger.error('❌ Token verification failed:', error.message);
    throw new Error('Invalid token: ' + error.message);
  }
}; // FIX: Added missing closing brace

export default admin;
