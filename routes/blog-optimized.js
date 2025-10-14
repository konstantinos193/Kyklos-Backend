const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Blog = require('../models/Blog');
const { cache } = require('../config/upstash-redis');

// Cache duration constants
const CACHE_DURATION = {
  BLOG_LIST: 300, // 5 minutes
  BLOG_SINGLE: 600, // 10 minutes
  BLOG_CATEGORIES: 1800 // 30 minutes
};

// GET /api/blog - Get all published blog posts (OPTIMIZED)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, category, search, featured } = req.query;
    const cacheKey = `blog:list:${page}:${limit}:${category || 'all'}:${search || 'none'}:${featured || 'all'}`;
    
    // Try to get from cache first
    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      return res.json({
        success: true,
        data: cachedResult.data,
        pagination: cachedResult.pagination,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }
    
    // Build query
    const query = { status: 'published' };
    
    if (category) {
      query.category = category;
    }
    
    if (featured === 'true') {
      query.featured = true;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    // Optimized query with lean() for better performance
    const posts = await Blog.find(query)
      .select('title slug excerpt author category tags image publishDate readTime views likes featured')
      .lean()
      .sort({ featured: -1, publishDate: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Blog.countDocuments(query);
    
    const result = {
      data: posts,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        hasNext: parseInt(page) < Math.ceil(total / parseInt(limit)),
        hasPrev: parseInt(page) > 1
      }
    };
    
    // Cache the result
    await cache.set(cacheKey, result, CACHE_DURATION.BLOG_LIST);
    
    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      cached: false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching blog posts'
    });
  }
});

// GET /api/blog/categories - Get all categories (OPTIMIZED)
router.get('/categories', async (req, res) => {
  try {
    const cacheKey = 'blog:categories';
    
    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      return res.json({
        success: true,
        data: cachedResult,
        cached: true
      });
    }
    
    const categories = await Blog.distinct('category', { status: 'published' });
    
    await cache.set(cacheKey, categories, CACHE_DURATION.BLOG_CATEGORIES);
    
    res.json({
      success: true,
      data: categories,
      cached: false
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories'
    });
  }
});

// GET /api/blog/:id - Get single blog post (OPTIMIZED)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `blog:single:${id}`;
    
    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      // Increment view count asynchronously
      Blog.findByIdAndUpdate(id, { $inc: { views: 1 } }).exec();
      
      return res.json({
        success: true,
        data: cachedResult,
        cached: true
      });
    }
    
    const post = await Blog.findOne({ 
      $or: [
        { _id: id },
        { slug: id }
      ],
      status: 'published' 
    }).lean();
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }
    
    // Cache the result
    await cache.set(cacheKey, post, CACHE_DURATION.BLOG_SINGLE);
    
    // Increment view count asynchronously
    Blog.findByIdAndUpdate(post._id, { $inc: { views: 1 } }).exec();
    
    res.json({
      success: true,
      data: post,
      cached: false
    });
  } catch (error) {
    console.error('Error fetching blog post:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching blog post'
    });
  }
});

// POST /api/blog - Create new blog post (Admin only)
router.post('/', [
  body('title').notEmpty().withMessage('Title is required'),
  body('excerpt').notEmpty().withMessage('Excerpt is required'),
  body('content').notEmpty().withMessage('Content is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('author.name').notEmpty().withMessage('Author name is required')
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
    
    const post = new Blog(req.body);
    await post.save();
    
    // Clear related caches
    await cache.delPattern('blog:list:*');
    await cache.del('blog:categories');
    
    res.status(201).json({
      success: true,
      data: post,
      message: 'Blog post created successfully'
    });
  } catch (error) {
    console.error('Error creating blog post:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating blog post'
    });
  }
});

// PUT /api/blog/:id - Update blog post (Admin only)
router.put('/:id', async (req, res) => {
  try {
    const post = await Blog.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }
    
    // Clear related caches
    await cache.delPattern('blog:list:*');
    await cache.del(`blog:single:${req.params.id}`);
    await cache.del('blog:categories');
    
    res.json({
      success: true,
      data: post,
      message: 'Blog post updated successfully'
    });
  } catch (error) {
    console.error('Error updating blog post:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating blog post'
    });
  }
});

// DELETE /api/blog/:id - Delete blog post (Admin only)
router.delete('/:id', async (req, res) => {
  try {
    const post = await Blog.findByIdAndDelete(req.params.id);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }
    
    // Clear related caches
    await cache.delPattern('blog:list:*');
    await cache.del(`blog:single:${req.params.id}`);
    await cache.del('blog:categories');
    
    res.json({
      success: true,
      message: 'Blog post deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting blog post:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting blog post'
    });
  }
});

module.exports = router;
