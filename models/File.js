import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  fileName: { type: String, required: true },
  fileUrl: { type: String, required: true },
  fileType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  extractedText: { type: String, default: '' }, // ✅ NEW: Store extracted text content
  
  // Storage metadata
  storage: {
    provider: { type: String, enum: ['cloudinary', 'r2'], default: 'cloudinary' },
    publicId: { type: String, required: true }, // Cloudinary public_id or R2 key
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
    course: { type: String, required: true, trim: true }
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
    verifiedBy: { type: String }, // Admin UID who verified/rejected
    verifiedAt: { type: Date },
    rejectionReason: { type: String, trim: true } // Reason for rejection
  },
  
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
