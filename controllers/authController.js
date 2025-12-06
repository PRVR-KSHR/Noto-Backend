import User from '../models/User.js';
import { verifyIdToken } from '../utils/firebaseAdmin.js';
import admin from '../utils/firebaseAdmin.js'; // ✅ NEW: Added admin import
import { deleteFile } from '../services/storageService.js'; // ✅ NEW: Added deleteFile import
import File from '../models/File.js'; // ✅ NEW: Added File model import
import logger from '../utils/logger.js';

// Google Login/Register
export const googleAuth = async (req, res) => {
  try {
  logger.debug('🚀 Google auth request received');

    const { idToken } = req.body;

    if (!idToken) {
  logger.warn('❌ No idToken provided');
      return res.status(400).json({
        success: false,
        message: 'Firebase ID token is required'
      });
    }

  logger.debug('🔍 Verifying Firebase token...');

    // Verify the Firebase ID token - FIXED SCOPE
    let decodedToken;
    try {
      decodedToken = await verifyIdToken(idToken);
      console.log('✅ Token verified for user:', decodedToken.email);
    } catch (verifyError) {
  logger.error('❌ Verification failed in controller:', verifyError);
      return res.status(401).json({
        success: false,
        message: 'Invalid Firebase token',
        error: verifyError.message
      });
    }

    // Check if user exists
  logger.debug('🔍 Looking for existing user in database...');
    let user = await User.findOne({ uid: decodedToken.uid });
    let isNewUser = false;

    if (!user) {
  logger.info('➕ Creating new user...');
      
      // Check if user with same email exists (different UID)
      const existingEmailUser = await User.findOne({ email: decodedToken.email });
      if (existingEmailUser) {
  logger.warn('⚠️ User with same email but different UID exists, updating UID...');
        // Update the existing user's UID
        existingEmailUser.uid = decodedToken.uid;
        existingEmailUser.displayName = decodedToken.name || existingEmailUser.displayName;
        existingEmailUser.photoURL = decodedToken.picture || existingEmailUser.photoURL;
        user = await existingEmailUser.save();
        isNewUser = false;
      } else {
        // Create completely new user
        user = new User({
          uid: decodedToken.uid,
          email: decodedToken.email,
          displayName: decodedToken.name || decodedToken.email.split('@')[0],
          photoURL: decodedToken.picture || null,
          role: 'student'
        });
        
        try {
          await user.save();
          logger.info('✅ New user created:', user.email);
          isNewUser = true;
        } catch (saveError) {
          if (saveError.code === 11000) {
            // Duplicate key error - user was created by another request
            logger.warn('⚠️ User already exists (race condition), fetching existing user...');
            user = await User.findOne({ uid: decodedToken.uid });
            if (!user) {
              throw new Error('User creation failed and user not found');
            }
            isNewUser = false;
          } else {
            throw saveError;
          }
        }
      }
    } else {
  logger.debug('✅ Existing user found:', user.email);
      // Update existing user info if changed
      const updateFields = {};
      if (decodedToken.name && decodedToken.name !== user.displayName) {
        updateFields.displayName = decodedToken.name;
      }
      if (decodedToken.picture && decodedToken.picture !== user.photoURL) {
        updateFields.photoURL = decodedToken.picture;
      }
      
      if (Object.keys(updateFields).length > 0) {
        await User.findByIdAndUpdate(user._id, updateFields);
        user = await User.findById(user._id);
  logger.debug('✅ User updated with new info');
      }
    }

    // Update last login time
    user.lastLoginAt = new Date();
    await user.save();

  logger.debug('🎉 Sending success response');
    const responseData = {
      success: true,
      message: isNewUser ? 'Account created successfully' : 'Login successful',
      data: {
        user: {
          id: user._id,
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: user.role,
          branch: user.branch,
          semester: user.semester,
          college: user.college,
          uploadCount: user.uploadCount,
          downloadCount: user.downloadCount
        },
        isNewUser
      }
    };

  logger.debug('Response data prepared');
    return res.status(200).json(responseData);

  } catch (error) {
  logger.error('❌ Google auth error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get current user profile
export const getProfile = async (req, res) => {
  try {
    const user = req.user;
    
    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: user.role,
          branch: user.branch,
          semester: user.semester,
          college: user.college,
          uploadCount: user.uploadCount,
          downloadCount: user.downloadCount,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
};

// Update user profile
export const updateProfile = async (req, res) => {
  try {
    const { branch, semester, college } = req.body;
    const userId = req.user._id;

    const updateFields = {};
    if (branch) updateFields.branch = branch;
    if (semester) updateFields.semester = semester; 
    if (college) updateFields.college = college;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateFields,
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: updatedUser._id,
          uid: updatedUser.uid,
          email: updatedUser.email,
          displayName: updatedUser.displayName,
          photoURL: updatedUser.photoURL,
          role: updatedUser.role,
          branch: updatedUser.branch,
          semester: updatedUser.semester,
          college: updatedUser.college,
          uploadCount: updatedUser.uploadCount,
          downloadCount: updatedUser.downloadCount
        }
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};

// Logout
export const logout = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
};

// ✅ NEW: Delete Account Function (Added from Code 2)
export const deleteAccount = async (req, res) => {
  try {
  logger.info('🗑️ Delete account request for:', req.user.email);
    const userId = req.user._id;
    const firebaseUid = req.user.uid;

    // Step 1: Find and delete all user's files from Filen and database
    const userFiles = await File.find({ uploadedBy: firebaseUid });
  logger.info(`📁 Found ${userFiles.length} files to delete`);

    // Delete files from Filen and database
    for (const file of userFiles) {
      try {
        // Delete from Filen
        await deleteFile(file.storage.publicId, file.storage.provider);
  logger.info(`✅ Deleted from Filen: ${file.title}`);
      } catch (cloudinaryError) {
  logger.error(`❌ Failed to delete from Cloudinary: ${file.title}`, cloudinaryError);
        // Continue with deletion even if Cloudinary fails
      }

      // Delete from database
      await File.findByIdAndDelete(file._id);
  logger.info(`✅ Deleted from database: ${file.title}`);
    }

    // Step 2: Remove user from all bookmarks
    await User.updateMany(
      { bookmarks: { $in: userFiles.map(f => f._id) } },
      { $pull: { bookmarks: { $in: userFiles.map(f => f._id) } } }
    );

    // Step 3: Delete user from MongoDB
    await User.findByIdAndDelete(userId);
  logger.info('✅ User deleted from MongoDB');

    // Step 4: Delete user from Firebase Auth
    try {
      await admin.auth().deleteUser(firebaseUid);
  logger.info('✅ User deleted from Firebase Auth');
    } catch (firebaseError) {
  logger.error('❌ Failed to delete from Firebase Auth:', firebaseError);
      // Don't fail the request if Firebase deletion fails
    }

  logger.info('🎉 Account deletion completed successfully');

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
  logger.error('❌ Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account',
      error: error.message
    });
  }
};
