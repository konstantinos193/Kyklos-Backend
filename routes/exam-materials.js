const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { body, validationResult, query } = require('express-validator');
const ExamMaterialModel = require('../models/ExamMaterialModel');
const StudentModel = require('../models/StudentModel');
const AdminModel = require('../models/AdminModel');
const auth = require('../middleware/auth');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/exam-materials');
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `exam-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Μη υποστηριζόμενος τύπος αρχείου'), false);
    }
  }
});

/**
 * @route GET /api/exam-materials
 * @desc Get exam materials for students (with access control)
 * @access Private (Student)
 */
router.get('/', [
  query('subject').optional().trim(),
  query('grade').optional().trim(),
  query('type').optional().trim(),
  query('year').optional().isInt(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
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

    // Get student from token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Απαιτείται αυθεντικοποίηση'
      });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    if (decoded.type !== 'student') {
      return res.status(401).json({
        success: false,
        message: 'Μη έγκυρος τύπος token'
      });
    }

    const student = await StudentModel.findById(decoded.studentId);
    if (!student || student.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Μη έγκυρος μαθητής'
      });
    }

    // Build filters
    const filters = {};
    if (req.query.subject) filters.subject = req.query.subject;
    if (req.query.grade) filters.grade = req.query.grade;
    if (req.query.type) filters.type = req.query.type;
    if (req.query.year) filters.year = parseInt(req.query.year);

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get materials
    const materials = await ExamMaterialModel.find({
      isActive: true,
      isLocked: false,
      ...filters
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select('-filePath -accessPermissions');

    // Filter materials based on student access
    const accessibleMaterials = materials.filter(material => 
      material.hasStudentAccess(student)
    );

    // Get total count for pagination
    const totalCount = await ExamMaterialModel.countDocuments({
      isActive: true,
      isLocked: false,
      ...filters
    });

    res.json({
      success: true,
      data: accessibleMaterials,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Get exam materials error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
    });
  }
});

/**
 * @route GET /api/exam-materials/:id
 * @desc Get specific exam material details
 * @access Private (Student)
 */
router.get('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Απαιτείται αυθεντικοποίηση'
      });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    if (decoded.type !== 'student') {
      return res.status(401).json({
        success: false,
        message: 'Μη έγκυρος τύπος token'
      });
    }

    const student = await StudentModel.findById(decoded.studentId);
    if (!student || student.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Μη έγκυρος μαθητής'
      });
    }

    const material = await ExamMaterialModel.findById(req.params.id);
    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Το υλικό δεν βρέθηκε'
      });
    }

    // Check if student has access
    if (!material.hasStudentAccess(student)) {
      return res.status(403).json({
        success: false,
        message: 'Δεν έχετε πρόσβαση σε αυτό το υλικό'
      });
    }

    res.json({
      success: true,
      data: material
    });

  } catch (error) {
    console.error('Get exam material error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
    });
  }
});

/**
 * @route GET /api/exam-materials/download/:id
 * @desc Download exam material file
 * @access Private (Student)
 */
router.get('/download/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Απαιτείται αυθεντικοποίηση'
      });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    if (decoded.type !== 'student') {
      return res.status(401).json({
        success: false,
        message: 'Μη έγκυρος τύπος token'
      });
    }

    const student = await StudentModel.findById(decoded.studentId);
    if (!student || student.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Μη έγκυρος μαθητής'
      });
    }

    const material = await ExamMaterialModel.findById(req.params.id);
    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Το υλικό δεν βρέθηκε'
      });
    }

    // Check if student has access
    if (!material.hasStudentAccess(student)) {
      return res.status(403).json({
        success: false,
        message: 'Δεν έχετε πρόσβαση σε αυτό το υλικό'
      });
    }

    // Check if file exists
    try {
      await fs.access(material.filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Το αρχείο δεν βρέθηκε στον διακομιστή'
      });
    }

    // Increment download count
    await material.incrementDownload();

    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${material.fileName}"`);
    res.setHeader('Content-Type', material.mimeType);
    res.setHeader('Content-Length', material.fileSize);

    // Stream the file
    const fileStream = require('fs').createReadStream(material.filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Download exam material error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
    });
  }
});

/**
 * @route POST /api/exam-materials
 * @desc Upload new exam material (Admin only)
 * @access Private (Admin)
 */
router.post('/', auth, upload.single('file'), [
  body('title').trim().isLength({ min: 1 }).withMessage('Ο τίτλος είναι υποχρεωτικός'),
  body('description').trim().isLength({ min: 1 }).withMessage('Η περιγραφή είναι υποχρεωτική'),
  body('subject').trim().isLength({ min: 1 }).withMessage('Το μάθημα είναι υποχρεωτικό'),
  body('grade').trim().isLength({ min: 1 }).withMessage('Η τάξη είναι υποχρεωτική'),
  body('year').isInt({ min: 2000, max: 2030 }).withMessage('Μη έγκυρο έτος'),
  body('type').isIn(['exam', 'solution', 'practice', 'theory', 'notes']).withMessage('Μη έγκυρος τύπος'),
  body('accessLevel').optional().isIn(['basic', 'premium', 'vip']).withMessage('Μη έγκυρο επίπεδο πρόσβασης')
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

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Απαιτείται αρχείο'
      });
    }

    // Check if user is admin
    if (req.user.type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Μη εξουσιοδοτημένη πρόσβαση'
      });
    }

    const {
      title,
      description,
      subject,
      grade,
      year,
      type,
      accessLevel = 'basic',
      tags = '',
      difficulty = 'medium',
      duration = 120,
      questions = 0,
      points = 0
    } = req.body;

    // Parse tags
    const tagArray = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

    const examMaterial = new ExamMaterial({
      title,
      description,
      subject,
      grade,
      year: parseInt(year),
      type,
      accessLevel,
      filePath: req.file.path,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      tags: tagArray,
      uploadedBy: req.user.id,
      uploadedByName: req.user.name || 'Admin',
      metadata: {
        difficulty,
        duration: parseInt(duration),
        questions: parseInt(questions),
        points: parseInt(points)
      }
    });

    await examMaterial.save();

    res.status(201).json({
      success: true,
      message: 'Το υλικό ανέβηκε επιτυχώς',
      data: examMaterial
    });

  } catch (error) {
    console.error('Upload exam material error:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting uploaded file:', unlinkError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
    });
  }
});

/**
 * @route PUT /api/exam-materials/:id
 * @desc Update exam material (Admin only)
 * @access Private (Admin)
 */
router.put('/:id', auth, [
  body('title').optional().trim().isLength({ min: 1 }),
  body('description').optional().trim().isLength({ min: 1 }),
  body('subject').optional().trim().isLength({ min: 1 }),
  body('grade').optional().trim().isLength({ min: 1 }),
  body('year').optional().isInt({ min: 2000, max: 2030 }),
  body('type').optional().isIn(['exam', 'solution', 'practice', 'theory', 'notes']),
  body('accessLevel').optional().isIn(['basic', 'premium', 'vip']),
  body('isActive').optional().isBoolean(),
  body('isLocked').optional().isBoolean()
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

    // Check if user is admin
    if (req.user.type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Μη εξουσιοδοτημένη πρόσβαση'
      });
    }

    const material = await ExamMaterialModel.findById(req.params.id);
    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Το υλικό δεν βρέθηκε'
      });
    }

    // Update fields
    const updateFields = {};
    if (req.body.title) updateFields.title = req.body.title;
    if (req.body.description) updateFields.description = req.body.description;
    if (req.body.subject) updateFields.subject = req.body.subject;
    if (req.body.grade) updateFields.grade = req.body.grade;
    if (req.body.year) updateFields.year = parseInt(req.body.year);
    if (req.body.type) updateFields.type = req.body.type;
    if (req.body.accessLevel) updateFields.accessLevel = req.body.accessLevel;
    if (req.body.isActive !== undefined) updateFields.isActive = req.body.isActive;
    if (req.body.isLocked !== undefined) updateFields.isLocked = req.body.isLocked;
    if (req.body.lockReason) updateFields.lockReason = req.body.lockReason;

    if (req.body.tags) {
      updateFields.tags = req.body.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }

    if (req.body.metadata) {
      updateFields.metadata = { ...material.metadata, ...req.body.metadata };
    }

    const updatedMaterial = await ExamMaterialModel.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Το υλικό ενημερώθηκε επιτυχώς',
      data: updatedMaterial
    });

  } catch (error) {
    console.error('Update exam material error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
    });
  }
});

/**
 * @route DELETE /api/exam-materials/:id
 * @desc Delete exam material (Admin only)
 * @access Private (Admin)
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Μη εξουσιοδοτημένη πρόσβαση'
      });
    }

    const material = await ExamMaterialModel.findById(req.params.id);
    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Το υλικό δεν βρέθηκε'
      });
    }

    // Delete file from filesystem
    try {
      await fs.unlink(material.filePath);
    } catch (error) {
      console.error('Error deleting file:', error);
    }

    // Delete from database
    await ExamMaterialModel.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Το υλικό διαγράφηκε επιτυχώς'
    });

  } catch (error) {
    console.error('Delete exam material error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
    });
  }
});

/**
 * @route GET /api/exam-materials/admin/list
 * @desc Get all exam materials for admin (with full details)
 * @access Private (Admin)
 */
router.get('/admin/list', auth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('subject').optional().trim(),
  query('grade').optional().trim(),
  query('type').optional().trim(),
  query('status').optional().isIn(['active', 'inactive', 'locked'])
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

    // Check if user is admin
    if (req.user.type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Μη εξουσιοδοτημένη πρόσβαση'
      });
    }

    // Build filters
    const filters = {};
    if (req.query.subject) filters.subject = req.query.subject;
    if (req.query.grade) filters.grade = req.query.grade;
    if (req.query.type) filters.type = req.query.type;
    if (req.query.status) {
      if (req.query.status === 'active') filters.isActive = true;
      if (req.query.status === 'inactive') filters.isActive = false;
      if (req.query.status === 'locked') filters.isLocked = true;
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const materials = await ExamMaterialModel.find(filters)
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCount = await ExamMaterialModel.countDocuments(filters);

    res.json({
      success: true,
      data: materials,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Get admin exam materials error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
    });
  }
});

module.exports = router;
