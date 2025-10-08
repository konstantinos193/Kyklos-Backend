// Upstash Redis REST API client (more reliable than TCP connection)
const axios = require('axios');

class UpstashRedis {
  constructor() {
    this.baseUrl = process.env.UPSTASH_REDIS_REST_URL;
    this.token = process.env.UPSTASH_REDIS_REST_TOKEN;
    this.isConfigured = !!(this.baseUrl && this.token);
  }

  async get(key) {
    if (!this.isConfigured) return null;
    
    try {
      const response = await axios.get(`${this.baseUrl}/get/${key}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      // Handle different response formats from Upstash
      if (!response.data) return null;
      
      // If response.data is already an object, return it
      if (typeof response.data === 'object') {
        return response.data;
      }
      
      // If response.data is a string, try to parse it
      if (typeof response.data === 'string') {
        try {
          return JSON.parse(response.data);
        } catch (parseError) {
          // If it's not valid JSON, return the string as is
          return response.data;
        }
      }
      
      return response.data;
    } catch (error) {
      console.error('Redis GET error:', error.message);
      return null;
    }
  }

  async set(key, value, ttl = 300) {
    if (!this.isConfigured) return;
    
    try {
      await axios.post(`${this.baseUrl}/set/${key}`, JSON.stringify(value), {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        params: { ex: ttl }
      });
    } catch (error) {
      console.error('Redis SET error:', error.message);
    }
  }

  async del(key) {
    if (!this.isConfigured) return;
    
    try {
      await axios.delete(`${this.baseUrl}/del/${key}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
    } catch (error) {
      console.error('Redis DEL error:', error.message);
    }
  }

  async delPattern(pattern) {
    if (!this.isConfigured) return;
    
    try {
      // Get all keys matching pattern
      const response = await axios.get(`${this.baseUrl}/keys/${pattern}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      if (response.data && response.data.length > 0) {
        // Delete each key individually since Upstash doesn't support bulk delete
        const deletePromises = response.data.map(key => 
          axios.delete(`${this.baseUrl}/del/${key}`, {
            headers: {
              'Authorization': `Bearer ${this.token}`
            }
          }).catch(err => {
            console.error(`Failed to delete key ${key}:`, err.message);
            return null; // Continue with other keys even if one fails
          })
        );
        
        await Promise.all(deletePromises);
      }
    } catch (error) {
      console.error('Redis DEL pattern error:', error.message);
    }
  }
}

const upstashRedis = new UpstashRedis();

// Connect function (for compatibility)
const connectRedis = async () => {
  if (!upstashRedis.isConfigured) {
    console.log('⚠️  Upstash Redis not configured - running without cache');
    return;
  }
  console.log('✅ Upstash Redis REST API configured');
};

module.exports = { 
  redisClient: upstashRedis, 
  connectRedis, 
  cache: upstashRedis 
};
