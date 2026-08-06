#!/bin/bash

# Script to seed panhellenic archive files on production server
# Run this on the production server via SSH

set -e

echo "🔍 Starting panhellenic archive seeding on production server..."

# Navigate to backend directory
cd /root/kyklos-backend

# Check if public directory exists
if [ ! -d "public" ]; then
    echo "❌ Public directory not found"
    exit 1
fi

# Create panhellenic-archive directory if it doesn't exist
mkdir -p public/panhellenic-archive

# Move files from subject folders to panhellenic-archive
echo "📁 Moving files to panhellenic-archive directory..."

for subject in math physics ximia; do
    if [ -d "public/$subject" ]; then
        for file in public/$subject/*.pdf; do
            if [ -f "$file" ]; then
                filename=$(basename "$file")
                if [ ! -f "public/panhellenic-archive/$filename" ]; then
                    cp "$file" "public/panhellenic-archive/"
                    echo "✅ Copied: $filename"
                else
                    echo "⏭️  Already exists: $filename"
                fi
            fi
        done
    fi
done

# Seed the database using Docker exec
echo "💾 Seeding MongoDB database..."

# Run the seed script inside the MongoDB container
docker exec kyklos-mongodb mongosh --eval "
use kyklos_db;
var collection = db.getCollection('panhellenicarchive');
var count = collection.countDocuments();
print('Current document count: ' + count);
"

# Create a temporary seed script
cat > /tmp/seed-archive.js << 'EOF'
const fs = require('fs');
const path = require('path');

const publicDir = '/app/public';
const subjects = {
  math: 'math',
  physics: 'physics', 
  ximia: 'ximia',
};

const filesToInsert = [];

for (const [folder, subject] of Object.entries(subjects)) {
  const folderPath = path.join(publicDir, folder);
  
  if (!fs.existsSync(folderPath)) {
    continue;
  }

  const files = fs.readdirSync(folderPath);
  
  for (const file of files) {
    if (!file.endsWith('.pdf')) continue;

    const filePath = path.join(folderPath, file);
    const stats = fs.statSync(filePath);
    
    const yearMatch = file.match(/20(\d{2})/);
    const year = yearMatch ? parseInt('20' + yearMatch[1]) : 2024;

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

    const publicId = file;

    filesToInsert.push({
      displayName: displayName,
      fileName: file,
      subject: subject,
      year: year,
      description: '',
      url: '/public/panhellenic-archive/' + file,
      fileUrl: '/public/panhellenic-archive/' + file,
      publicId: publicId,
      mimeType: 'application/pdf',
      fileSize: stats.size,
      uploadedBy: null,
      uploadedByName: 'System',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

print('Found ' + filesToInsert.length + ' files to insert');
filesToInsert;
EOF

# Copy the seed script to MongoDB container
docker cp /tmp/seed-archive.js kyklos-mongodb:/tmp/

# Run the seed script
docker exec kyklos-mongodb mongosh kyklos_db --eval "
const fs = require('fs');
const path = require('path');
const seedData = require('/tmp/seed-archive.js');
const collection = db.getCollection('panhellenicarchive');

let inserted = 0;
for (const file of seedData) {
  const existing = collection.findOne({ publicId: file.publicId });
  if (!existing) {
    collection.insertOne(file);
    inserted++;
    print('Inserted: ' + file.displayName);
  } else {
    print('Skipped: ' + file.displayName);
  }
}
print('Total inserted: ' + inserted);
"

# Clean up
rm /tmp/seed-archive.js

echo "✅ Seeding completed successfully"

# Restart the backend containers to pick up changes
echo "🔄 Restarting backend containers..."
docker-compose restart kyklos-backend-blue kyklos-backend-green

echo "✅ Done! Archive files are now available on production"
