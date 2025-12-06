import mongoose from 'mongoose';

const activeSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  page: {
    type: String,
    default: '/'
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false
});

// Auto-delete inactive sessions after 10 minutes
activeSessionSchema.index({ lastActive: 1 }, { expireAfterSeconds: 600 });

export default mongoose.model('ActiveSession', activeSessionSchema);
