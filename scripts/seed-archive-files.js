require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

async function seedArchiveFiles() {
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

    console.log('🔍 Scanning public folders for PDF files...');

    const publicDir = path.join(process.cwd(), 'public');
    const subjects = {
      math: 'math',
      physics: 'physics', 
      ximia: 'ximia',
    };

    const filesToInsert = [];

    for (const [folder, subject] of Object.entries(subjects)) {
      const folderPath = path.join(publicDir, folder);
      
      if (!fs.existsSync(folderPath)) {
        console.log(`⚠️  Folder ${folder} does not exist, skipping...`);
        continue;
      }

      const files = fs.readdirSync(folderPath);
      
      for (const file of files) {
        if (!file.endsWith('.pdf')) continue;

        const filePath = path.join(folderPath, file);
        const stats = fs.statSync(filePath);
        
        // Extract year from filename
        const yearMatch = file.match(/20(\d{2})/);
        const year = yearMatch ? parseInt(`20${yearMatch[1]}`) : 2024;

        // Generate display name
        let displayName = file.replace('.pdf', '');
        if (subject === 'math') {
          displayName = displayName.replace('math_', 'Μαθηματικά ');
          displayName = displayName.replace('_panellinies_net', '');
          displayName = displayName.replace('_kat_', 'Κατεύθυνσης ');
          displayName = displayName.replace('_pros_', 'Προσανατολισμού ');
        } else if (subject === 'physics') {
          displayName = displayName.replace('fusiki_', 'Φυσική ');
          displayName = displayName.replace('_panellinies_net', '');
        } else if (subject === 'ximia') {
          displayName = displayName.replace('ximeia_', 'Χημεία ');
          displayName = displayName.replace('_panellinies_net', '');
        }

        // Generate unique ID from filename
        const publicId = file;

        // Check if file already exists in database
        const existing = await collection.findOne({ publicId });
        if (existing) {
          console.log(`⏭️  Skipping existing file: ${file}`);
          continue;
        }

        filesToInsert.push({
          displayName: displayName,
          fileName: file,
          subject: subject,
          year: year,
          description: '',
          url: `/public/${folder}/${file}`,
          fileUrl: `/public/${folder}/${file}`,
          publicId: publicId,
          mimeType: 'application/pdf',
          fileSize: stats.size,
          uploadedBy: null, // System uploaded
          uploadedByName: 'System',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        console.log(`📄 Found: ${file} (${subject}, ${year})`);
      }
    }

    if (filesToInsert.length === 0) {
      console.log('✅ No new files to insert');
      return;
    }

    console.log(`\n💾 Inserting ${filesToInsert.length} files into database...`);
    
    const result = await collection.insertMany(filesToInsert);
    console.log(`✅ Successfully inserted ${result.insertedCount} files`);

  } finally {
    await client.close();
  }
}

seedArchiveFiles().catch((error) => {
  console.error('❌ Failed to seed archive files:', error.message);
  process.exit(1);
});
