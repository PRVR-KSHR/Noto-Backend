import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  sectionTitle: {
    type: String,
    trim: true,
    maxlength: 50,
    default: '🎉 Current Events'
  },
  imageUrl: {
    type: String,
    required: true
  },
  imagePublicId: {
    type: String,
    required: true,
    // Note: For ImageBB, this stores the delete URL
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Event = mongoose.model('Event', eventSchema);

export default Event;