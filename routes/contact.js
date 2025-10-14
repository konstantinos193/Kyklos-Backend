const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const emailService = require('../utils/emailService');
const rateLimit = require('express-rate-limit');

// Rate limiting for contact form submissions
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // limit each IP to 3 contact form submissions per windowMs
  message: {
    success: false,
    message: 'Too many contact form submissions, please try again later'
  }
});

// POST /api/contact - Submit contact form
router.post('/', contactLimiter, [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('phone')
    .optional()
    .trim()
    .isLength({ min: 10, max: 20 })
    .withMessage('Phone number must be between 10 and 20 characters'),
  body('subject')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Subject must be between 5 and 200 characters'),
  body('message')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Message must be between 10 and 2000 characters')
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

    const { name, email, phone, subject, message } = req.body;

    // Verify email service is ready
    const isReady = await emailService.verifyConnection();
    if (!isReady) {
      return res.status(500).json({
        success: false,
        message: 'Email service not available. Please try again later.'
      });
    }

    // Send contact form email
    const result = await emailService.sendContactForm({
      name,
      email,
      phone: phone || 'Not provided',
      subject,
      message
    });

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Your message has been sent successfully. We will get back to you soon!'
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Failed to send message. Please try again.'
      });
    }
  } catch (error) {
    console.error('Contact form submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
});

module.exports = router;
