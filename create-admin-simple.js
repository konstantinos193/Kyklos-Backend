require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');

async function createAdmin() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: 'grkyklos-@hotmail.gr' });
    if (existingAdmin) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    // Create admin user
    const admin = new Admin({
      email: 'grkyklos-@hotmail.gr',
      password: 'admin123',
      name: 'System Administrator',
      role: 'admin',
      isActive: true
    });

    await admin.save();
    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: grkyklos-@hotmail.gr');
    console.log('🔑 Password: admin123');
    
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

createAdmin();
