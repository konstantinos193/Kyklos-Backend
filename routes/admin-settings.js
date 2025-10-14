const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(verifyToken);
router.use(isAdmin);

// GET /api/admin/settings - Get all settings
router.get('/', async (req, res) => {
  try {
    // For now, return default settings
    // In a real app, these would be stored in database
    const settings = {
      general: {
        siteName: 'ΚΥΚΛΟΣ Φροντιστήριο',
        siteDescription: 'Εκπαιδευτικό Κέντρο Αριστείας',
        siteUrl: 'https://kyklosedu.gr',
        adminEmail: 'grkyklos-@hotmail.gr',
        timezone: 'Europe/Athens',
        language: 'el'
      },
      email: {
        smtpHost: 'smtp.gmail.com',
        smtpPort: '587',
        smtpUser: 'grkyklos-@hotmail.gr',
        smtpSecure: false,
        fromName: 'ΚΥΚΛΟΣ Φροντιστήριο',
        fromEmail: 'grkyklos-@hotmail.gr'
      },
      security: {
        enableTwoFactor: false,
        sessionTimeout: '24',
        maxLoginAttempts: '5',
        passwordMinLength: '8',
        requireEmailVerification: true
      },
      notifications: {
        emailNotifications: true,
        adminNotifications: true,
        userRegistration: true,
        newComment: true,
        newsletterSignup: true,
        systemAlerts: true
      },
      database: {
        backupFrequency: 'daily',
        backupRetention: '30',
        enableLogging: true,
        logLevel: 'info',
        maxLogSize: '100'
      }
    };

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching settings'
    });
  }
});

// PUT /api/admin/settings - Update settings
router.put('/', async (req, res) => {
  try {
    const settings = req.body;
    
    // TODO: Save settings to database
    // For now, just return success
    
    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating settings'
    });
  }
});

module.exports = router;
