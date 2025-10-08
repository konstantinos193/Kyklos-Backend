const { createClient } = require('redis');

const client = createClient({
  url: 'redis://default:AUYuAAIncDI3ZDg2NWQ4NzdhYzM0MzdiYmU2NDA4Mzk5NDlmY2Y4MXAyMTc5NjY@causal-whale-17966.upstash.io:6379',
  socket: {
    connectTimeout: 30000,
    lazyConnect: true,
    reconnectStrategy: (retries) => {
      if (retries > 5) {
        console.log('❌ Redis max retries reached, giving up');
        return new Error('Max retries reached');
      }
      return Math.min(retries * 200, 2000);
    }
  }
});

client.on('error', (err) => {
  console.error('❌ Redis Client Error:', err);
});

client.on('connect', () => {
  console.log('⚡ Redis Connected!');
});

client.on('ready', () => {
  console.log('✅ Redis Ready');
});

async function testRedis() {
  try {
    await client.connect();
    console.log('✅ Redis connection successful!');
    await client.ping();
    console.log('✅ Redis ping successful!');
    await client.disconnect();
    console.log('✅ Redis disconnected successfully!');
  } catch (err) {
    console.error('❌ Redis connection failed:', err.message);
  }
}

testRedis();
