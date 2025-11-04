// Simple test script to check deployment issues
require('dotenv').config();
const { connectDB, getDB } = require('./config/database');
const StudentModel = require('./models/StudentModel');
const BlogModel = require('./models/BlogModel');
const NewsletterModel = require('./models/NewsletterModel');

async function testDeployment() {
  console.log('🔍 Testing deployment...');
  console.log('Environment:', process.env.NODE_ENV);
  console.log('MongoDB URI exists:', !!process.env.MONGODB_URI);
  console.log('JWT Secret exists:', !!process.env.JWT_SECRET);
  
  try {
    // Test database connection
    console.log('📊 Connecting to database...');
    await connectDB();
    const db = getDB();
    console.log('✅ Database connected successfully');
    
    // Test models
    console.log('📝 Testing models...');
    const studentCount = await StudentModel.countDocuments({});
    console.log('✅ StudentModel working, count:', studentCount);
    
    const blogCount = await BlogModel.countDocuments({});
    console.log('✅ BlogModel working, count:', blogCount);
    
    const newsletterCount = await NewsletterModel.countDocuments({});
    console.log('✅ NewsletterModel working, count:', newsletterCount);
    
    // Test stats aggregation
    console.log('📊 Testing stats aggregation...');
    const [totalUsers, totalBlogs, totalSubscribers, viewsAgg] = await Promise.all([
      StudentModel.countDocuments({}).catch(() => 0),
      BlogModel.countDocuments({ status: 'published' }).catch(() => 0),
      NewsletterModel.countDocuments({ isActive: true }).catch(() => 0),
      BlogModel.aggregate([
        { $group: { _id: null, totalViews: { $sum: { $ifNull: ['$views', 0] } } } }
      ]).catch(() => [{ totalViews: 0 }])
    ]);
    
    const totalViews = Array.isArray(viewsAgg) && viewsAgg.length > 0 ? (viewsAgg[0].totalViews || 0) : 0;
    
    console.log('✅ Stats aggregation working:');
    console.log('  - Total Users:', totalUsers);
    console.log('  - Total Blogs:', totalBlogs);
    console.log('  - Total Subscribers:', totalSubscribers);
    console.log('  - Total Views:', totalViews);
    
    console.log('🎉 All tests passed!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testDeployment();
