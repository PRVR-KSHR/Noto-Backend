import mongoose from 'mongoose';

const visitorSchema = new mongoose.Schema({
  page: {
    type: String,
    default: '/'
  },
  visitedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  visitDate: {
    type: Date,
    // Store as date without time for grouping by day
    index: true
  },
  userAgent: {
    type: String,
    default: ''
  },
  ip: {
    type: String,
    default: '',
    index: true
  }
}, {
  timestamps: false
});

// Create compound index for efficient queries
visitorSchema.index({ visitDate: 1, ip: 1 });
visitorSchema.index({ page: 1, visitDate: 1 });

// Auto-delete records older than 90 days to save storage
visitorSchema.index({ visitedAt: 1 }, { expireAfterSeconds: 7776000 });

export default mongoose.model('Visitor', visitorSchema);
