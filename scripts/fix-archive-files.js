const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../production.env') });
const { MongoClient } = require('mongodb');
const fs = require('fs');

async function fixArchiveFiles() {
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

    console.log('🔍 Fixing archive files...\n');

    // Get all files
    const files = await collection.find({}).toArray();
    console.log(`📊 Found ${files.length} files in database\n`);

    const targetDir = path.join(process.cwd(), 'public', 'panhellenic-archive');
    
    // Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      console.log(`✅ Created directory: ${targetDir}\n`);
    }

    let movedCount = 0;
    let updatedCount = 0;

    for (const file of files) {
      const publicId = file.publicId;
      if (!publicId) {
        console.log(`⚠️  Skipping file without publicId: ${file.displayName}`);
        continue;
      }

      // Determine source path based on subject
      let sourcePath;
      if (file.subject === 'math') {
        sourcePath = path.join(process.cwd(), 'public', 'math', publicId);
      } else if (file.subject === 'physics') {
        sourcePath = path.join(process.cwd(), 'public', 'physics', publicId);
      } else if (file.subject === 'ximia') {
        sourcePath = path.join(process.cwd(), 'public', 'ximia', publicId);
      } else {
        console.log(`⚠️  Unknown subject for file: ${file.displayName}`);
        continue;
      }

      const targetPath = path.join(targetDir, publicId);

      // Check if source file exists
      if (!fs.existsSync(sourcePath)) {
        console.log(`⚠️  Source file not found: ${sourcePath}`);
        continue;
      }

      // Check if target already exists
      if (fs.existsSync(targetPath)) {
        console.log(`⏭️  File already exists in target: ${publicId}`);
      } else {
        // Move file
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`📁 Moved: ${publicId} (${file.subject})`);
        movedCount++;
      }

      // Update database URL
      const newUrl = `/public/panhellenic-archive/${publicId}`;
      await collection.updateOne(
        { _id: file._id },
        { $set: { url: newUrl, fileUrl: newUrl, updatedAt: new Date() } }
      );
      updatedCount++;
    }

    console.log(`\n✅ Moved ${movedCount} files to /public/panhellenic-archive/`);
    console.log(`✅ Updated ${updatedCount} database records`);

  } finally {
    await client.close();
  }
}

fixArchiveFiles().catch((error) => {
  console.error('❌ Failed to fix archive files:', error.message);
  process.exit(1);
});
