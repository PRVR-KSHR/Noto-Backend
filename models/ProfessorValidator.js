import mongoose from 'mongoose';

const professorValidatorSchema = new mongoose.Schema(
  {
    userId: {
      type: String, // Firebase UID
      required: true,
      unique: true // One application per user
    },
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true
    },
    collegeName: {
      type: String,
      required: true,
      trim: true
    },
    professorId: {
      type: String,
      required: true,
      unique: true, // Ensure unique professor ID across system
      trim: true
    },
    // NEW: Subjects the professor teaches (for filtering during upload)
    subjects: {
      type: [String],
      default: [],
      trim: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    // For admin review
    reviewedBy: {
      type: String, // Firebase UID of the admin who reviewed
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    rejectionReason: {
      type: String,
      default: null,
      trim: true
    },
    // Metadata
    appliedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Index for queries
professorValidatorSchema.index({ status: 1, appliedAt: -1 });
professorValidatorSchema.index({ collegeName: 1 });
professorValidatorSchema.index({ email: 1 });

// Method to get approved professors only
professorValidatorSchema.statics.getApprovedProfessors = function() {
  return this.find({ status: 'approved' }).select('userId fullName email collegeName professorId');
};

// Method to get pending applications for admin
professorValidatorSchema.statics.getPendingApplications = function() {
  return this.find({ status: 'pending' })
    .sort({ appliedAt: -1 });
};

export default mongoose.model('ProfessorValidator', professorValidatorSchema);
