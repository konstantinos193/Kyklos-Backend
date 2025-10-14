const { ObjectId } = require('mongodb');
const { getDB } = require('../config/database');

/**
 * Convert string to ObjectId
 */
const toObjectId = (id) => {
  if (!id) return null;
  if (typeof id === 'string') {
    return new ObjectId(id);
  }
  return id;
};

/**
 * Convert ObjectId to string
 */
const toString = (id) => {
  if (!id) return null;
  if (id.toString) {
    return id.toString();
  }
  return id;
};

/**
 * Validate ObjectId format
 */
const isValidObjectId = (id) => {
  if (!id) return false;
  return ObjectId.isValid(id);
};

/**
 * Create a new document with timestamps
 */
const createDocument = (data) => {
  const now = new Date();
  return {
    ...data,
    createdAt: now,
    updatedAt: now
  };
};

/**
 * Update document with timestamps
 */
const updateDocument = (data) => {
  return {
    ...data,
    updatedAt: new Date()
  };
};

/**
 * Pagination helper
 */
const paginate = (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  return { skip, limit: parseInt(limit) };
};

/**
 * Sort helper
 */
const sort = (sortBy = 'createdAt', order = 'desc') => {
  const sortOrder = order === 'desc' ? -1 : 1;
  return { [sortBy]: sortOrder };
};

/**
 * Search helper for text fields
 */
const createTextSearch = (searchTerm, fields = []) => {
  if (!searchTerm || !fields.length) return {};
  
  return {
    $or: fields.map(field => ({
      [field]: { $regex: searchTerm, $options: 'i' }
    }))
  };
};

/**
 * Date range filter helper
 */
const createDateRangeFilter = (startDate, endDate, field = 'createdAt') => {
  const filter = {};
  
  if (startDate) {
    filter[field] = { ...filter[field], $gte: new Date(startDate) };
  }
  
  if (endDate) {
    filter[field] = { ...filter[field], $lte: new Date(endDate) };
  }
  
  return filter;
};

/**
 * Get collection
 */
const getCollection = (collectionName) => {
  const db = getDB();
  return db.collection(collectionName);
};

/**
 * Common CRUD operations
 */
const crud = {
  // Create
  create: async (collectionName, data) => {
    const collection = getCollection(collectionName);
    const document = createDocument(data);
    const result = await collection.insertOne(document);
    return { ...document, _id: result.insertedId };
  },

  // Read by ID
  findById: async (collectionName, id) => {
    const collection = getCollection(collectionName);
    const objectId = toObjectId(id);
    if (!objectId) return null;
    return await collection.findOne({ _id: objectId });
  },

  // Read many with filters
  find: async (collectionName, filter = {}, options = {}) => {
    const collection = getCollection(collectionName);
    const { skip, limit } = paginate(options.page, options.limit);
    const sortOptions = sort(options.sortBy, options.order);
    
    const cursor = collection.find(filter).skip(skip).limit(limit).sort(sortOptions);
    const documents = await cursor.toArray();
    const total = await collection.countDocuments(filter);
    
    return {
      data: documents,
      pagination: {
        page: options.page || 1,
        limit: options.limit || 10,
        total,
        pages: Math.ceil(total / (options.limit || 10))
      }
    };
  },

  // Update by ID
  updateById: async (collectionName, id, data) => {
    const collection = getCollection(collectionName);
    const objectId = toObjectId(id);
    if (!objectId) throw new Error('Invalid ID');
    
    const updateData = updateDocument(data);
    const result = await collection.updateOne(
      { _id: objectId },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      throw new Error('Document not found');
    }
    
    return await collection.findOne({ _id: objectId });
  },

  // Delete by ID
  deleteById: async (collectionName, id) => {
    const collection = getCollection(collectionName);
    const objectId = toObjectId(id);
    if (!objectId) throw new Error('Invalid ID');
    
    const result = await collection.deleteOne({ _id: objectId });
    if (result.deletedCount === 0) {
      throw new Error('Document not found');
    }
    
    return { success: true };
  },

  // Count documents
  count: async (collectionName, filter = {}) => {
    const collection = getCollection(collectionName);
    return await collection.countDocuments(filter);
  },

  // Find one
  findOne: async (collectionName, filter = {}) => {
    const collection = getCollection(collectionName);
    return await collection.findOne(filter);
  },

  // Update many
  updateMany: async (collectionName, filter, data) => {
    const collection = getCollection(collectionName);
    const updateData = updateDocument(data);
    const result = await collection.updateMany(filter, { $set: updateData });
    return result;
  },

  // Delete many
  deleteMany: async (collectionName, filter) => {
    const collection = getCollection(collectionName);
    const result = await collection.deleteMany(filter);
    return result;
  }
};

module.exports = {
  toObjectId,
  toString,
  isValidObjectId,
  createDocument,
  updateDocument,
  paginate,
  sort,
  createTextSearch,
  createDateRangeFilter,
  getCollection,
  crud
};
