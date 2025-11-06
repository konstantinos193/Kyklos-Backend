require('dotenv').config();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

async function createAdmin() {
  let client;
  try {
    // Connect to database
    const mongoUri = process.env.MONGODB_URI || '';
    const dbName = process.env.MONGODB_DB_NAME || 'kyklos_frontistirio';
    
    client = new MongoClient(mongoUri);
    await client.connect();
    console.log('✅ Connected to database');

    const db = client.db(dbName);
    const adminsCollection = db.collection('admins');

    // Check if admin already exists
    const existingAdmin = await adminsCollection.findOne({ email: 'grkyklos-@hotmail.gr' });
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists');
      process.exit(0);
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    // Create admin user
    const admin = {
      email: 'grkyklos-@hotmail.gr',
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
    };

    await adminsCollection.insertOne(admin);

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: grkyklos-@hotmail.gr');
    console.log('🔑 Password: admin123');
    
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
    }
    process.exit(0);
  }
}

createAdmin();
