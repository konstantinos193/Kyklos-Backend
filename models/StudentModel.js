const { crud, toObjectId, isValidObjectId } = require('../utils/mongodb-utils');

const COLLECTION_NAME = 'students';

// Validation schemas
const studentValidation = {
  studentId: {
    type: 'string',
    required: false,
    unique: true,
    trim: true,
    maxLength: 50
  },
  uniqueKey: {
    type: 'string',
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  firstName: {
    type: 'string',
    required: true,
    trim: true,
    maxLength: 50
  },
  lastName: {
    type: 'string',
    required: true,
    trim: true,
    maxLength: 50
  },
  email: {
    type: 'string',
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    pattern: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/
  },
  phone: {
    type: 'string',
    required: true,
    trim: true,
    pattern: /^(\+30|0030)?[0-9]{10}$/
  },
  grade: {
    type: 'string',
    required: true,
    enum: ['Γ Λυκείου', 'Β Λυκείου', 'Α Λυκείου', 'Γ Γυμνασίου', 'Β Γυμνασίου', 'Α Γυμνασίου']
  },
  school: {
    type: 'string',
    required: true,
    trim: true,
    maxLength: 100
  },
  subjects: {
    type: 'array',
    items: {
      type: 'string',
      enum: [
        'Ελληνική Γλώσσα',
        'Αρχαία Ελληνικά', 
        'Λατινικά',
        'Ιστορία',
        'Φιλοσοφία',
        'Μαθηματικά',
        'Φυσική',
        'Χημεία',
        'Βιολογία',
        'Οικονομικά',
        'Πληροφορική'
      ]
    }
  },
  status: {
    type: 'string',
    enum: ['active', 'inactive', 'graduated', 'suspended'],
    default: 'active'
  },
  notes: {
    type: 'string',
    maxLength: 500,
    trim: true
  },
  parentName: {
    type: 'string',
    required: true,
    trim: true,
    maxLength: 100
  },
  parentPhone: {
    type: 'string',
    required: true,
    trim: true,
    pattern: /^(\+30|0030)?[0-9]{10}$/
  },
  parentEmail: {
    type: 'string',
    lowercase: true,
    trim: true,
    pattern: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/
  }
};

// Validation function
const validateStudent = (data, isUpdate = false) => {
  const errors = [];
  
  for (const [field, rules] of Object.entries(studentValidation)) {
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
    
    if (rules.type === 'array' && !Array.isArray(value)) {
      errors.push(`${field} must be an array`);
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
      
      if (rules.uppercase) {
        data[field] = value.toUpperCase();
      }
      
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${field} cannot exceed ${rules.maxLength} characters`);
      }
      
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`${field} format is invalid`);
      }
    }
    
    // Enum check
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
    }
    
    // Array enum check
    if (rules.type === 'array' && rules.items && rules.items.enum && Array.isArray(value)) {
      const invalidItems = value.filter(item => !rules.items.enum.includes(item));
      if (invalidItems.length > 0) {
        errors.push(`${field} contains invalid items: ${invalidItems.join(', ')}`);
      }
    }
  }
  
  return errors;
};

// Student model class
class StudentModel {
  static async create(data) {
    const errors = validateStudent(data);
    if (errors.length > 0) {
      throw new Error(`Validation errors: ${errors.join(', ')}`);
    }
    
    // Add virtual fields
    const studentData = {
      ...data,
      registrationDate: new Date(),
      lastLogin: null
    };
    
    return await crud.create(COLLECTION_NAME, studentData);
  }
  
  static async findById(id) {
    if (!isValidObjectId(id)) {
      throw new Error('Invalid student ID');
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
    const errors = validateStudent(data, true);
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
  static async findByStudentId(studentId) {
    return await this.findOne({ studentId: studentId.trim() });
  }
  
  static async findByUniqueKey(uniqueKey) {
    return await this.findOne({ uniqueKey: uniqueKey.toUpperCase() });
  }
  
  static async findByEmail(email) {
    return await this.findOne({ email: email.toLowerCase() });
  }
  
  static async updateLastLogin(id) {
    return await crud.updateById(COLLECTION_NAME, id, { lastLogin: new Date() });
  }
  
  static async getActiveStudents(options = {}) {
    return await this.find({ status: 'active' }, options);
  }
  
  static async getStudentsByGrade(grade, options = {}) {
    return await this.find({ grade }, options);
  }
  
  // Virtual fields (computed properties)
  static addVirtualFields(student) {
    if (!student) return student;
    
    return {
      ...student,
      fullName: `${student.firstName} ${student.lastName}`,
      displayName: `${student.firstName} ${student.lastName.charAt(0)}.`
    };
  }
}

module.exports = StudentModel;
