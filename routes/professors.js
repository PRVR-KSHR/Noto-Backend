import express from 'express';
import ProfessorValidator from '../models/ProfessorValidator.js';
import User from '../models/User.js';
import { authenticateUser } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';

const router = express.Router();

// ✅ 1. Apply as Professor Validator (User submits application)
router.post('/apply', authenticateUser, async (req, res) => {
  try {
    const { fullName, email, collegeName, professorId, subjects } = req.body;
    const userId = req.user.uid; // From Firebase auth middleware

    // Validation
    if (!fullName || !email || !collegeName || !professorId) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // NEW: Validate subjects
    if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one subject is required'
      });
    }

    // Check if user already has a pending or approved application
    const existingApplication = await ProfessorValidator.findOne({
      userId: userId,
      status: { $in: ['pending', 'approved'] }
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: `You already have an active ${existingApplication.status} application`,
        status: existingApplication.status
      });
    }

    // Check if professor ID already exists
    const existingProfessor = await ProfessorValidator.findOne({
      professorId: professorId.trim(),
      status: 'approved'
    });

    if (existingProfessor) {
      return res.status(400).json({
        success: false,
        message: 'This Professor ID is already registered'
      });
    }

    // Create new application
    const application = new ProfessorValidator({
      userId,
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      collegeName: collegeName.trim(),
      professorId: professorId.trim(),
      subjects: subjects.map(s => s.trim()), // NEW: Store subjects
      status: 'pending'
    });

    await application.save();

    res.status(201).json({
      success: true,
      message: 'Professor validator application submitted successfully',
      application
    });
  } catch (error) {
    console.error('Error applying for professor validator:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit application',
      error: error.message
    });
  }
});

// ✅ 2. Get professor's own application status
router.get('/my-application', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.uid;

    const application = await ProfessorValidator.findOne({ userId })
      .populate('reviewedBy', 'username email');

    // Return 200 with null application instead of 404
    // This way axios doesn't treat it as an error
    res.json({
      success: true,
      application: application || null
    });
  } catch (error) {
    console.error('Error fetching application status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch application status',
      error: error.message
    });
  }
});

// ✅ 3. Get list of approved professors (for searching when uploading materials)
router.get('/approved-list', async (req, res) => {
  try {
    const approvedProfessors = await ProfessorValidator.find({ status: 'approved' })
      .select('_id fullName email collegeName professorId')
      .sort({ fullName: 1 });

    res.json({
      success: true,
      professors: approvedProfessors,
      count: approvedProfessors.length
    });
  } catch (error) {
    console.error('Error fetching approved professors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch professors',
      error: error.message
    });
  }
});

// ✅ 4. Search professors by name or college (for upload form autocomplete)
router.get('/search', async (req, res) => {
  try {
    const { query, collegeName, subject } = req.query;

    if (!query || query.trim().length < 1) {
      return res.json({
        success: true,
        professors: []
      });
    }

    const searchRegex = new RegExp(query, 'i');

    // Build filter object - search in name, college, professor ID, and subjects
    const filter = {
      status: 'approved',
      $or: [
        { fullName: searchRegex },
        { collegeName: searchRegex },
        { professorId: searchRegex },
        { subjects: searchRegex } // NEW: Also search in subjects
      ]
    };

    // NEW: Filter by college if provided (partial match - more flexible)
    if (collegeName && collegeName.trim().length > 0) {
      // Create multiple college matching options for flexibility
      const collegeKeywords = collegeName.trim().toLowerCase().split(' ');
      const collegeFilters = collegeKeywords.map(keyword => ({
        collegeName: new RegExp(keyword, 'i')
      }));
      
      if (!filter.$and) filter.$and = [];
      filter.$and.push({ $or: collegeFilters }); // Match any keyword from college name
      
      console.log('College filters:', collegeFilters);
    }

    // NEW: Filter by subject if provided
    if (subject && subject.trim().length > 0) {
      if (!filter.$and) filter.$and = [];
      // For array fields like subjects, use $elemMatch with $regex
      filter.$and.push({ 
        subjects: { $elemMatch: { $regex: subject.trim(), $options: 'i' } }
      });
      
      console.log('Subject filter:', subject.trim());
    }

    console.log('Final filter:', JSON.stringify(filter));

    const professors = await ProfessorValidator.find(filter)
      .select('_id fullName email collegeName professorId subjects')
      .limit(10)
      .sort({ fullName: 1 });

    console.log('Found professors:', professors.length);

    res.json({
      success: true,
      professors,
      count: professors.length
    });
  } catch (error) {
    console.error('Error searching professors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search professors',
      error: error.message
    });
  }
});

// ✅ ADMIN ROUTES

// ✅ 5. Get all pending professor applications (Admin)
router.get('/admin/pending', requireAdmin, async (req, res) => {
  try {
    const applications = await ProfessorValidator.find({ status: 'pending' })
      .populate('userId', 'username email')
      .sort({ appliedAt: -1 });

    res.json({
      success: true,
      applications,
      count: applications.length
    });
  } catch (error) {
    console.error('Error fetching pending applications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
      error: error.message
    });
  }
});

// ✅ 6. Get all professor applications (Admin - with filters)
router.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    const { status = 'all', collegeName = 'all' } = req.query;

    let filter = {};
    if (status !== 'all') filter.status = status;
    if (collegeName !== 'all') filter.collegeName = collegeName;

    const applications = await ProfessorValidator.find(filter)
      .sort({ appliedAt: -1 });

    res.json({
      success: true,
      applications,
      count: applications.length
    });
  } catch (error) {
    console.error('Error fetching all applications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
      error: error.message
    });
  }
});

// ✅ 7. Approve professor application (Admin)
router.patch('/admin/:applicationId/approve', requireAdmin, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const adminId = req.user.uid;

    const application = await ProfessorValidator.findByIdAndUpdate(
      applicationId,
      {
        status: 'approved',
        reviewedBy: adminId,
        reviewedAt: new Date()
      },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    res.json({
      success: true,
      message: 'Professor application approved successfully',
      application
    });
  } catch (error) {
    console.error('Error approving application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve application',
      error: error.message
    });
  }
});

// ✅ 8. Reject professor application (Admin)
router.patch('/admin/:applicationId/reject', requireAdmin, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { rejectionReason } = req.body;
    const adminId = req.user.uid;

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const application = await ProfessorValidator.findByIdAndUpdate(
      applicationId,
      {
        status: 'rejected',
        rejectionReason: rejectionReason.trim(),
        reviewedBy: adminId,
        reviewedAt: new Date()
      },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    res.json({
      success: true,
      message: 'Professor application rejected',
      application
    });
  } catch (error) {
    console.error('Error rejecting application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject application',
      error: error.message
    });
  }
});

// ✅ 9. Get admin dashboard stats
router.get('/admin/stats', requireAdmin, async (req, res) => {
  try {
    const pendingCount = await ProfessorValidator.countDocuments({ status: 'pending' });
    const approvedCount = await ProfessorValidator.countDocuments({ status: 'approved' });
    const rejectedCount = await ProfessorValidator.countDocuments({ status: 'rejected' });

    res.json({
      success: true,
      stats: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        total: pendingCount + approvedCount + rejectedCount
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

// ✅ 10. Delete/Revoke professor status (Admin) - Revert user to normal status
router.delete('/admin/:applicationId/delete', requireAdmin, async (req, res) => {
  try {
    const { applicationId } = req.params;

    // Validate applicationId format
    if (!applicationId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid application ID format'
      });
    }

    // Find the application to get userId and check if approved
    const application = await ProfessorValidator.findById(applicationId);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    if (application.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Only approved professor status can be revoked'
      });
    }

    // Delete the professor validator record
    const deletedApplication = await ProfessorValidator.findByIdAndDelete(applicationId);

    if (!deletedApplication) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete professor status'
      });
    }

    res.json({
      success: true,
      message: 'Professor status revoked successfully. User reverted to normal status.',
      deletedApplication
    });
  } catch (error) {
    console.error('Error deleting professor status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to revoke professor status',
      error: error.message
    });
  }
});

export default router;
