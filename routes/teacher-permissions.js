const express = require('express');
const { body, validationResult, query } = require('express-validator');
const TeacherPermissionModel = require('../models/TeacherPermissionModel');
const ExamMaterialModel = require('../models/ExamMaterialModel');
const AdminModel = require('../models/AdminModel');
const auth = require('../middleware/auth');
const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth.verifyToken);

/**
 * @route GET /api/teacher-permissions
 * @desc Get teacher permissions with filtering
 * @access Admin
 */
router.get('/', [
  query('teacherId').optional().isMongoId().withMessage('Invalid teacher ID'),
  query('examMaterialId').optional().isMongoId().withMessage('Invalid exam material ID'),
  query('permissionType').optional().isIn(['view', 'download', 'manage', 'full']).withMessage('Invalid permission type'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
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

    // Check if user is admin (allow admin, super_admin, moderator)
    if (!(req.admin && (req.admin.role === 'admin' || req.admin.role === 'super_admin' || req.admin.role === 'moderator'))) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const {
      teacherId,
      examMaterialId,
      permissionType,
      page = 1,
      limit = 20
    } = req.query;

    // Build filter object
    const filter = {};
    if (teacherId) filter.teacher = teacherId;
    if (examMaterialId) filter.examMaterial = examMaterialId;
    if (permissionType) filter.permissionType = permissionType;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get permissions using custom model API
    const result = await TeacherPermissionModel.find(filter, {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy: 'createdAt',
      order: 'desc'
    });

    res.json({
      success: true,
      data: {
        permissions: result.data,
        pagination: {
          currentPage: result.pagination.page,
          totalPages: result.pagination.pages,
          totalPermissions: result.pagination.total,
          hasNextPage: result.pagination.page < result.pagination.pages,
          hasPrevPage: result.pagination.page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching teacher permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching teacher permissions',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

/**
 * @route POST /api/teacher-permissions
 * @desc Grant permission to teacher for exam material
 * @access Admin
 */
router.post('/', [
  body('teacherId').isMongoId().withMessage('Valid teacher ID is required'),
  body('examMaterialId').isMongoId().withMessage('Valid exam material ID is required'),
  body('permissionType').isIn(['view', 'download', 'manage', 'full']).withMessage('Valid permission type is required'),
  body('expiresAt').optional().isISO8601().withMessage('Valid expiration date is required'),
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

    // Check if user is admin (allow admin, super_admin, moderator)
    if (!(req.admin && (req.admin.role === 'admin' || req.admin.role === 'super_admin' || req.admin.role === 'moderator'))) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const {
      teacherId,
      examMaterialId,
      permissionType,
      expiresAt,
      notes
    } = req.body;

    // Check if teacher exists
    const teacher = await AdminModel.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    // Check if exam material exists
    const examMaterial = await ExamMaterialModel.findById(examMaterialId);
    if (!examMaterial) {
      return res.status(404).json({
        success: false,
        message: 'Exam material not found'
      });
    }

    // Check if permission already exists
    const existingPermission = await TeacherPermissionModel.findOne({
      teacher: teacherId,
      examMaterial: examMaterialId,
      isActive: true
    });

    if (existingPermission) {
      return res.status(400).json({
        success: false,
        message: 'Permission already exists for this teacher and exam material'
      });
    }

    // Create permission
    const permission = new TeacherPermissionModel({
      teacher: teacherId,
      teacherName: teacher.name,
      examMaterial: examMaterialId,
      permissionType,
      grantedBy: req.admin.id,
      grantedByName: req.admin.name || 'Admin',
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      notes
    });

    // Save permission already done by create; permission contains _id
    // Log the action
    await TeacherPermissionModel.logAccess(permission._id, 'grant', `Permission ${permissionType} granted`);

    res.status(201).json({
      success: true,
      message: 'Permission granted successfully',
      data: permission
    });

  } catch (error) {
    console.error('Error granting permission:', error);
    res.status(500).json({
      success: false,
      message: 'Error granting permission',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

/**
 * @route PUT /api/teacher-permissions/:id
 * @desc Update teacher permission
 * @access Admin
 */
router.put('/:id', [
  body('permissionType').optional().isIn(['view', 'download', 'manage', 'full']).withMessage('Valid permission type is required'),
  body('expiresAt').optional().isISO8601().withMessage('Valid expiration date is required'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
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

    // Check if user is admin (allow admin, super_admin, moderator)
    if (!(req.admin && (req.admin.role === 'admin' || req.admin.role === 'super_admin' || req.admin.role === 'moderator'))) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const permission = await TeacherPermissionModel.findById(req.params.id);
    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Permission not found'
      });
    }

    // Update fields
    const updateFields = {};
    if (req.body.permissionType) updateFields.permissionType = req.body.permissionType;
    if (req.body.expiresAt !== undefined) updateFields.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
    if (req.body.isActive !== undefined) updateFields.isActive = req.body.isActive;
    if (req.body.notes !== undefined) updateFields.notes = req.body.notes;

    const updatedPermission = await TeacherPermissionModel.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    );

    // Log the action
    await updatedPermission.logAccess('modify', 'Permission updated');

    res.json({
      success: true,
      message: 'Permission updated successfully',
      data: updatedPermission
    });

  } catch (error) {
    console.error('Error updating permission:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating permission',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

/**
 * @route DELETE /api/teacher-permissions/:id
 * @desc Revoke teacher permission
 * @access Admin
 */
router.delete('/:id', async (req, res) => {
  try {
    // Check if user is admin (allow admin, super_admin, moderator)
    if (!(req.admin && (req.admin.role === 'admin' || req.admin.role === 'super_admin' || req.admin.role === 'moderator'))) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const permission = await TeacherPermissionModel.findById(req.params.id);
    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Permission not found'
      });
    }

    // Log the action before deleting
    await permission.logAccess('revoke', 'Permission revoked');

    // Soft delete by setting isActive to false
    permission.isActive = false;
    await permission.save();

    res.json({
      success: true,
      message: 'Permission revoked successfully'
    });

  } catch (error) {
    console.error('Error revoking permission:', error);
    res.status(500).json({
      success: false,
      message: 'Error revoking permission',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

/**
 * @route GET /api/teacher-permissions/check
 * @desc Check if teacher has permission for exam material
 * @access Admin
 */
router.get('/check', [
  query('teacherId').isMongoId().withMessage('Valid teacher ID is required'),
  query('examMaterialId').isMongoId().withMessage('Valid exam material ID is required'),
  query('action').isIn(['view', 'download', 'manage', 'full']).withMessage('Valid action is required')
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

    const { teacherId, examMaterialId, action } = req.query;

    const hasPermission = await TeacherPermissionModel.hasPermission(teacherId, examMaterialId, action);

    res.json({
      success: true,
      data: {
        hasPermission,
        teacherId,
        examMaterialId,
        action
      }
    });

  } catch (error) {
    console.error('Error checking permission:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking permission',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

/**
 * @route GET /api/teacher-permissions/teacher/:teacherId
 * @desc Get all permissions for a specific teacher
 * @access Admin
 */
router.get('/teacher/:teacherId', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
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

    // Check if user is admin (allow admin, super_admin, moderator)
    if (!(req.admin && (req.admin.role === 'admin' || req.admin.role === 'super_admin' || req.admin.role === 'moderator'))) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const { teacherId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const permissions = await TeacherPermissionModel.getForTeacher(teacherId, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: permissions
    });

  } catch (error) {
    console.error('Error fetching teacher permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching teacher permissions',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

/**
 * @route GET /api/teacher-permissions/exam-material/:examMaterialId
 * @desc Get all permissions for a specific exam material
 * @access Admin
 */
router.get('/exam-material/:examMaterialId', async (req, res) => {
  try {
    // Check if user is admin
    if (req.admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const { examMaterialId } = req.params;

    const permissions = await TeacherPermissionModel.getForExamMaterial(examMaterialId);

    res.json({
      success: true,
      data: permissions
    });

  } catch (error) {
    console.error('Error fetching exam material permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching exam material permissions',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

module.exports = router;
