const jwt = require('jsonwebtoken');

// Test token generation and verification
const testAdminData = {
  id: '507f1f77bcf86cd799439011',
  email: 'admin@kyklos.gr',
  name: 'Test Admin',
  role: 'admin'
};

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

console.log('JWT Secret:', JWT_SECRET);
console.log('Test Admin Data:', testAdminData);

// Generate token
const token = jwt.sign(testAdminData, JWT_SECRET, { expiresIn: '24h' });
console.log('Generated Token:', token);

// Verify token
try {
  const decoded = jwt.verify(token, JWT_SECRET);
  console.log('Decoded Token:', decoded);
  console.log('Token verification: SUCCESS');
} catch (error) {
  console.error('Token verification: FAILED', error.message);
}
