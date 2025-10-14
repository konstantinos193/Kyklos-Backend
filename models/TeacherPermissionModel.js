const { crud, toObjectId, isValidObjectId } = require('../utils/mongodb-utils');

const COLLECTION_NAME = 'teacherpermissions';

// Validation schemas
const teacherPermissionValidation = {
  teacher: {
    type: 'string',
    required: true
  },
  teacherName: {
    type: 'string',
    required: true
  },
  examMaterial: {
    type: 'string',
    required: true
  },
  permissionType: {
    type: 'string',
    enum: ['view', 'download', 'manage', 'full'],
    default: 'view'
  },
  grantedBy: {
    type: 'string',
    required: true
  },
  grantedByName: {
    type: 'string',
    required: true
  },
  grantedAt: {
    type: 'date',
    default: 'now'
  },
  expiresAt: {
    type: 'date'
  },
  isActive: {
    type: 'boolean',
    default: true
  },
  notes: {
    type: 'string',
    maxLength: 500
  },
  accessLog: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['view', 'download', 'grant', 'revoke', 'modify'],
          required: true
        },
        timestamp: {
          type: 'date',
          default: 'now'
        },
        details: { type: 'string' }
      }
    }
  }
};

// Validation function
const validateTeacherPermission = (data, isUpdate = false) => {
  const errors = [];
  
  for (const [field, rules] of Object.entries(teacherPermissionValidation)) {
    const value = data[field];
    
    // Skip validation for fields not provided in updates
    if (isUpdate && value === undefined) continue;
    
    // Required field check
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }
    
    // Skip other validations if value is not provided
    if (value === undefined || value === null || value === '') continue;
    
    // Type check
    if (rules.type === 'string' && typeof value !== 'string') {
      errors.push(`${field} must be a string`);
      continue;
    }
    
    if (rules.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`${field} must be a boolean`);
      continue;
    }
    
    if (rules.type === 'array' && !Array.isArray(value)) {
      errors.push(`${field} must be an array`);
      continue;
    }
    
    if (rules.type === 'object' && typeof value !== 'object') {
      errors.push(`${field} must be an object`);
      continue;
    }
    
    if (rules.type === 'date' && !(value instanceof Date)) {
      errors.push(`${field} must be a date`);
      continue;
    }
    
    // String validations
    if (rules.type === 'string' && typeof value === 'string') {
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${field} cannot exceed ${rules.maxLength} characters`);
      }
    }
    
    // Enum check
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
    }
    
    // Array validations
    if (rules.type === 'array' && Array.isArray(value)) {
      if (rules.items && rules.items.type === 'object') {
        value.forEach((item, index) => {
          if (typeof item !== 'object') {
            errors.push(`${field}[${index}] must be an object`);
          } else {
            // Validate object properties
            for (const [prop, propRules] of Object.entries(rules.items.properties)) {
              const propValue = item[prop];
              
              if (propRules.required && (propValue === undefined || propValue === null || propValue === '')) {
                errors.push(`${field}[${index}].${prop} is required`);
                continue;
              }
              
              if (propValue !== undefined && propValue !== null && propValue !== '') {
                if (propRules.type === 'string' && typeof propValue !== 'string') {
                  errors.push(`${field}[${index}].${prop} must be a string`);
                } else if (propRules.type === 'date' && !(propValue instanceof Date)) {
                  errors.push(`${field}[${index}].${prop} must be a date`);
                } else if (propRules.enum && !propRules.enum.includes(propValue)) {
                  errors.push(`${field}[${index}].${prop} must be one of: ${propRules.enum.join(', ')}`);
                }
              }
            }
          }
        });
      }
    }
  }
  
  return errors;
};

// TeacherPermission model class
class TeacherPermissionModel {
  static async create(data) {
    const errors = validateTeacherPermission(data);
    if (errors.length > 0) {
      throw new Error(`Validation errors: ${errors.join(', ')}`);
    }
    
    // Set default values
    const permissionData = {
      ...data,
      grantedAt: data.grantedAt || new Date(),
      isActive: data.isActive !== undefined ? data.isActive : true,
      accessLog: data.accessLog || []
    };
    
    return await crud.create(COLLECTION_NAME, permissionData);
  }
  
  static async findById(id) {
    if (!isValidObjectId(id)) {
      throw new Error('Invalid teacher permission ID');
    }
    return await crud.findById(COLLECTION_NAME, id);
  }
  
  static async findOne(filter) {
    return await crud.findOne(COLLECTION_NAME, filter);
  }
  
  static async find(filter = {}, options = {}) {
    return await crud.find(COLLECTION_NAME, filter, options);
  }
  
  static async updateById(id, data) {
    const errors = validateTeacherPermission(data, true);
    if (errors.length > 0) {
      throw new Error(`Validation errors: ${errors.join(', ')}`);
    }
    
    return await crud.updateById(COLLECTION_NAME, id, data);
  }
  
  static async deleteById(id) {
    return await crud.deleteById(COLLECTION_NAME, id);
  }
  
  static async count(filter = {}) {
    return await crud.count(COLLECTION_NAME, filter);
  }
  
  // Custom methods
  static async getForTeacher(teacherId, filters = {}) {
    const query = {
      teacher: teacherId,
      isActive: true,
      ...filters
    };
    
    return await this.find(query, {
      sortBy: 'createdAt',
      order: 'desc'
    });
  }
  
  static async getForExamMaterial(examMaterialId) {
    return await this.find({
      examMaterial: examMaterialId,
      isActive: true
    }, {
      sortBy: 'createdAt',
      order: 'desc'
    });
  }
  
  static async hasPermission(teacherId, examMaterialId, action) {
    const permission = await this.findOne({
      teacher: teacherId,
      examMaterial: examMaterialId,
      isActive: true
    });
    
    if (!permission || !this.isValid(permission)) {
      return false;
    }
    
    // Check permission level
    const permissionLevels = {
      'view': 1,
      'download': 2,
      'manage': 3,
      'full': 4
    };
    
    const requiredLevel = permissionLevels[action] || 1;
    const userLevel = permissionLevels[permission.permissionType] || 0;
    
    return userLevel >= requiredLevel;
  }
  
  static async getActivePermissions(options = {}) {
    return await this.find({ isActive: true }, options);
  }
  
  static async getExpiredPermissions() {
    const now = new Date();
    return await this.find({
      isActive: true,
      expiresAt: { $lt: now }
    });
  }
  
  static async getPermissionsByType(permissionType, options = {}) {
    return await this.find({
      permissionType,
      isActive: true
    }, options);
  }
  
  static async searchPermissions(searchTerm, options = {}) {
    const filter = {
      isActive: true,
      $or: [
        { teacherName: { $regex: searchTerm, $options: 'i' } },
        { grantedByName: { $regex: searchTerm, $options: 'i' } },
        { notes: { $regex: searchTerm, $options: 'i' } }
      ]
    };
    
    return await this.find(filter, options);
  }
  
  // Instance methods
  static isValid(permission) {
    if (!permission.isActive) {
      return false;
    }
    
    if (permission.expiresAt && new Date() > permission.expiresAt) {
      return false;
    }
    
    return true;
  }
  
  static async logAccess(permissionId, action, details = '') {
    const permission = await this.findById(permissionId);
    if (!permission) {
      throw new Error('Permission not found');
    }
    
    const logEntry = {
      action,
      details,
      timestamp: new Date()
    };
    
    // Add to access log
    const updatedAccessLog = [...(permission.accessLog || []), logEntry];
    
    // Keep only last 50 log entries
    const trimmedAccessLog = updatedAccessLog.slice(-50);
    
    return await this.updateById(permissionId, {
      accessLog: trimmedAccessLog
    });
  }
  
  static async revokePermission(permissionId, revokedBy, reason = '') {
    return await this.updateById(permissionId, {
      isActive: false,
      notes: reason ? `${permission.notes || ''}\nRevoked: ${reason}`.trim() : permission.notes
    });
  }
  
  static async extendPermission(permissionId, newExpiryDate, extendedBy, reason = '') {
    return await this.updateById(permissionId, {
      expiresAt: newExpiryDate,
      notes: reason ? `${permission.notes || ''}\nExtended: ${reason}`.trim() : permission.notes
    });
  }
  
  static async getStats() {
    const total = await this.count();
    const active = await this.count({ isActive: true });
    const expired = await this.count({
      isActive: true,
      expiresAt: { $lt: new Date() }
    });
    const byType = await this.getCollection().aggregate([
      { $group: { _id: '$permissionType', count: { $sum: 1 } } }
    ]).toArray();
    const byTeacher = await this.getCollection().aggregate([
      { $group: { _id: '$teacher', count: { $sum: 1 } } }
    ]).toArray();
    
    return {
      total,
      active,
      expired,
      inactive: total - active,
      byType,
      byTeacher
    };
  }
  
  // Virtual fields
  static addVirtualFields(permission) {
    if (!permission) return permission;
    
    return {
      ...permission,
      isValid: this.isValid(permission),
      isExpired: permission.expiresAt ? new Date() > permission.expiresAt : false
    };
  }
  
  // Helper method to get collection
  static getCollection() {
    const { getCollection } = require('../utils/mongodb-utils');
    return getCollection(COLLECTION_NAME);
  }
}

module.exports = TeacherPermissionModel;
