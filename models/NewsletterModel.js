const { crud, toObjectId, isValidObjectId } = require('../utils/mongodb-utils');

const COLLECTION_NAME = 'newsletters';

// Validation schemas
const newsletterValidation = {
  email: {
    type: 'string',
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    pattern: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/
  },
  name: {
    type: 'string',
    trim: true,
    maxLength: 100
  },
  subscribedAt: {
    type: 'date',
    default: 'now'
  },
  unsubscribedAt: {
    type: 'date'
  },
  isActive: {
    type: 'boolean',
    default: true
  },
  source: {
    type: 'string',
    enum: ['website', 'admin', 'import'],
    default: 'website'
  },
  preferences: {
    type: 'object',
    properties: {
      categories: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['Συμβουλές', 'Ψυχολογία', 'Μελέτη', 'Οργάνωση', 'Τεχνολογία', 'Οικογένεια', 'Γενικά']
        }
      },
      frequency: {
        type: 'string',
        enum: ['weekly', 'monthly', 'as-needed'],
        default: 'weekly'
      }
    }
  },
  lastEmailSent: {
    type: 'date'
  },
  emailCount: {
    type: 'number',
    default: 0
  },
  bounceCount: {
    type: 'number',
    default: 0
  },
  isBounced: {
    type: 'boolean',
    default: false
  }
};

// Validation function
const validateNewsletter = (data, isUpdate = false) => {
  const errors = [];
  
  for (const [field, rules] of Object.entries(newsletterValidation)) {
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
      
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`${field} format is invalid`);
      }
    }
    
    // Enum check
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
    }
    
    // Array validations
    if (rules.type === 'array' && Array.isArray(value)) {
      if (rules.items && rules.items.enum) {
        const invalidItems = value.filter(item => !rules.items.enum.includes(item));
        if (invalidItems.length > 0) {
          errors.push(`${field} contains invalid items: ${invalidItems.join(', ')}`);
        }
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
          } else if (propRules.enum && !propRules.enum.includes(propValue)) {
            errors.push(`${field}.${prop} must be one of: ${propRules.enum.join(', ')}`);
          }
        }
      }
    }
  }
  
  return errors;
};

// Newsletter model class
class NewsletterModel {
  static async create(data) {
    const errors = validateNewsletter(data);
    if (errors.length > 0) {
      throw new Error(`Validation errors: ${errors.join(', ')}`);
    }
    
    // Set default values
    const newsletterData = {
      ...data,
      subscribedAt: data.subscribedAt || new Date(),
      isActive: data.isActive !== undefined ? data.isActive : true,
      source: data.source || 'website',
      preferences: {
        categories: data.preferences?.categories || [],
        frequency: data.preferences?.frequency || 'weekly',
        ...data.preferences
      },
      emailCount: 0,
      bounceCount: 0,
      isBounced: false
    };
    
    return await crud.create(COLLECTION_NAME, newsletterData);
  }
  
  static async findById(id) {
    if (!isValidObjectId(id)) {
      throw new Error('Invalid newsletter ID');
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
    const errors = validateNewsletter(data, true);
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
  static async findByEmail(email) {
    return await this.findOne({ email: email.toLowerCase() });
  }
  
  static async getActiveSubscribers(options = {}) {
    return await this.find({ isActive: true }, options);
  }
  
  static async getSubscribersBySource(source, options = {}) {
    return await this.find({ source, isActive: true }, options);
  }
  
  static async getSubscribersByFrequency(frequency, options = {}) {
    return await this.find({ 
      'preferences.frequency': frequency, 
      isActive: true 
    }, options);
  }
  
  static async getSubscribersByCategory(category, options = {}) {
    return await this.find({ 
      'preferences.categories': category, 
      isActive: true 
    }, options);
  }
  
  static async unsubscribe(email) {
    const subscriber = await this.findByEmail(email);
    if (subscriber) {
      return await this.updateById(subscriber._id, {
        isActive: false,
        unsubscribedAt: new Date()
      });
    }
    return null;
  }
  
  static async resubscribe(email) {
    const subscriber = await this.findByEmail(email);
    if (subscriber) {
      return await this.updateById(subscriber._id, {
        isActive: true,
        unsubscribedAt: null
      });
    }
    return null;
  }
  
  static async updateEmailSent(email) {
    const subscriber = await this.findByEmail(email);
    if (subscriber) {
      return await this.updateById(subscriber._id, {
        lastEmailSent: new Date(),
        emailCount: (subscriber.emailCount || 0) + 1
      });
    }
    return null;
  }
  
  static async recordBounce(email) {
    const subscriber = await this.findByEmail(email);
    if (subscriber) {
      const bounceCount = (subscriber.bounceCount || 0) + 1;
      return await this.updateById(subscriber._id, {
        bounceCount,
        isBounced: bounceCount >= 3 // Mark as bounced after 3 bounces
      });
    }
    return null;
  }
  
  static async getStats() {
    const total = await this.count();
    const active = await this.count({ isActive: true });
    const bounced = await this.count({ isBounced: true });
    const bySource = await this.getCollection().aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]).toArray();
    const byFrequency = await this.getCollection().aggregate([
      { $group: { _id: '$preferences.frequency', count: { $sum: 1 } } }
    ]).toArray();
    
    return {
      total,
      active,
      bounced,
      inactive: total - active,
      bySource,
      byFrequency
    };
  }
  
  // Virtual fields
  static addVirtualFields(newsletter) {
    if (!newsletter) return newsletter;
    
    let subscriptionDuration = 0;
    if (!newsletter.isActive && newsletter.unsubscribedAt) {
      subscriptionDuration = Math.floor(
        (newsletter.unsubscribedAt - newsletter.subscribedAt) / (1000 * 60 * 60 * 24)
      );
    } else {
      subscriptionDuration = Math.floor(
        (new Date() - newsletter.subscribedAt) / (1000 * 60 * 60 * 24)
      );
    }
    
    return {
      ...newsletter,
      subscriptionDuration
    };
  }
  
  // Helper method to get collection
  static getCollection() {
    const { getCollection } = require('../utils/mongodb-utils');
    return getCollection(COLLECTION_NAME);
  }
}

module.exports = NewsletterModel;
