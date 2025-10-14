const express = require('express');
const { body, validationResult, query } = require('express-validator');
const StudentModel = require('../models/StudentModel');
const keyGenerator = require('../utils/keyGenerator');
const { verifyToken, isAdmin } = require('../middleware/auth');
const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyToken);
router.use(isAdmin);

/**
 * @route GET /api/admin/students
 * @desc Get all students with pagination and filtering
 * @access Admin
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('grade').optional().isString().withMessage('Grade must be a string'),
  query('status').optional().isIn(['active', 'inactive', 'graduated', 'suspended']).withMessage('Invalid status'),
  query('sortBy').optional().isIn(['uniqueKey', 'firstName', 'lastName', 'grade', 'registrationDate']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
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

    const {
      page = 1,
      limit = 20,
      search = '',
      grade = '',
      status = '',
      sortBy = 'registrationDate',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { uniqueKey: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { school: { $regex: search, $options: 'i' } }
      ];
    }

    if (grade) {
      filter.grade = grade;
    }

    if (status) {
      filter.status = status;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total count
    const total = await StudentModel.count(filter);

    // Get students
    const students = await StudentModel.find(filter, {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy: sortBy,
      order: sortOrder
    });

    res.json({
      success: true,
      data: {
        students: students.data,
        pagination: students.pagination
      }
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching students',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

/**
 * @route GET /api/admin/students/:id
 * @desc Get single student by ID
 * @access Admin
 */
router.get('/:id', async (req, res) => {
  try {
    const student = await StudentModel.findById(req.params.id);
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.json({
      success: true,
      data: student
    });
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching student',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

/**
 * @route POST /api/admin/students
 * @desc Create new student
 * @access Admin
 */
router.post('/', [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').matches(/^(\+30|0030)?[0-9]{10}$/).withMessage('Valid Greek phone number is required'),
  body('grade').isIn(['Γ Λυκείου', 'Β Λυκείου', 'Α Λυκείου', 'Γ Γυμνασίου', 'Β Γυμνασίου', 'Α Γυμνασίου']).withMessage('Valid grade is required'),
  body('school').trim().notEmpty().withMessage('School is required'),
  body('parentName').trim().notEmpty().withMessage('Parent name is required'),
  body('parentPhone').matches(/^(\+30|0030)?[0-9]{10}$/).withMessage('Valid parent phone number is required'),
  body('parentEmail').optional().isEmail().normalizeEmail().withMessage('Valid parent email is required'),
  body('subjects').optional().isArray().withMessage('Subjects must be an array'),
  body('location').optional().isString().withMessage('Location must be a string'),
  body('notes').optional().isString().isLength({ max: 500 }).withMessage('Notes must be less than 500 characters')
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

    const {
      firstName,
      lastName,
      email,
      phone,
      grade,
      school,
      parentName,
      parentPhone,
      parentEmail,
      subjects = [],
      notes
    } = req.body;

    // Check if email already exists
    const existingStudent = await StudentModel.findOne({ email });
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: 'Student with this email already exists',
        field: 'email'
      });
    }

    // Generate unique key
    const uniqueKey = await keyGenerator.generateUniqueKey();

    // Create student
    const student = new StudentModel({
      uniqueKey,
      firstName,
      lastName,
      email,
      phone,
      grade,
      school,
      parentName,
      parentPhone,
      parentEmail,
      subjects,
      notes
    });

    await student.save();

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: student
    });
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating student',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

/**
 * @route PUT /api/admin/students/:id
 * @desc Update student
 * @access Admin
 */
router.put('/:id', [
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').optional().matches(/^(\+30|0030)?[0-9]{10}$/).withMessage('Valid Greek phone number is required'),
  body('grade').optional().isIn(['Γ Λυκείου', 'Β Λυκείου', 'Α Λυκείου', 'Γ Γυμνασίου', 'Β Γυμνασίου', 'Α Γυμνασίου']).withMessage('Valid grade is required'),
  body('school').optional().trim().notEmpty().withMessage('School cannot be empty'),
  body('parentName').optional().trim().notEmpty().withMessage('Parent name cannot be empty'),
  body('parentPhone').optional().matches(/^(\+30|0030)?[0-9]{10}$/).withMessage('Valid parent phone number is required'),
  body('parentEmail').optional().isEmail().normalizeEmail().withMessage('Valid parent email is required'),
  body('subjects').optional().isArray().withMessage('Subjects must be an array'),
  body('status').optional().isIn(['active', 'inactive', 'graduated', 'suspended']).withMessage('Invalid status'),
  body('notes').optional().isString().isLength({ max: 500 }).withMessage('Notes must be less than 500 characters')
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

    const student = await StudentModel.findById(req.params.id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if email is being changed and if it already exists
    if (req.body.email && req.body.email !== student.email) {
      const existingStudent = await StudentModel.findOne({ email: req.body.email });
      if (existingStudent) {
        return res.status(400).json({
          success: false,
          message: 'Student with this email already exists',
          field: 'email'
        });
      }
    }

    // Update student
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        student[key] = req.body[key];
      }
    });

    await student.save();

    res.json({
      success: true,
      message: 'Student updated successfully',
      data: student
    });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating student',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

/**
 * @route DELETE /api/admin/students/:id
 * @desc Delete student
 * @access Admin
 */
router.delete('/:id', async (req, res) => {
  try {
    const student = await StudentModel.findById(req.params.id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    await StudentModel.deleteById(req.params.id);

    res.json({
      success: true,
      message: 'Student deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting student',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

/**
 * @route GET /api/admin/students/key/preview
 * @desc Get preview of next unique keys
 * @access Admin
 */
router.get('/key/preview', [
  query('count').optional().isInt({ min: 1, max: 10 }).withMessage('Count must be between 1 and 10'),
  query('location').optional().isString().withMessage('Location must be a string')
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

    const { count = 5, location } = req.query;
    const previewKeys = await keyGenerator.generatePreview(parseInt(count), location);

    res.json({
      success: true,
      data: {
        previewKeys,
        availableLocations: keyGenerator.getAvailableLocations()
      }
    });
  } catch (error) {
    console.error('Error generating key preview:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating key preview',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

/**
 * @route GET /api/admin/students/stats/overview
 * @desc Get student statistics overview
 * @access Admin
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const [
      totalStudents,
      activeStudents,
      graduatedStudents,
      recentRegistrations,
      studentsByGrade,
      studentsByStatus
    ] = await Promise.all([
      StudentModel.count({}),
      StudentModel.count({ status: 'active' }),
      StudentModel.count({ status: 'graduated' }),
      StudentModel.count({
        registrationDate: {
          $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }),
      // Get students by grade (simplified)
      StudentModel.find({}, { limit: 1000 }).then(students => {
        const gradeCount = {};
        students.data.forEach(student => {
          gradeCount[student.grade] = (gradeCount[student.grade] || 0) + 1;
        });
        return Object.entries(gradeCount).map(([grade, count]) => ({ _id: grade, count }));
      }),
      // Get students by status (simplified)
      StudentModel.find({}, { limit: 1000 }).then(students => {
        const statusCount = {};
        students.data.forEach(student => {
          statusCount[student.status] = (statusCount[student.status] || 0) + 1;
        });
        return Object.entries(statusCount).map(([status, count]) => ({ _id: status, count }));
      })
    ]);

    res.json({
      success: true,
      data: {
        totalStudents,
        activeStudents,
        graduatedStudents,
        recentRegistrations,
        studentsByGrade,
        studentsByStatus
      }
    });
  } catch (error) {
    console.error('Error fetching student stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching student statistics',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

module.exports = router;
