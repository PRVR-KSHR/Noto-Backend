import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  uid: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true 
  },
  displayName: { 
    type: String, 
    required: true,
    trim: true 
  },
  photoURL: { 
    type: String,
    default: null 
  },
  branch: { 
    type: String,
    enum: [
      'Computer Science', 'Information Technology', 'Electronics & Communication',
      'Mechanical Engineering', 'Civil Engineering', 'Electrical Engineering',
      'Chemical Engineering', 'Aerospace Engineering', 'Biotechnology',
      'Environmental Engineering', 'Industrial Engineering', 'Other'
    ]
  },
  semester: { 
    type: String,
    enum: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']
  },
  college: { 
    type: String,
    trim: true 
  },
  role: { 
    type: String, 
    enum: ['student', 'admin', 'moderator'], 
    default: 'student' 
  },
  uploadCount: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  downloadCount: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  isActive: {
    type: Boolean,
    default: true
  },
  bookmarks: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'File'
}],
  stars: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'File'
}],
  lastLoginAt: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index for better performance and uniqueness
userSchema.index({ email: 1, uid: 1 }, { unique: true });
userSchema.index({ branch: 1, semester: 1 });
userSchema.index({ role: 1 });

// Virtual for checking if profile is complete
userSchema.virtual('profileComplete').get(function() {
  return !!(this.branch && this.semester && this.college);
});

export default mongoose.model('User', userSchema);
