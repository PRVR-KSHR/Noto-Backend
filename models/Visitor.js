import mongoose from 'mongoose';

const visitorSchema = new mongoose.Schema({
  page: {
    type: String,
    default: '/'
  },
  visitedAt: {
    type: Date,
    default: Date.now
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
    default: ''
  }
}, {
  timestamps: false
});

// Auto-delete records older than 90 days
visitorSchema.index({ visitedAt: 1 }, { expireAfterSeconds: 7776000 });

export default mongoose.model('Visitor', visitorSchema);
