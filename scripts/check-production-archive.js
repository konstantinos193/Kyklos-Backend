const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../production.env') });
const { MongoClient } = require('mongodb');

async function checkProductionArchive() {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = 'kyklos_db';

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined in environment variables.');
  }

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('panhellenicarchive');

    console.log('🔍 Checking production panhellenicarchive collection...\n');

    // Get total count
    const totalCount = await collection.countDocuments();
    console.log(`📊 Total documents: ${totalCount}\n`);

    // Get active count
    const activeCount = await collection.countDocuments({ isActive: true });
    console.log(`✅ Active documents (isActive: true): ${activeCount}\n`);

    // Get inactive count
    const inactiveCount = await collection.countDocuments({ isActive: false });
    console.log(`❌ Inactive documents (isActive: false): ${inactiveCount}\n`);

    // Sample documents
    if (totalCount > 0) {
      console.log('📄 Sample documents (first 5):');
      const samples = await collection.find({}).limit(5).toArray();
      samples.forEach((doc, i) => {
        console.log(`\n${i + 1}. ${doc.displayName || 'No displayName'}`);
        console.log(`   ID: ${doc._id}`);
        console.log(`   Subject: ${doc.subject}`);
        console.log(`   Year: ${doc.year}`);
        console.log(`   isActive: ${doc.isActive}`);
        console.log(`   URL: ${doc.url || doc.fileUrl || 'No URL'}`);
        console.log(`   publicId: ${doc.publicId || 'No publicId'}`);
      });
    } else {
      console.log('⚠️  No documents found in collection. You may need to run the seed script.');
    }

  } finally {
    await client.close();
  }
}

checkProductionArchive().catch((error) => {
  console.error('❌ Failed to check production archive:', error.message);
  process.exit(1);
});
