const { MongoClient } = require('mongodb');

let client = null;
let db = null;

const connectDB = async () => {
  try {
    if (!client) {
      client = new MongoClient(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
    }

    if (!client.topology || !client.topology.isConnected()) {
      await client.connect();
    }

    // Get database name from URI or use default
    const dbName = process.env.MONGODB_DB_NAME || 'kyklos_frontistirio';
    db = client.db(dbName);

    console.log(`📊 MongoDB Connected: ${client.options.hosts[0].host}`);
    return db;
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

const getDB = () => {
  if (!db) {
    throw new Error('Database not connected. Call connectDB() first.');
  }
  return db;
};

const getClient = () => {
  if (!client) {
    throw new Error('Database client not initialized. Call connectDB() first.');
  }
  return client;
};

const closeDB = async () => {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
};

module.exports = {
  connectDB,
  getDB,
  getClient,
  closeDB
};
