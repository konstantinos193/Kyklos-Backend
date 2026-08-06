const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../production.env') });
const { MongoClient } = require('mongodb');

async function checkAtlasConnection() {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'kyklos_db';

  console.log('🔍 Testing Atlas MongoDB connection...');
  console.log(`   URI: ${mongoUri.replace(/:([^:@]+)@/, ':****@')}`);
  console.log(`   DB: ${dbName}\n`);

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('✅ Successfully connected to Atlas MongoDB');

    const db = client.db(dbName);
    const collection = db.collection('panhellenicarchive');
    
    const count = await collection.countDocuments();
    console.log(`📊 Panhellenic archive documents: ${count}`);

    if (count > 0) {
      const sample = await collection.findOne();
      console.log(`\n📄 Sample document:`);
      console.log(`   Display Name: ${sample.displayName}`);
      console.log(`   Subject: ${sample.subject}`);
      console.log(`   Year: ${sample.year}`);
      console.log(`   URL: ${sample.url}`);
      console.log(`   isActive: ${sample.isActive}`);
    }

  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  } finally {
    await client.close();
  }
}

checkAtlasConnection();
