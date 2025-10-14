const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const httpContext = require('express-http-context');
require('dotenv').config();
const connectDB = require('./config/database');
const { connectRedis, cache } = require('./config/upstash-redis');

// Connect to database
connectDB();

// Connect to Redis
connectRedis();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
  crossOriginEmbedderPolicy: false
}));

// Compression middleware (gzip)
app.use(compression({
  level: 6,
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control']
}));

// HTTP context for request tracking
app.use(httpContext.middleware);

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing with limits
app.use(express.json({ 
  limit: '1mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '1mb' 
}));

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'ΚΥΚΛΟΣ Φροντιστήριο API',
    version: '1.0.0',
    status: 'running'
  });
});

// Blog routes (optimized)
app.use('/api/blog', require('./routes/blog-optimized'));

// Newsletter routes (enhanced)
app.use('/api/newsletter', require('./routes/newsletter-enhanced'));

// Contact routes
app.use('/api/contact', require('./routes/contact'));

// Admin routes
app.use('/api/admin/auth', require('./routes/admin-auth'));
app.use('/api/admin/students', require('./routes/admin-students'));
app.use('/api/admin/stats', require('./routes/admin-stats'));

// Health routes
app.use('/api/health', require('./routes/health-fast'));

// Auth routes
app.use('/api/auth', require('./routes/auth'));

// Health check (detailed)
app.get('/health', async (req, res) => {
  const start = Date.now();

  const mongoose = require('mongoose');
  const { cache } = require('./config/upstash-redis');
  const emailService = require('./utils/emailService');

  // Helper: promise timeout
  const withTimeout = (promise, ms) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ]);
  };

  // DB check
  const dbCheck = (async () => {
    try {
      if (mongoose.connection.readyState !== 1) {
        // 1 = connected
        return { ok: false, details: 'not_connected' };
      }
      if (mongoose.connection.db && mongoose.connection.db.admin) {
        await mongoose.connection.db.admin().ping();
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, details: e.message };
    }
  })();

  // Cache/Redis check (simplified - just check if cache is available)
  const cacheCheck = (async () => {
    try {
      // Just try to get a simple key instead of set/get/del cycle
      await cache.get('health:check');
      return { ok: true };
    } catch (e) {
      return { ok: false, details: e.message };
    }
  })();

  // Email check (verify transporter)
  const emailCheck = (async () => {
    try {
      const ok = await emailService.verifyConnection();
      return { ok };
    } catch (e) {
      return { ok: false, details: e.message };
    }
  })();

  try {
    const [db, cacheOk, emailOk] = await Promise.all([
      withTimeout(dbCheck, 1000), // Reduced from 3000ms to 1000ms
      withTimeout(cacheCheck, 1000), // Reduced from 3000ms to 1000ms
      withTimeout(emailCheck, 1000) // Reduced from 3000ms to 1000ms
    ]);

    const services = {
      database: !!db.ok,
      cache: !!cacheOk.ok,
      email: !!emailOk.ok,
      api: true
    };

    const healthy = services.database && services.cache && services.email && services.api;
    const degraded = !healthy && (services.database || services.cache || services.email);

    const payload = {
      status: healthy ? 'healthy' : degraded ? 'degraded' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTimeMs: Date.now() - start,
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      services,
      details: {
        database: db,
        cache: cacheOk,
        email: emailOk,
      },
      system: {
        memory: process.memoryUsage(),
        pid: process.pid,
        platform: process.platform,
        node: process.version
      }
    };

    res.status(healthy ? 200 : degraded ? 200 : 503).json(payload);
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      error: err.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});
