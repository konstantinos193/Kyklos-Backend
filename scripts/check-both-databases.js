const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../production.env') });
const { MongoClient } = require('mongodb');

async function checkBothDatabases() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined in environment variables.');
  }

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();

    // Check kyklos_db (the one in connection string)
    const db1 = client.db('kyklos_db');
    const collection1 = db1.collection('panhellenicarchive');
    const count1 = await collection1.countDocuments();
    console.log(`📊 kyklos_db panhellenicarchive count: ${count1}`);

    // Check kyklos_frontistirio (the default fallback)
    const db2 = client.db('kyklos_frontistirio');
    const collection2 = db2.collection('panhellenicarchive');
    const count2 = await collection2.countDocuments();
    console.log(`📊 kyklos_frontistirio panhellenicarchive count: ${count2}`);

    if (count1 > 0) {
      console.log(`\n✅ Data is in kyklos_db`);
    } else if (count2 > 0) {
      console.log(`\n⚠️  Data is in kyklos_frontiturio (wrong database)`);
    } else {
      console.log(`\n❌ No data in either database`);
    }

  } finally {
    await client.close();
  }
}

checkBothDatabases().catch((error) => {
  console.error('❌ Failed to check databases:', error.message);
  process.exit(1);
});
