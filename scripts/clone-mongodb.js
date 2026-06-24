#!/usr/bin/env node

/**
 * MongoDB Cloning Script
 * Clones production MongoDB Atlas database to local MongoDB instance
 * 
 * Usage: node scripts/clone-mongodb.js
 * 
 * Environment variables required:
 * - SOURCE_MONGODB_URI: Production MongoDB Atlas URI
 * - TARGET_MONGODB_URI: Local MongoDB URI (e.g., mongodb://localhost:27017/kyklos_db)
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Configuration
const SOURCE_URI = process.env.SOURCE_MONGODB_URI || process.env.MONGODB_URI;
const TARGET_URI = process.env.TARGET_MONGODB_URI || 'mongodb://localhost:27017/kyklos_db';
const BATCH_SIZE = 1000;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function cloneDatabase() {
  let sourceClient;
  let targetClient;

  try {
    log('Starting MongoDB clone process...', 'blue');
    log(`Source: ${SOURCE_URI.replace(/:([^:@]+)@/, ':****@')}`, 'blue');
    log(`Target: ${TARGET_URI}`, 'blue');

    // Connect to source database
    log('Connecting to source database...', 'yellow');
    sourceClient = new MongoClient(SOURCE_URI);
    await sourceClient.connect();
    const sourceDb = sourceClient.db();
    log('Connected to source database', 'green');

    // Connect to target database
    log('Connecting to target database...', 'yellow');
    targetClient = new MongoClient(TARGET_URI);
    await targetClient.connect();
    const targetDb = targetClient.db();
    log('Connected to target database', 'green');

    // Get all collections from source
    const collections = await sourceDb.listCollections().toArray();
    log(`Found ${collections.length} collections to clone`, 'green');

    let totalDocuments = 0;
    let totalErrors = 0;

    // Clone each collection
    for (const collection of collections) {
      const collectionName = collection.name;
      log(`\nCloning collection: ${collectionName}`, 'blue');

      try {
        const sourceCollection = sourceDb.collection(collectionName);
        const targetCollection = targetDb.collection(collectionName);

        // Get document count
        const count = await sourceCollection.countDocuments();
        log(`  Documents to clone: ${count}`, 'yellow');

        if (count === 0) {
          log('  Skipping empty collection', 'yellow');
          continue;
        }

        // Drop target collection if exists
        await targetCollection.drop().catch(() => {});
        
        // Create indexes from source
        const indexes = await sourceCollection.indexes();
        for (const index of indexes) {
          if (index.name !== '_id_') {
            await targetCollection.createIndex(index.key, {
              name: index.name,
              unique: index.unique || false,
              sparse: index.sparse || false
            });
          }
        }

        // Clone documents in batches
        let skip = 0;
        let clonedCount = 0;

        while (skip < count) {
          const documents = await sourceCollection
            .find({})
            .skip(skip)
            .limit(BATCH_SIZE)
            .toArray();

          if (documents.length > 0) {
            await targetCollection.insertMany(documents, { ordered: false });
            clonedCount += documents.length;
            log(`  Progress: ${clonedCount}/${count} documents`, 'yellow');
          }

          skip += BATCH_SIZE;
        }

        totalDocuments += clonedCount;
        log(`  ✓ Cloned ${clonedCount} documents`, 'green');

      } catch (error) {
        log(`  ✗ Error cloning collection ${collectionName}: ${error.message}`, 'red');
        totalErrors++;
      }
    }

    // Summary
    log('\n=== Clone Summary ===', 'blue');
    log(`Total documents cloned: ${totalDocuments}`, 'green');
    log(`Total errors: ${totalErrors}`, totalErrors > 0 ? 'red' : 'green');
    log(`Collections processed: ${collections.length}`, 'green');

    if (totalErrors === 0) {
      log('\n✓ Database clone completed successfully!', 'green');
    } else {
      log('\n⚠ Database clone completed with errors', 'yellow');
    }

  } catch (error) {
    log(`\n✗ Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  } finally {
    if (sourceClient) await sourceClient.close();
    if (targetClient) await targetClient.close();
    log('Connections closed', 'blue');
  }
}

// Run the clone
cloneDatabase();
