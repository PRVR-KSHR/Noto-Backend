import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  // User Information
  userEmail: {
    type: String,
    required: true,
    trim: true
  },
  userName: {
    type: String,
    required: true,
    trim: true
  },
  
  // Message Content
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  category: {
    type: String,
    required: true,
    enum: ['event_request', 'feedback', 'review', 'bug_report', 'feature_request', 'general', 'other'],
    default: 'general'
  },
  
  // Status Management
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'resolved'],
    default: 'pending'
  },
  
  // Admin Response
  adminResponse: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  respondedBy: {
    type: String, // Admin email who responded
    trim: true
  },
  respondedAt: {
    type: Date
  },
  
  // Priority and Tags
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  tags: [{
    type: String,
    trim: true
  }],
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Additional Metadata
  isRead: {
    type: Boolean,
    default: false
  },
  userNotified: {
    type: Boolean,
    default: false
  }
});

// Update the updatedAt field before saving
messageSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Add indexes for efficient querying
messageSchema.index({ userEmail: 1, createdAt: -1 });
messageSchema.index({ status: 1, createdAt: -1 });
messageSchema.index({ category: 1, status: 1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;