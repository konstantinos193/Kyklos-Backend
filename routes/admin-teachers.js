const express = require('express');
const { verifyToken, isAdmin } = require('../middleware/auth');
const AdminModel = require('../models/AdminModel');
const router = express.Router();

// GET /api/admin/teachers - List teachers/admin users for permissions UI
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    // Treat all active admins as potential "teachers" for permissions
    const result = await AdminModel.find({ isActive: true }, { limit: 100 });
    const admins = Array.isArray(result?.data) ? result.data : [];
    res.json({
      success: true,
      data: admins.map(AdminModel.getPublicProfile)
    });
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;


