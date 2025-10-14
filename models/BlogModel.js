const { crud, toObjectId, isValidObjectId } = require('../utils/mongodb-utils');

const COLLECTION_NAME = 'blogs';

// Validation schemas
const blogValidation = {
  title: {
    type: 'string',
    required: true,
    trim: true,
    maxLength: 200
  },
  slug: {
    type: 'string',
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  excerpt: {
    type: 'string',
    required: true,
    maxLength: 500
  },
  content: {
    type: 'string',
    required: true
  },
  author: {
    type: 'object',
    required: true,
    properties: {
      name: {
        type: 'string',
        required: true,
        trim: true
      },
      image: {
        type: 'string',
        required: false,
        default: ''
      }
    }
  },
  category: {
    type: 'string',
    required: true,
    enum: ['Συμβουλές', 'Ψυχολογία', 'Μελέτη', 'Οργάνωση', 'Τεχνολογία', 'Οικογένεια', 'Γενικά']
  },
  tags: {
    type: 'array',
    items: {
      type: 'string',
      trim: true
    }
  },
  image: {
    type: 'object',
    required: true,
    properties: {
      url: {
        type: 'string',
        required: true
      },
      alt: {
        type: 'string',
        default: ''
      },
      caption: {
        type: 'string',
        default: ''
      }
    }
  },
  status: {
    type: 'string',
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  publishDate: {
    type: 'date',
    default: 'now'
  },
  readTime: {
    type: 'string',
    default: '5 λεπτά'
  },
  views: {
    type: 'number',
    default: 0
  },
  likes: {
    type: 'number',
    default: 0
  },
  featured: {
    type: 'boolean',
    default: false
  },
  seo: {
    type: 'object',
    properties: {
      metaTitle: { type: 'string' },
      metaDescription: { type: 'string' },
      keywords: { type: 'array', items: { type: 'string' } }
    }
  }
};

// Validation function
const validateBlog = (data, isUpdate = false) => {
  const errors = [];
  
  for (const [field, rules] of Object.entries(blogValidation)) {
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
      
      if (rules.lowercase) {
        data[field] = value.toLowerCase();
      }
      
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
          } else if (propRules.type === 'array' && !Array.isArray(propValue)) {
            errors.push(`${field}.${prop} must be an array`);
          }
        }
      }
    }
  }
  
  return errors;
};

// Generate slug from title
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim('-');
};

// Calculate reading time
const calculateReadTime = (content) => {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  return `${minutes} λεπτά`;
};

// Blog model class
class BlogModel {
  static async create(data) {
    const errors = validateBlog(data);
    if (errors.length > 0) {
      throw new Error(`Validation errors: ${errors.join(', ')}`);
    }
    
    // Generate slug if not provided
    if (!data.slug && data.title) {
      data.slug = generateSlug(data.title);
    }
    
    // Calculate read time if not provided
    if (!data.readTime && data.content) {
      data.readTime = calculateReadTime(data.content);
    }
    
    // Set publish date if not provided
    if (!data.publishDate) {
      data.publishDate = new Date();
    }
    
    return await crud.create(COLLECTION_NAME, data);
  }
  
  static async findById(id) {
    if (!isValidObjectId(id)) {
      throw new Error('Invalid blog ID');
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
    const errors = validateBlog(data, true);
    if (errors.length > 0) {
      throw new Error(`Validation errors: ${errors.join(', ')}`);
    }
    
    // Generate slug if title is being updated
    if (data.title && !data.slug) {
      data.slug = generateSlug(data.title);
    }
    
    // Calculate read time if content is being updated
    if (data.content && !data.readTime) {
      data.readTime = calculateReadTime(data.content);
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
  static async findBySlug(slug) {
    return await this.findOne({ slug: slug.toLowerCase() });
  }
  
  static async getPublishedBlogs(options = {}) {
    return await this.find({ status: 'published' }, {
      ...options,
      sortBy: 'publishDate',
      order: 'desc'
    });
  }
  
  static async getFeaturedBlogs(options = {}) {
    return await this.find({ 
      status: 'published', 
      featured: true 
    }, {
      ...options,
      sortBy: 'publishDate',
      order: 'desc'
    });
  }
  
  static async getBlogsByCategory(category, options = {}) {
    return await this.find({ 
      status: 'published', 
      category 
    }, {
      ...options,
      sortBy: 'publishDate',
      order: 'desc'
    });
  }
  
  static async getBlogsByTag(tag, options = {}) {
    return await this.find({ 
      status: 'published', 
      tags: tag 
    }, {
      ...options,
      sortBy: 'publishDate',
      order: 'desc'
    });
  }
  
  static async incrementViews(id) {
    const blog = await this.findById(id);
    if (blog) {
      return await crud.updateById(COLLECTION_NAME, id, { 
        views: (blog.views || 0) + 1 
      });
    }
    return null;
  }
  
  static async incrementLikes(id) {
    const blog = await this.findById(id);
    if (blog) {
      return await crud.updateById(COLLECTION_NAME, id, { 
        likes: (blog.likes || 0) + 1 
      });
    }
    return null;
  }
  
  static async searchBlogs(searchTerm, options = {}) {
    const filter = {
      status: 'published',
      $or: [
        { title: { $regex: searchTerm, $options: 'i' } },
        { excerpt: { $regex: searchTerm, $options: 'i' } },
        { content: { $regex: searchTerm, $options: 'i' } },
        { tags: { $in: [new RegExp(searchTerm, 'i')] } }
      ]
    };
    
    return await this.find(filter, {
      ...options,
      sortBy: 'publishDate',
      order: 'desc'
    });
  }
  
  // Virtual fields
  static addVirtualFields(blog) {
    if (!blog) return blog;
    
    return {
      ...blog,
      calculatedReadTime: calculateReadTime(blog.content || '')
    };
  }
}

module.exports = BlogModel;
