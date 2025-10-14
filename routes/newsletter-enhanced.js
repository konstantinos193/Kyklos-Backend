const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const emailService = require('../utils/emailService');
const { cache } = require('../config/upstash-redis');

// Cache duration constants
const CACHE_DURATION = {
  STATS: 300, // 5 minutes
  SUBSCRIBERS: 600 // 10 minutes
};

// POST /api/newsletter/subscribe - Subscribe to newsletter
router.post('/subscribe', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('name').optional().trim().isLength({ max: 100 }).withMessage('Name too long'),
  body('source').optional().isIn(['website', 'admin', 'import']).withMessage('Invalid source')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, name = '', source = 'website' } = req.body;

    const result = await emailService.subscribeToNewsletter(email, name, source);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /api/newsletter/unsubscribe - Unsubscribe from newsletter
router.post('/unsubscribe', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email } = req.body;
    const result = await emailService.unsubscribeFromNewsletter(email);

    res.status(200).json({
      success: result.success,
      message: result.message
    });
  } catch (error) {
    console.error('Newsletter unsubscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/newsletter/stats - Get subscriber statistics (Admin only)
router.get('/stats', async (req, res) => {
  try {
    const stats = await emailService.getSubscriberStats();
    
    if (!stats) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch statistics'
      });
    }

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Newsletter stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/newsletter/subscribers - Get all subscribers (Admin only)
router.get('/subscribers', async (req, res) => {
  try {
    const { page = 1, limit = 50, status = 'active' } = req.query;
    const cacheKey = `newsletter:subscribers:${page}:${limit}:${status}`;
    
    // Try cache first
    let subscribers = await cache.get(cacheKey);
    
    if (!subscribers) {
      const query = status === 'all' ? {} : { isActive: status === 'active' };
      
      subscribers = await emailService.exportSubscribers('json');
      
      if (subscribers) {
        // Paginate results
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedSubscribers = subscribers.slice(startIndex, endIndex);
        
        subscribers = {
          data: paginatedSubscribers,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: subscribers.length,
            pages: Math.ceil(subscribers.length / limit)
          }
        };
        
        await cache.set(cacheKey, subscribers, CACHE_DURATION.SUBSCRIBERS);
      }
    }

    res.status(200).json({
      success: true,
      data: subscribers
    });
  } catch (error) {
    console.error('Get subscribers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /api/newsletter/send - Send newsletter to all subscribers (Admin only)
router.post('/send', [
  body('subject').notEmpty().trim().withMessage('Subject is required'),
  body('content').notEmpty().withMessage('Content is required'),
  body('featuredImage').optional().isURL().withMessage('Invalid image URL')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { subject, content, featuredImage } = req.body;
    
    // Verify email service is ready
    const isReady = await emailService.verifyConnection();
    if (!isReady) {
      return res.status(500).json({
        success: false,
        message: 'Email service not available'
      });
    }

    const result = await emailService.sendNewsletterToAll(subject, content, featuredImage);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Newsletter sent successfully',
        results: result.results
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Send newsletter error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/newsletter/export - Export subscribers (Admin only)
router.get('/export', async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    
    const data = await emailService.exportSubscribers(format);
    
    if (!data) {
      return res.status(500).json({
        success: false,
        message: 'Export failed'
      });
    }

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=subscribers.csv');
      res.send(data);
    } else {
      res.status(200).json({
        success: true,
        data: data
      });
    }
  } catch (error) {
    console.error('Export subscribers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/newsletter/verify - Verify email service status
router.get('/verify', async (req, res) => {
  try {
    const isReady = await emailService.verifyConnection();
    
    res.status(200).json({
      success: true,
      emailServiceReady: isReady
    });
  } catch (error) {
    console.error('Email service verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Email service verification failed'
    });
  }
});

module.exports = router;
