import Event from '../models/Event.js';
// Prefer ImageBB for images, but fall back to Cloudinary storageService when file has path
import { uploadFile as uploadImageBB, deleteFile as deleteImageBB } from '../services/imageBBService.js';
import { uploadFile as uploadStorage, deleteFile as deleteStorage } from '../services/storageService.js';
import fs from 'fs';

// Get all events for admin
export const getAllEventsAdmin = async (req, res) => {
  try {
    const events = await Event.find({}).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      events,
      message: 'Events retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events'
    });
  }
};

// Get active events for public display
export const getActiveEvents = async (req, res) => {
  try {
    const events = await Event.find({ isActive: true }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      events,
      message: 'Active events retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching active events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active events'
    });
  }
};

// Create new event
export const createEvent = async (req, res) => {
  try {
    console.log('🎯 Creating new event...');
    console.log('Request body:', { description: req.body.description, sectionTitle: req.body.sectionTitle });
    console.log('File info:', req.file ? { 
      filename: req.file.originalname, 
      size: req.file.size, 
      mimetype: req.file.mimetype 
    } : 'No file provided');
    
    const { description, sectionTitle } = req.body;
    
    if (!description || !req.file) {
      console.log('❌ Validation failed: Missing description or file');
      return res.status(400).json({
        success: false,
        message: 'Event description and image are required'
      });
    }

    console.log('📤 Starting image upload...');
    let uploadResult;
    try {
      // If multer saved to disk (has path), use storageService (Cloudinary)
      if (req.file.path) {
        uploadResult = await uploadStorage(req.file, 'events');
        // Normalize result fields to match ImageBB structure
        uploadResult = {
          secure_url: uploadResult.fileUrl,
          public_id: uploadResult.publicId
        };
      } else {
        // Otherwise use ImageBB (expects buffer)
        uploadResult = await uploadImageBB(req.file, 'events');
      }
    } catch (uploadErr) {
      console.error('❌ Image upload failed:', uploadErr.message);
      throw uploadErr;
    }
    console.log('✅ Image uploaded successfully:', uploadResult.secure_url);
    
    const newEvent = new Event({
      description: description.trim(),
      sectionTitle: sectionTitle ? sectionTitle.trim() : '🎉 Current Events',
      imageUrl: uploadResult.secure_url,
      imagePublicId: uploadResult.public_id,
      createdBy: req.user.email,
      isActive: true
    });

    console.log('💾 Saving event to database...');
    await newEvent.save();
    console.log('✅ Event saved successfully with ID:', newEvent._id);

    res.status(201).json({
      success: true,
      event: newEvent,
      message: 'Event created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating event:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json({
      success: false,
      message: 'Failed to create event'
    });
  }
};

// Update event
export const updateEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { description, sectionTitle, isActive } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Update fields
    if (description !== undefined) event.description = description.trim();
    if (sectionTitle !== undefined) event.sectionTitle = sectionTitle.trim();
    if (isActive !== undefined) event.isActive = isActive;
    
    // Handle image update if new file is provided
    if (req.file) {
      // Delete old image from whichever provider was used
      try {
        if (event.imagePublicId?.startsWith('https://')) {
          await deleteImageBB(event.imagePublicId);
        } else {
          await deleteStorage(event.imagePublicId);
        }
      } catch (delErr) {
        console.warn('⚠️ Failed to delete previous image (continuing):', delErr.message);
      }
      
      // Upload new image
      let uploadResult;
      if (req.file.path) {
        const r = await uploadStorage(req.file, 'events');
        uploadResult = { secure_url: r.fileUrl, public_id: r.publicId };
      } else {
        uploadResult = await uploadImageBB(req.file, 'events');
      }
      event.imageUrl = uploadResult.secure_url;
      event.imagePublicId = uploadResult.public_id;
    }

    event.updatedAt = new Date();
    await event.save();

    res.json({
      success: true,
      event,
      message: 'Event updated successfully'
    });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update event'
    });
  }
};

// Delete event
export const deleteEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    console.log('🗑️ DELETION DEBUG - Event found:', {
      id: event._id,
      name: event.name,
      imageUrl: event.imageUrl,
      imagePublicId: event.imagePublicId,
      imagePublicIdType: typeof event.imagePublicId,
      imagePublicIdLength: event.imagePublicId?.length,
      isValidDeleteUrl: event.imagePublicId?.startsWith('https://ibb.co/')
    });

    // Delete image from ImageBB first (if exists)
    if (event.imagePublicId) {
      try {
        console.log('🖼️ DELETION DEBUG - Attempting to delete image from ImageBB...');
        console.log('🔗 Delete URL being used:', event.imagePublicId);
        
        const deleteResult = await deleteFile(event.imagePublicId);
        console.log('✅ DELETION DEBUG - Image deletion result:', deleteResult);
      } catch (imageError) {
        console.error('❌ DELETION DEBUG - Image deletion failed:', {
          error: imageError.message,
          stack: imageError.stack,
          deleteUrl: event.imagePublicId
        });
        // Continue with event deletion even if image deletion fails
        // This prevents events from becoming "undeletable" due to image issues
      }
    } else {
      console.log('ℹ️ DELETION DEBUG - No image to delete (imagePublicId is empty)');
    }
    
    // Delete event from database
    await Event.findByIdAndDelete(eventId);
    console.log('✅ DELETION DEBUG - Event deleted from database successfully');

    res.json({
      success: true,
      message: 'Event and associated image deleted successfully'
    });
  } catch (error) {
    console.error('❌ DELETION DEBUG - Error deleting event:', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: 'Failed to delete event: ' + error.message
    });
  }
};

// Toggle event active status
export const toggleEventStatus = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    event.isActive = !event.isActive;
    event.updatedAt = new Date();
    await event.save();

    res.json({
      success: true,
      event,
      message: `Event ${event.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Error toggling event status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle event status'
    });
  }
};