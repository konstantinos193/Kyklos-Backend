const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth');

const BlogModel = require('../models/BlogModel');
const StudentModel = require('../models/StudentModel');
const NewsletterModel = require('../models/NewsletterModel');

// Apply authentication middleware to all routes
router.use(verifyToken);
router.use(isAdmin);

// GET /api/admin/stats - Aggregate real stats
router.get('/', async (req, res) => {
  try {
    // Check if models are available and database is connected
    const { getDB } = require('../config/database');
    const db = getDB();
    
    if (!db) {
      return res.status(503).json({ 
        success: false, 
        message: 'Database not connected' 
      });
    }

    const [totalUsers, totalBlogs, totalSubscribers, viewsAgg] = await Promise.all([
      StudentModel.count({}).catch(() => 0),
      BlogModel.count({ status: 'published' }).catch(() => 0),
      NewsletterModel.count({ isActive: true }).catch(() => 0),
      (async () => {
        try {
          const agg = await BlogModel.getCollection().aggregate([
            { $group: { _id: null, totalViews: { $sum: { $ifNull: ['$views', 0] } } } }
          ]).toArray();
          return agg;
        } catch (e) {
          return [{ totalViews: 0 }];
        }
      })()
    ]);

    const totalViews = Array.isArray(viewsAgg) && viewsAgg.length > 0 ? (viewsAgg[0].totalViews || 0) : 0;

    return res.status(200).json({
      success: true,
      data: {
        totalUsers: totalUsers || 0,
        totalBlogs: totalBlogs || 0,
        totalSubscribers: totalSubscribers || 0,
        totalViews: totalViews || 0
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
