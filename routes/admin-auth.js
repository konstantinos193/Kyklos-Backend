const express = require('express');
const { body, validationResult } = require('express-validator');
const { generateToken } = require('../middleware/auth');
const AdminModel = require('../models/AdminModel');
const router = express.Router();

// POST /api/admin/auth/create - Create new admin (for seeding)
router.post('/create', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').notEmpty().trim().withMessage('Name is required'),
  body('role').optional().isIn(['super_admin', 'admin', 'moderator']).withMessage('Invalid role')
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

    const { email, password, name, role = 'admin', isActive = true, permissions } = req.body;

    // Check if admin already exists
    const existingAdmin = await AdminModel.findByEmail(email);
    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: 'Admin with this email already exists'
      });
    }

    // Create admin user
    const adminData = {
      email,
      password,
      name,
      role,
      isActive,
      permissions: permissions || {
        students: { create: true, read: true, update: true, delete: true },
        blog: { create: true, read: true, update: true, delete: true },
        newsletter: { create: true, read: true, update: true, delete: true },
        settings: { read: true, update: true }
      }
    };

    const admin = await AdminModel.create(adminData);

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      data: {
        admin: AdminModel.getPublicProfile(admin)
      }
    });
  } catch (error) {
    console.error('Admin creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /api/admin/auth/login - Admin login
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
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
    
    // Normalize email (lowercase) manually instead of using normalizeEmail()
    // This prevents issues with emails like grkyklos-@hotmail.gr
    const normalizedEmail = email.toLowerCase().trim();

    // Find admin by email
    const admin = await AdminModel.findByEmail(normalizedEmail);
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
    const isValidPassword = await AdminModel.comparePassword(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await AdminModel.updateLastLogin(admin._id);

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
      admin: AdminModel.getPublicProfile(admin),
      token
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
          name: decoded.name,
          role: decoded.role
        }
      }
    });
  } catch (error) {
    console.error('Token verification error in /verify:', error.message);
    res.status(401).json({
      success: false,
      message: 'Invalid token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
