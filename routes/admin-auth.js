const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../middleware/auth');
const router = express.Router();

// Mock admin credentials (in production, store in database)
const ADMIN_CREDENTIALS = {
  email: process.env.ADMIN_EMAIL || 'admin@kyklosedu.gr',
  password: process.env.ADMIN_PASSWORD || 'admin123',
  id: 'admin-001',
  name: 'System Administrator'
};

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

    // Check credentials
    if (email !== ADMIN_CREDENTIALS.email) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // In production, use bcrypt to compare hashed passwords
    const isValidPassword = password === ADMIN_CREDENTIALS.password;
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = generateToken(ADMIN_CREDENTIALS);

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
        admin: {
          id: ADMIN_CREDENTIALS.id,
          email: ADMIN_CREDENTIALS.email,
          name: ADMIN_CREDENTIALS.name
        },
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
