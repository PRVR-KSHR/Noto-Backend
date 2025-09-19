import Message from '../models/Message.js';

// Create new message (for users)
export const createMessage = async (req, res) => {
  try {
    console.log('📩 Creating message - Request body:', req.body);
    console.log('📩 Creating message - User:', req.user);
    
    const { subject, message, category = 'general' } = req.body;
    const userEmail = req.user?.email;
    const userName = req.user?.name || req.user?.displayName || 'Anonymous';

    console.log('📩 Extracted data:', { userEmail, userName, subject, message, category });

    if (!subject || !message) {
      console.log('❌ Missing required fields:', { subject: !!subject, message: !!message });
      return res.status(400).json({
        success: false,
        message: 'Subject and message are required'
      });
    }

    if (!userEmail) {
      console.log('❌ User email not found in request');
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const newMessage = new Message({
      userEmail,
      userName,
      subject: subject.trim(),
      message: message.trim(),
      category,
      status: 'pending'
    });

    console.log('📩 About to save message:', newMessage);
    await newMessage.save();
    console.log('✅ Message saved successfully:', newMessage._id);

    console.log('📩 New message created:', {
      id: newMessage._id,
      from: userName,
      subject: subject.substring(0, 50) + '...',
      category
    });

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: newMessage
    });
  } catch (error) {
    console.error('❌ Error creating message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
};

// Get user's messages (for profile page)
export const getUserMessages = async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { page = 1, limit = 10, status } = req.query;

    const filter = { userEmail };
    if (status && status !== 'all') {
      filter.status = status;
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-__v');

    const total = await Message.countDocuments(filter);

    res.json({
      success: true,
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching user messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
};

// Get all messages for admin
export const getAllMessages = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, category, priority } = req.query;

    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (category && category !== 'all') filter.category = category;
    if (priority && priority !== 'all') filter.priority = priority;

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-__v');

    const total = await Message.countDocuments(filter);

    // Get statistics
    const stats = await Message.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusStats = {
      pending: 0,
      approved: 0,
      rejected: 0,
      resolved: 0
    };

    stats.forEach(stat => {
      statusStats[stat._id] = stat.count;
    });

    res.json({
      success: true,
      messages,
      stats: statusStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching all messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
};

// Update message status (admin only)
export const updateMessageStatus = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status, adminResponse, priority } = req.body;
    const adminEmail = req.user.email;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Update fields
    if (status) message.status = status;
    if (priority) message.priority = priority;
    if (adminResponse) {
      message.adminResponse = adminResponse.trim();
      message.respondedBy = adminEmail;
      message.respondedAt = new Date();
    }

    message.updatedAt = new Date();
    await message.save();

    console.log('📝 Message status updated:', {
      id: messageId,
      newStatus: status,
      adminEmail,
      hasResponse: !!adminResponse
    });

    res.json({
      success: true,
      message: 'Message updated successfully',
      data: message
    });
  } catch (error) {
    console.error('Error updating message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update message'
    });
  }
};

// Mark message as read
export const markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;

    await Message.findByIdAndUpdate(messageId, { 
      isRead: true,
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Message marked as read'
    });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark message as read'
    });
  }
};

// Delete message (admin only)
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userEmail = req.user.email;
    const isAdmin = req.user.role === 'admin';

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // If user is not admin, they can only delete their own messages
    if (!isAdmin && message.userEmail !== userEmail) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages'
      });
    }

    await Message.findByIdAndDelete(messageId);

    console.log('🗑️ Message deleted:', {
      id: messageId,
      subject: message.subject.substring(0, 50),
      deletedBy: userEmail,
      isAdmin: isAdmin
    });

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message'
    });
  }
};