import mongoose from 'mongoose';

const donationSchema = new mongoose.Schema({
  donorName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  amount: {
    type: Number,
    required: true,
    min: 1,
    max: 1000000 // Max 10 lakh rupees
  },
  isActive: {
    type: Boolean,
    default: true
  },
  addedBy: {
    type: String,
    required: true // Admin's Firebase UID
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true }
});

// Index for better performance
donationSchema.index({ isActive: 1, createdAt: -1 });
donationSchema.index({ addedBy: 1 });

export default mongoose.model('Donation', donationSchema);
