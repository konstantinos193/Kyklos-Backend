require('dotenv').config();
const { connectDB } = require('./config/database');
const AdminModel = require('./models/AdminModel');

async function testLogin() {
  try {
    await connectDB();
    console.log('Connected to database');

    const email = 'grkyklos-@hotmail.gr';
    const password = 'admin123';

    console.log(`\nTesting login for: ${email}`);
    
    // Find admin
    const admin = await AdminModel.findByEmail(email);
    
    if (!admin) {
      console.log('❌ Admin not found!');
      
      // Try without isActive filter
      const adminWithoutFilter = await AdminModel.findOne({ email: email.toLowerCase() });
      if (adminWithoutFilter) {
        console.log('⚠️  Admin found but isActive might be false');
        console.log('Admin data:', {
          email: adminWithoutFilter.email,
          isActive: adminWithoutFilter.isActive,
          role: adminWithoutFilter.role
        });
        
        if (!adminWithoutFilter.isActive) {
          console.log('🔧 Fixing isActive to true...');
          await AdminModel.updateById(adminWithoutFilter._id, { isActive: true });
          console.log('✅ isActive set to true');
        }
      } else {
        console.log('❌ Admin does not exist in database at all');
        process.exit(1);
      }
    } else {
      console.log('✅ Admin found');
      console.log('Admin data:', {
        email: admin.email,
        isActive: admin.isActive,
        role: admin.role,
        hasPassword: !!admin.password
      });

      // Test password
      const isValid = await AdminModel.comparePassword(password, admin.password);
      if (isValid) {
        console.log('✅ Password is valid!');
      } else {
        console.log('❌ Password does not match!');
        console.log('⚠️  The password hash might be wrong. Resetting password...');
        
        // Reset password
        await AdminModel.updateById(admin._id, {
          password: password // This will be hashed in updateById
        });
        console.log('✅ Password reset! Try logging in again.');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

testLogin();

