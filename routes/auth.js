const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const StudentModel = require('../models/StudentModel');
const router = express.Router();

/**
 * @route POST /api/auth/student-login
 * @desc Student login with studentId or uniqueKey
 * @access Public
 */
router.post('/student-login', [
  body('studentId').optional().trim().isLength({ min: 3 }).withMessage('Invalid student id'),
  body('uniqueKey').optional().trim()
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

    const { studentId, uniqueKey } = req.body;
    let student = null;
    
    // Try to find student by studentId first, then by uniqueKey
    // This handles both cases: when studentId field exists and when students use uniqueKey to login
    if (studentId) {
      student = await StudentModel.findByStudentId(studentId);
      // If not found by studentId, try to find by uniqueKey (students might use uniqueKey as login)
      if (!student) {
        student = await StudentModel.findByUniqueKey(studentId);
      }
    } else if (uniqueKey) {
      student = await StudentModel.findByUniqueKey(uniqueKey);
    } else {
      return res.status(400).json({ success: false, message: 'Απαιτείται κωδικός μαθητή' });
    }

    if (!student) {
      return res.status(401).json({
        success: false,
        message: 'Μη έγκυρα στοιχεία. Ελέγξτε τον κωδικό μαθητή και δοκιμάστε ξανά.'
      });
    }

    // Check if student is active
    // Default to 'active' if status is not set (for backwards compatibility)
    const studentStatus = student.status || 'active';
    
    if (studentStatus !== 'active') {
      const statusMessages = {
        'inactive': 'ανενεργός',
        'suspended': 'ανασταλμένος',
        'graduated': 'αποφοιτημένος'
      };
      const statusMessage = statusMessages[studentStatus] || 'μη διαθέσιμος';
      
      return res.status(401).json({
        success: false,
        message: `Ο λογαριασμός σας είναι ${statusMessage}. Επικοινωνήστε με το φροντιστήριο.`
      });
    }

    // Update last login
    await StudentModel.updateLastLogin(student._id);

    // Generate JWT token
    const token = jwt.sign(
      {
        studentId: student._id,
        uniqueKey: student.uniqueKey,
        studentCode: student.studentId || null,
        type: 'student'
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return student data (without sensitive information)
    const studentData = {
      _id: student._id,
      uniqueKey: student.uniqueKey,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      phone: student.phone,
      grade: student.grade,
      school: student.school,
      subjects: student.subjects,
      status: student.status,
      registrationDate: student.registrationDate,
      lastLogin: student.lastLogin,
      hasAccessToThemata: student.hasAccessToThemata || false
    };

    res.json({
      success: true,
      message: 'Επιτυχής σύνδεση',
      student: studentData,
      token
    });
  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
    });
  }
});

/**
 * @route POST /api/auth/student-verify
 * @desc Verify student token
 * @access Private (Student)
 */
router.post('/student-verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'student') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    const student = await StudentModel.findById(decoded.studentId);

    if (!student) {
      return res.status(401).json({
        success: false,
        message: 'Student not found'
      });
    }

    if (student.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Account is not active'
      });
    }

    res.json({
      success: true,
      student: {
        _id: student._id,
        uniqueKey: student.uniqueKey,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        phone: student.phone,
        grade: student.grade,
        school: student.school,
        subjects: student.subjects,
        status: student.status,
        registrationDate: student.registrationDate,
        lastLogin: student.lastLogin,
        hasAccessToThemata: student.hasAccessToThemata || false
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
});

/**
 * @route POST /api/auth/student-logout
 * @desc Student logout
 * @access Private (Student)
 */
router.post('/student-logout', async (req, res) => {
  try {
    // In a more sophisticated setup, you might want to blacklist the token
    // For now, we'll just return success
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

module.exports = router;
