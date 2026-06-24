require('dotenv').config();
const { MongoClient } = require('mongodb');

async function updateArchiveUrls() {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'kyklos_frontistirio';

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined in environment variables.');
  }

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('panhellenicarchive');

    console.log('🔍 Finding files with old URL format...');
    
    // Find all files with old URL format
    const oldUrlFiles = await collection.find({
      $or: [
        { url: { $regex: '^/public/panhellenic-archive/' } },
        { fileUrl: { $regex: '^/public/panhellenic-archive/' } }
      ]
    }).toArray();

    console.log(`📁 Found ${oldUrlFiles.length} files with old URL format`);

    if (oldUrlFiles.length === 0) {
      console.log('✅ No files need updating');
      return;
    }

    // Update each file
    for (const file of oldUrlFiles) {
      const updateData = {};
      
      if (file.url && file.url.startsWith('/public/panhellenic-archive/')) {
        updateData.url = file.url.replace('/public/panhellenic-archive/', '/panhellenic-archive/');
      }
      
      if (file.fileUrl && file.fileUrl.startsWith('/public/panhellenic-archive/')) {
        updateData.fileUrl = file.fileUrl.replace('/public/panhellenic-archive/', '/panhellenic-archive/');
      }

      if (Object.keys(updateData).length > 0) {
        await collection.updateOne(
          { _id: file._id },
          { $set: { ...updateData, updatedAt: new Date() } }
        );
        console.log(`✅ Updated file: ${file.displayName}`);
      }
    }

    console.log('✅ All file URLs updated successfully');
  } finally {
    await client.close();
  }
}

updateArchiveUrls().catch((error) => {
  console.error('❌ Failed to update archive URLs:', error.message);
  process.exit(1);
});
