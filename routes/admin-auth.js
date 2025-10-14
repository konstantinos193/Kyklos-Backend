const express = require('express');
const { body, validationResult } = require('express-validator');
const { generateToken } = require('../middleware/auth');
const Admin = require('../models/Admin');
const router = express.Router();

// POST /api/admin/auth/login - Admin login
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find admin by email
    const admin = await Admin.findByEmail(email);
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Compare password
    const isValidPassword = await admin.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await admin.updateLastLogin();

    // Generate JWT token
    const token = generateToken({
      id: admin._id,
      email: admin.email,
      name: admin.name,
      role: admin.role
    });

    // Set cookie
    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        admin: admin.getPublicProfile(),
        token
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /api/admin/auth/logout - Admin logout
router.post('/logout', (req, res) => {
  res.clearCookie('adminToken');
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// GET /api/admin/auth/verify - Verify admin token
router.get('/verify', (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '') || 
                req.cookies?.adminToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided'
    });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    
    res.json({
      success: true,
      data: {
        admin: {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role
        }
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

module.exports = router;
