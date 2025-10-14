const { crud, toObjectId, isValidObjectId } = require('../utils/mongodb-utils');

const COLLECTION_NAME = 'exammaterials';

// Validation schemas
const examMaterialValidation = {
  title: {
    type: 'string',
    required: true,
    trim: true
  },
  description: {
    type: 'string',
    required: true,
    trim: true
  },
  subject: {
    type: 'string',
    required: true,
    trim: true
  },
  grade: {
    type: 'string',
    required: true,
    trim: true
  },
  year: {
    type: 'number',
    required: true
  },
  type: {
    type: 'string',
    enum: ['exam', 'solution', 'practice', 'theory', 'notes'],
    required: true
  },
  accessLevel: {
    type: 'string',
    enum: ['basic', 'premium', 'vip'],
    default: 'basic'
  },
  filePath: {
    type: 'string',
    required: true
  },
  fileName: {
    type: 'string',
    required: true
  },
  fileSize: {
    type: 'number',
    required: true
  },
  mimeType: {
    type: 'string',
    required: true
  },
  tags: {
    type: 'array',
    items: {
      type: 'string',
      trim: true
    }
  },
  isActive: {
    type: 'boolean',
    default: true
  },
  isLocked: {
    type: 'boolean',
    default: false
  },
  lockReason: {
    type: 'string',
    trim: true
  },
  uploadedBy: {
    type: 'string',
    required: true
  },
  uploadedByName: {
    type: 'string',
    required: true
  },
  downloadCount: {
    type: 'number',
    default: 0
  },
  lastDownloaded: {
    type: 'date'
  },
  metadata: {
    type: 'object',
    properties: {
      difficulty: {
        type: 'string',
        enum: ['easy', 'medium', 'hard'],
        default: 'medium'
      },
      duration: {
        type: 'number',
        default: 120
      },
      questions: {
        type: 'number',
        default: 0
      },
      points: {
        type: 'number',
        default: 0
      }
    }
  },
  accessPermissions: {
    type: 'object',
    properties: {
      students: {
        type: 'array',
        items: { type: 'string' }
      },
      grades: {
        type: 'array',
        items: { type: 'string' }
      },
      subjects: {
        type: 'array',
        items: { type: 'string' }
      },
      timeRestrictions: {
        type: 'object',
        properties: {
          startDate: { type: 'date' },
          endDate: { type: 'date' },
          timeSlots: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                day: { type: 'string' },
                startTime: { type: 'string' },
                endTime: { type: 'string' }
              }
            }
          }
        }
      }
    }
  },
  version: {
    type: 'number',
    default: 1
  },
  previousVersions: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        filePath: { type: 'string' },
        fileName: { type: 'string' },
        uploadedAt: { type: 'date' },
        uploadedBy: { type: 'string' }
      }
    }
  }
};

// Validation function
const validateExamMaterial = (data, isUpdate = false) => {
  const errors = [];
  
  for (const [field, rules] of Object.entries(examMaterialValidation)) {
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
    
    if (rules.type === 'number' && typeof value !== 'number') {
      errors.push(`${field} must be a number`);
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
      if (rules.trim) {
        data[field] = value.trim();
      }
    }
    
    // Enum check
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
    }
    
    // Array validations
    if (rules.type === 'array' && Array.isArray(value)) {
      if (rules.items && rules.items.type === 'string') {
        value.forEach((item, index) => {
          if (typeof item !== 'string') {
            errors.push(`${field}[${index}] must be a string`);
          } else if (rules.items.trim) {
            value[index] = item.trim();
          }
        });
      }
    }
    
    // Object validations
    if (rules.type === 'object' && rules.properties && typeof value === 'object') {
      for (const [prop, propRules] of Object.entries(rules.properties)) {
        const propValue = value[prop];
        
        if (propRules.required && (propValue === undefined || propValue === null || propValue === '')) {
          errors.push(`${field}.${prop} is required`);
          continue;
        }
        
        if (propValue !== undefined && propValue !== null && propValue !== '') {
          if (propRules.type === 'string' && typeof propValue !== 'string') {
            errors.push(`${field}.${prop} must be a string`);
          } else if (propRules.type === 'number' && typeof propValue !== 'number') {
            errors.push(`${field}.${prop} must be a number`);
          } else if (propRules.type === 'array' && !Array.isArray(propValue)) {
            errors.push(`${field}.${prop} must be an array`);
          } else if (propRules.type === 'object' && typeof propValue !== 'object') {
            errors.push(`${field}.${prop} must be an object`);
          } else if (propRules.type === 'date' && !(propValue instanceof Date)) {
            errors.push(`${field}.${prop} must be a date`);
          } else if (propRules.enum && !propRules.enum.includes(propValue)) {
            errors.push(`${field}.${prop} must be one of: ${propRules.enum.join(', ')}`);
          }
        }
      }
    }
  }
  
  return errors;
};

// Format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ExamMaterial model class
class ExamMaterialModel {
  static async create(data) {
    const errors = validateExamMaterial(data);
    if (errors.length > 0) {
      throw new Error(`Validation errors: ${errors.join(', ')}`);
    }
    
    // Set default values
    const examMaterialData = {
      ...data,
      isActive: data.isActive !== undefined ? data.isActive : true,
      isLocked: data.isLocked !== undefined ? data.isLocked : false,
      downloadCount: 0,
      version: 1,
      previousVersions: [],
      metadata: {
        difficulty: 'medium',
        duration: 120,
        questions: 0,
        points: 0,
        ...data.metadata
      },
      accessPermissions: {
        students: [],
        grades: [],
        subjects: [],
        timeRestrictions: null,
        ...data.accessPermissions
      }
    };
    
    return await crud.create(COLLECTION_NAME, examMaterialData);
  }
  
  static async findById(id) {
    if (!isValidObjectId(id)) {
      throw new Error('Invalid exam material ID');
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
    const errors = validateExamMaterial(data, true);
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
  static async getActiveMaterials(options = {}) {
    return await this.find({ 
      isActive: true, 
      isLocked: false 
    }, options);
  }
  
  static async getMaterialsBySubject(subject, options = {}) {
    return await this.find({ 
      subject, 
      isActive: true, 
      isLocked: false 
    }, options);
  }
  
  static async getMaterialsByGrade(grade, options = {}) {
    return await this.find({ 
      grade, 
      isActive: true, 
      isLocked: false 
    }, options);
  }
  
  static async getMaterialsByType(type, options = {}) {
    return await this.find({ 
      type, 
      isActive: true, 
      isLocked: false 
    }, options);
  }
  
  static async getMaterialsByYear(year, options = {}) {
    return await this.find({ 
      year, 
      isActive: true, 
      isLocked: false 
    }, options);
  }
  
  static async getMaterialsByAccessLevel(accessLevel, options = {}) {
    return await this.find({ 
      accessLevel, 
      isActive: true, 
      isLocked: false 
    }, options);
  }
  
  static async searchMaterials(searchTerm, options = {}) {
    const filter = {
      isActive: true,
      isLocked: false,
      $or: [
        { title: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { subject: { $regex: searchTerm, $options: 'i' } },
        { tags: { $in: [new RegExp(searchTerm, 'i')] } }
      ]
    };
    
    return await this.find(filter, options);
  }
  
  static async getMaterialsForStudent(student, filters = {}) {
    const query = {
      isActive: true,
      isLocked: false
    };
    
    // Add filters
    if (filters.subject) {
      query.subject = filters.subject;
    }
    if (filters.grade) {
      query.grade = filters.grade;
    }
    if (filters.type) {
      query.type = filters.type;
    }
    if (filters.year) {
      query.year = filters.year;
    }
    
    return await this.find(query, {
      sortBy: 'createdAt',
      order: 'desc',
      ...filters
    });
  }
  
  static async hasStudentAccess(material, student) {
    // Check if material is active and not locked
    if (!material.isActive || material.isLocked) {
      return false;
    }
    
    // Check access level
    const studentAccessLevel = student.accessLevel || 'basic';
    const accessLevels = ['basic', 'premium', 'vip'];
    const studentLevelIndex = accessLevels.indexOf(studentAccessLevel);
    const materialLevelIndex = accessLevels.indexOf(material.accessLevel);
    
    if (studentLevelIndex < materialLevelIndex) {
      return false;
    }
    
    // Check specific permissions
    if (material.accessPermissions.students.length > 0) {
      if (!material.accessPermissions.students.includes(student._id.toString())) {
        return false;
      }
    }
    
    if (material.accessPermissions.grades.length > 0) {
      if (!material.accessPermissions.grades.includes(student.grade)) {
        return false;
      }
    }
    
    if (material.accessPermissions.subjects.length > 0) {
      const hasSubjectAccess = material.accessPermissions.subjects.some(subject => 
        student.subjects.includes(subject)
      );
      if (!hasSubjectAccess) {
        return false;
      }
    }
    
    // Check time restrictions
    if (material.accessPermissions.timeRestrictions) {
      const now = new Date();
      const { startDate, endDate } = material.accessPermissions.timeRestrictions;
      
      if (startDate && now < startDate) {
        return false;
      }
      
      if (endDate && now > endDate) {
        return false;
      }
    }
    
    return true;
  }
  
  static async incrementDownload(id) {
    const material = await this.findById(id);
    if (material) {
      return await crud.updateById(COLLECTION_NAME, id, { 
        downloadCount: (material.downloadCount || 0) + 1,
        lastDownloaded: new Date()
      });
    }
    return null;
  }
  
  static async getStats() {
    const total = await this.count();
    const active = await this.count({ isActive: true });
    const locked = await this.count({ isLocked: true });
    const bySubject = await this.getCollection().aggregate([
      { $group: { _id: '$subject', count: { $sum: 1 } } }
    ]).toArray();
    const byType = await this.getCollection().aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]).toArray();
    const byGrade = await this.getCollection().aggregate([
      { $group: { _id: '$grade', count: { $sum: 1 } } }
    ]).toArray();
    
    return {
      total,
      active,
      locked,
      inactive: total - active,
      bySubject,
      byType,
      byGrade
    };
  }
  
  // Virtual fields
  static addVirtualFields(material) {
    if (!material) return material;
    
    return {
      ...material,
      formattedFileSize: formatFileSize(material.fileSize || 0),
      downloadUrl: `/api/exam-materials/download/${material._id}`
    };
  }
  
  // Helper method to get collection
  static getCollection() {
    const { getCollection } = require('../utils/mongodb-utils');
    return getCollection(COLLECTION_NAME);
  }
}

module.exports = ExamMaterialModel;
