import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  fileName: { type: String, required: true },
  fileUrl: { type: String, required: true },
  fileType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  
  // ✅ NEW: Store extracted text for chatbot (cached for performance)
  extractedText: { type: String, default: null },
  extractionStatus: { 
    type: String, 
    enum: ['pending', 'success', 'failed', 'not-required'], 
    default: 'pending' 
  },
  extractionError: { type: String, default: null },
  
  // Storage metadata
  storage: {
    provider: { type: String, enum: ['r2', 'filen'], default: 'filen' },
    publicId: { type: String, required: true }, // R2 key or Filen UUID
  },
  
  category: {
    type: { type: String, enum: ['notes', 'assignments', 'practical', 'prevquestionpaper', 'researchpaper'], required: true },
    branch: { type: String, required: true },
    semester: { type: String, required: true },
    subject: { type: String, required: true, trim: true }
  },
  
  uploadedBy: { type: String, required: true, index: true }, // Firebase UID
  
  metadata: {
    collegeName: { type: String, required: true, trim: true },
    professorName: { type: String, trim: true },
    year: { type: Number, required: true },
    course: { type: String, required: true, trim: true },
    documentType: { type: String, enum: ['typed', 'handwritten'], default: 'typed' } // NEW: Document type for AI selection
  },
  
  stats: {
    downloadCount: { type: Number, default: 0, min: 0 },
    likes: { type: Number, default: 0, min: 0 },
    views: { type: Number, default: 0, min: 0 },
    starCount: { type: Number, default: 0, min: 0 }
  },
  
  moderation: {
    approved: { type: Boolean, default: true },
    flagged: { type: Boolean, default: false },
    moderatedBy: { type: String },
    moderatedAt: { type: Date }
  },
  
  // NEW: Admin verification system
  verification: {
    status: { 
      type: String, 
      enum: ['pending', 'verified', 'rejected'], 
      default: 'pending' 
    },
    verifiedBy: { type: String }, // Admin UID or system who verified
    verifiedAt: { type: Date },
    rejectionReason: { type: String, trim: true }, // Reason for rejection
    rejectedBy: { type: String }, // Who rejected (admin or professor_validators)
    rejectedAt: { type: Date }, // When it was rejected
    adminVerified: { type: Boolean, default: false },       // ✅ NEW: Flag for admin verification
    professorVerified: { type: Boolean, default: false }    // ✅ NEW: Flag for professor verification
  },
  
  // NEW: Tagged professors for verification
  taggedProfessors: [{
    professorId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProfessorValidator' },
    professorName: { type: String },
    collegeName: { type: String },
    verificationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    verifiedAt: { type: Date },
    feedback: { type: String }
  }],
  
  // NEW: Material management
  isHidden: { type: Boolean, default: false },
  hiddenAt: { type: Date },
  hiddenBy: { type: String }, // Admin UID who hid it
  hideReason: { type: String }, // Reason for hiding material
  
  tags: [{ type: String, trim: true }],
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true }
});

// Indexes for performance
fileSchema.index({ 'category.type': 1, 'category.branch': 1, 'category.semester': 1 });
fileSchema.index({ 'category.subject': 'text', title: 'text' });
fileSchema.index({ uploadedBy: 1, createdAt: -1 });
fileSchema.index({ 'moderation.approved': 1, createdAt: -1 });
fileSchema.index({ 'verification.status': 1, createdAt: -1 }); // NEW: Index for verification status
fileSchema.index({ tags: 1 });

export default mongoose.model('File', fileSchema);
