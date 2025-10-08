const { createClient } = require('redis');

// Create Redis client with Upstash-specific configuration
const redisClient = createClient({
  url: process.env.REDIS_URL || process.env.REDISCLOUD_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: 10000,
    lazyConnect: true,
    // Upstash Redis configuration
    tls: process.env.REDIS_URL?.includes('rediss://') ? {} : undefined,
    reconnectStrategy: (retries) => {
      if (retries > 2) {
        console.log('❌ Redis max retries reached, giving up');
        return new Error('Max retries reached');
      }
      return Math.min(retries * 1000, 2000);
    }
  },
  // Upstash-specific options
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 1,
  enableReadyCheck: false,
  maxLoadingTimeout: 5000
});

redisClient.on('error', (err) => {
  console.error('❌ Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('🔗 Redis Connected');
});

redisClient.on('ready', () => {
  console.log('✅ Redis Ready');
});

// Connect to Redis
const connectRedis = async () => {
  // Skip Redis if no URL provided
  if (!process.env.REDIS_URL && !process.env.REDISCLOUD_URL) {
    console.log('⚠️  Redis not configured - running without cache');
    return;
  }

  try {
    console.log('🔄 Attempting to connect to Redis...');
    await redisClient.connect();
    console.log('✅ Redis connection established successfully!');
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error.message);
    console.log('⚠️  Continuing without Redis cache');
  }
};

// Cache helper functions
const cache = {
  async get(key) {
    try {
      if (!redisClient.isOpen) {
        return null; // Redis not available
      }
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  },

  async set(key, value, ttl = 300) { // Default 5 minutes
    try {
      if (!redisClient.isOpen) {
        return; // Redis not available
      }
      await redisClient.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Redis SET error:', error);
    }
  },

  async del(key) {
    try {
      if (!redisClient.isOpen) {
        return; // Redis not available
      }
      await redisClient.del(key);
    } catch (error) {
      console.error('Redis DEL error:', error);
    }
  },

  async delPattern(pattern) {
    try {
      if (!redisClient.isOpen) {
        return; // Redis not available
      }
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch (error) {
      console.error('Redis DEL pattern error:', error);
    }
  }
};

module.exports = { redisClient, connectRedis, cache };
