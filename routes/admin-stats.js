const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth');

const Blog = require('../models/Blog');
const Student = require('../models/Student');
const Newsletter = require('../models/Newsletter');

// Apply authentication middleware to all routes
router.use(verifyToken);
router.use(isAdmin);

// GET /api/admin/stats - Aggregate real stats
router.get('/', async (req, res) => {
  try {
    const [totalUsers, totalBlogs, totalSubscribers, viewsAgg] = await Promise.all([
      Student.countDocuments({}),
      Blog.countDocuments({ status: 'published' }),
      Newsletter.countDocuments({ isActive: true }),
      Blog.aggregate([
        { $group: { _id: null, totalViews: { $sum: { $ifNull: ['$views', 0] } } } }
      ])
    ]);

    const totalViews = Array.isArray(viewsAgg) && viewsAgg.length > 0 ? (viewsAgg[0].totalViews || 0) : 0;

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalBlogs,
        totalSubscribers,
        totalViews
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
