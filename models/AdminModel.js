const { crud, toObjectId, isValidObjectId } = require('../utils/mongodb-utils');
const bcrypt = require('bcryptjs');

const COLLECTION_NAME = 'admins';

// Validation schemas
const adminValidation = {
  email: {
    type: 'string',
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: 'string',
    required: true,
    minLength: 6
  },
  name: {
    type: 'string',
    required: true,
    trim: true
  },
  role: {
    type: 'string',
    enum: ['super_admin', 'admin', 'moderator'],
    default: 'admin'
  },
  isActive: {
    type: 'boolean',
    default: true
  },
  lastLogin: {
    type: 'date',
    default: null
  },
  permissions: {
    type: 'object',
    required: false
  },
  createdBy: {
    type: 'string',
    required: false
  }
};

// Validation function
const validateAdmin = (data, isUpdate = false) => {
  const errors = [];
  
  for (const [field, rules] of Object.entries(adminValidation)) {
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
      if (rules.trim) {
        data[field] = value.trim();
      }
      
      if (rules.lowercase) {
        data[field] = value.toLowerCase();
      }
      
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }
    }
    
    // Enum check
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
    }
  }
  
  return errors;
};

// Default permissions
const defaultPermissions = {
  students: {
    create: true,
    read: true,
    update: true,
    delete: true
  },
  blog: {
    create: true,
    read: true,
    update: true,
    delete: true
  },
  newsletter: {
    create: true,
    read: true,
    update: true,
    delete: true
  },
  settings: {
    read: true,
    update: true
  }
};

// Admin model class
class AdminModel {
  static async create(data) {
    const errors = validateAdmin(data);
    if (errors.length > 0) {
      throw new Error(`Validation errors: ${errors.join(', ')}`);
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(data.password, salt);
    
    // Add default permissions if not provided
    const adminData = {
      ...data,
      password: hashedPassword,
      permissions: data.permissions || defaultPermissions,
      lastLogin: null
    };
    
    return await crud.create(COLLECTION_NAME, adminData);
  }
  
  static async findById(id) {
    if (!isValidObjectId(id)) {
      throw new Error('Invalid admin ID');
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
    const errors = validateAdmin(data, true);
    if (errors.length > 0) {
      throw new Error(`Validation errors: ${errors.join(', ')}`);
    }
    
    // Hash password if it's being updated
    if (data.password) {
      const salt = await bcrypt.genSalt(12);
      data.password = await bcrypt.hash(data.password, salt);
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
  static async findByEmail(email) {
    return await this.findOne({ 
      email: email.toLowerCase(), 
      isActive: true 
    });
  }
  
  static async updateLastLogin(id) {
    return await crud.updateById(COLLECTION_NAME, id, { lastLogin: new Date() });
  }
  
  static async getActiveAdmins(options = {}) {
    return await this.find({ isActive: true }, options);
  }
  
  static async getAdminsByRole(role, options = {}) {
    return await this.find({ role, isActive: true }, options);
  }
  
  // Password comparison
  static async comparePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
  
  // Get public profile (without password)
  static getPublicProfile(admin) {
    if (!admin) return admin;
    
    const adminObject = { ...admin };
    delete adminObject.password;
    return adminObject;
  }
  
  // Check permissions
  static hasPermission(admin, resource, action) {
    if (!admin || !admin.permissions) return false;
    
    const resourcePermissions = admin.permissions[resource];
    if (!resourcePermissions) return false;
    
    return resourcePermissions[action] === true;
  }
}

module.exports = AdminModel;
