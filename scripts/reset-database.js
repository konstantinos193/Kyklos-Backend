require('dotenv').config();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const DEFAULT_ADMIN_EMAIL = 'grkyklos-@hotmail.gr';
const DEFAULT_ADMIN_PASSWORD = 'admin123';

const ADMIN_EMAIL = (
  process.env.RESET_DB_ADMIN_EMAIL ||
  process.env.ADMIN_EMAIL ||
  DEFAULT_ADMIN_EMAIL
).toLowerCase();

const ADMIN_PASSWORD =
  process.env.RESET_DB_ADMIN_PASSWORD ||
  process.env.ADMIN_PASSWORD ||
  DEFAULT_ADMIN_PASSWORD;

async function recreateAdmin(db) {
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);

  const adminDocument = {
    email: ADMIN_EMAIL,
    password: hashedPassword,
    name: 'System Administrator',
    role: 'admin',
    isActive: true,
    permissions: {
      students: { create: true, read: true, update: true, delete: true },
      blog: { create: true, read: true, update: true, delete: true },
      newsletter: { create: true, read: true, update: true, delete: true },
      settings: { read: true, update: true },
    },
    createdAt: new Date(),
    lastLogin: null,
    updatedAt: new Date(),
  };

  await db.collection('admins').insertOne(adminDocument);
}

async function resetDatabase() {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'kyklos_frontistirio';

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined in environment variables.');
  }

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db(dbName);

    console.log(`🚨 Dropping database "${dbName}"...`);
    await db.dropDatabase();
    console.log('✅ Database dropped.');

    const cleanDb = client.db(dbName);
    console.log('👤 Recreating admin user...');
    await recreateAdmin(cleanDb);

    console.log('✅ Database reset complete.');
    console.log(`📧 Admin email: ${ADMIN_EMAIL}`);
    console.log(`🔑 Admin password: ${ADMIN_PASSWORD}`);
  } finally {
    await client.close();
  }
}

resetDatabase().catch((error) => {
  console.error('❌ Failed to reset database:', error.message);
  process.exit(1);
});


