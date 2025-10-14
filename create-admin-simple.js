require('dotenv').config();
const { connectDB } = require('./config/database');
const AdminModel = require('./models/AdminModel');

async function createAdmin() {
  try {
    // Connect to database
    await connectDB();
    console.log('Connected to database');

    // Check if admin already exists
    const existingAdmin = await AdminModel.findOne({ email: 'grkyklos-@hotmail.gr' });
    if (existingAdmin) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    // Create admin user
    const admin = await AdminModel.create({
      email: 'grkyklos-@hotmail.gr',
      password: 'admin123',
      name: 'System Administrator',
      role: 'admin',
      isActive: true
    });

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: grkyklos-@hotmail.gr');
    console.log('🔑 Password: admin123');
    
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
  } finally {
    process.exit(0);
  }
}

createAdmin();
