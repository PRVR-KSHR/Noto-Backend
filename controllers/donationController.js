import Donation from '../models/Donation.js';

// ✅ PUBLIC: Get all active donations (for marquee)
export const getDonations = async (req, res) => {
  try {
    const donations = await Donation.find({ isActive: true })
      .select('donorName amount createdAt')
      .sort({ createdAt: -1 })
      .limit(50) // Limit to prevent too much data
      .lean();

    console.log(`✅ Retrieved ${donations.length} donations`);
    
    res.json({
      success: true,
      data: donations
    });
  } catch (error) {
    console.error('❌ Get donations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch donations'
    });
  }
};

// ✅ ADMIN ONLY: Get all donations with full details
export const getAllDonationsAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const donations = await Donation.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Donation.countDocuments();

    res.json({
      success: true,
      data: {
        donations,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          totalItems: total
        }
      }
    });
  } catch (error) {
    console.error('❌ Get admin donations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch donations'
    });
  }
};

// ✅ ADMIN ONLY: Add new donation
export const addDonation = async (req, res) => {
  try {
    const { donorName, amount, notes } = req.body;

    // Validation
    if (!donorName || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Donor name and amount are required'
      });
    }

    if (amount < 1 || amount > 1000000) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be between ₹1 and ₹10,00,000'
      });
    }

    // Create donation
    const donation = new Donation({
      donorName: donorName.trim(),
      amount: parseInt(amount),
      notes: notes ? notes.trim() : '',
      addedBy: req.user.uid
    });

    await donation.save();

    console.log(`✅ New donation added by ${req.user.email}: ${donorName} - ₹${amount}`);

    res.status(201).json({
      success: true,
      message: 'Donation added successfully',
      data: donation
    });
  } catch (error) {
    console.error('❌ Add donation error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid donation data',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add donation'
    });
  }
};

// ✅ ADMIN ONLY: Update donation
export const updateDonation = async (req, res) => {
  try {
    const { donationId } = req.params;
    const { donorName, amount, notes, isActive } = req.body;

    const donation = await Donation.findById(donationId);
    
    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }

    // Update fields
    if (donorName !== undefined) donation.donorName = donorName.trim();
    if (amount !== undefined) donation.amount = parseInt(amount);
    if (notes !== undefined) donation.notes = notes.trim();
    if (isActive !== undefined) donation.isActive = Boolean(isActive);

    await donation.save();

    console.log(`✅ Donation updated by ${req.user.email}: ${donation.donorName}`);

    res.json({
      success: true,
      message: 'Donation updated successfully',
      data: donation
    });
  } catch (error) {
    console.error('❌ Update donation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update donation'
    });
  }
};

// ✅ ADMIN ONLY: Delete donation
export const deleteDonation = async (req, res) => {
  try {
    const { donationId } = req.params;

    const donation = await Donation.findByIdAndDelete(donationId);
    
    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }

    console.log(`✅ Donation deleted by ${req.user.email}: ${donation.donorName} - ₹${donation.amount}`);

    res.json({
      success: true,
      message: 'Donation deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete donation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete donation'
    });
  }
};

// ✅ ADMIN ONLY: Get donation statistics
export const getDonationStats = async (req, res) => {
  try {
    const [totalStats, recentStats] = await Promise.all([
      Donation.aggregate([
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            totalDonations: { $sum: 1 },
            activeDonations: {
              $sum: { $cond: ['$isActive', 1, 0] }
            }
          }
        }
      ]),
      Donation.find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('donorName amount createdAt')
        .lean()
    ]);

    const stats = totalStats[0] || {
      totalAmount: 0,
      totalDonations: 0,
      activeDonations: 0
    };

    res.json({
      success: true,
      data: {
        ...stats,
        recentDonations: recentStats
      }
    });
  } catch (error) {
    console.error('❌ Get donation stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch donation statistics'
    });
  }
};
