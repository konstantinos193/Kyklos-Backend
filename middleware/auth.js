const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '') || 
                req.cookies?.adminToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }

  try {
    if (!process.env.JWT_SECRET) {
      console.error('JWT secret is not configured. Set JWT_SECRET in environment.');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error: JWT not configured'
      });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Invalid token.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.admin && (req.admin.role === 'admin' || req.admin.role === 'super_admin' || req.admin.role === 'moderator')) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
};

// Generate JWT token
const generateToken = (adminData) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT secret is not configured');
  }
  return jwt.sign(
    {
      id: adminData.id,
      email: adminData.email,
      name: adminData.name,
      role: adminData.role || 'admin'
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

module.exports = {
  verifyToken,
  isAdmin,
  generateToken
};
