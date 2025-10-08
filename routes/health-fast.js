const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

/**
 * @route GET /api/health/fast
 * @desc Fast health check - only checks essential services
 * @access Public
 */
router.get('/fast', async (req, res) => {
  const start = Date.now();
  
  try {
    // Quick database check (no ping)
    const dbConnected = mongoose.connection.readyState === 1;
    
    // Basic system info
    const payload = {
      status: dbConnected ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTimeMs: Date.now() - start,
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      services: {
        database: dbConnected,
        api: true
      },
      system: {
        memory: process.memoryUsage(),
        pid: process.pid,
        platform: process.platform,
        node: process.version
      }
    };

    res.status(dbConnected ? 200 : 503).json(payload);
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      error: err.message,
      responseTimeMs: Date.now() - start
    });
  }
});

/**
 * @route GET /api/health/ping
 * @desc Ultra-fast ping endpoint
 * @access Public
 */
router.get('/ping', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    responseTimeMs: 0
  });
});

module.exports = router;
