# ΚΥΚΛΟΣ Φροντιστήριο Backend API

Backend API for the ΚΥΚΛΟΣ Φροντιστήριο website, built with Node.js, Express, and MongoDB.

## Features

- 📝 Blog management system
- 📧 Newsletter subscription system
- 🔒 Admin authentication system with JWT
- 👥 Student management system
- 🎓 Exam materials access control
- 📊 MongoDB database integration
- 🚀 Optimized for Render deployment

## API Endpoints

### Blog Posts
- `GET /api/blog` - Get all published blog posts
- `GET /api/blog/:id` - Get single blog post
- `POST /api/blog` - Create new blog post (Admin)
- `PUT /api/blog/:id` - Update blog post (Admin)
- `DELETE /api/blog/:id` - Delete blog post (Admin)

### Newsletter
- `POST /api/newsletter/subscribe` - Subscribe to newsletter
- `POST /api/newsletter/unsubscribe` - Unsubscribe from newsletter
- `GET /api/newsletter/subscribers` - Get all subscribers (Admin)

### Admin Authentication
- `POST /api/admin/auth/login` - Admin login
- `POST /api/admin/auth/logout` - Admin logout
- `GET /api/admin/auth/verify` - Verify admin token

### Student Management
- `GET /api/admin/students` - Get all students (Admin)
- `POST /api/admin/students` - Create new student (Admin)
- `PUT /api/admin/students/:id` - Update student (Admin)
- `DELETE /api/admin/students/:id` - Delete student (Admin)

### Student Authentication
- `POST /api/auth/student/login` - Student login
- `POST /api/auth/student/logout` - Student logout
- `GET /api/auth/student/verify` - Verify student token

### Contact
- `POST /api/contact` - Send contact form

### Health Check
- `GET /api/health` - API health status
- `GET /health` - Detailed health check

## Environment Variables

Copy `env.example` to `.env` and configure:

```bash
cp env.example .env
```

Required variables:
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT secret for authentication
- `FRONTEND_URL` - Frontend URL for CORS
- `CLOUDINARY_*` - Cloudinary credentials for image uploads
- `EMAIL_*` - Email configuration for newsletter and contact forms
- `UPSTASH_REDIS_*` - Redis cache configuration

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

## Database Models

### Admin
- Email and hashed password
- Name and role (admin/super_admin)
- Account status and activity tracking
- JWT token management

### Student
- Student ID and personal information
- Access level and exam permissions
- Created by admin tracking
- Notes and status

### Blog Post
- Title, slug, excerpt, content
- Author information
- Category and tags
- Image with alt text
- SEO metadata
- Publishing status and dates

### Newsletter Subscriber
- Email and name
- Subscription preferences
- Activity tracking
- Bounce management

## Deployment on Render

1. Connect your GitHub repository
2. Set environment variables in Render dashboard
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Deploy automatically on push to main branch

### Default Admin Credentials
After deployment, you can create an admin user by running:
```bash
# Create admin user (run once after deployment)
node -e "
const Admin = require('./models/Admin');
const bcrypt = require('bcryptjs');
require('dotenv').config();
require('./config/database');

const createAdmin = async () => {
  const admin = new Admin({
    email: 'grkyklos-@hotmail.gr',
    password: 'admin123',
    name: 'System Administrator',
    role: 'admin'
  });
  await admin.save();
  console.log('Admin created successfully!');
  process.exit(0);
};
createAdmin();
"
```

## Development

```bash
# Install dependencies
npm install

# Start with nodemon
npm run dev

# Run tests
npm test
```

## API Response Format

All API responses follow this format:

```json
{
  "success": true,
  "data": {},
  "message": "Success message",
  "pagination": {
    "current": 1,
    "pages": 5,
    "total": 50
  }
}
```

## Authentication

### Admin Authentication
- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- Secure cookie management

### Student Authentication
- Student ID-based login
- Access level permissions
- Exam materials access control
- Admin-managed permissions

## Error Handling

- Validation errors return 400 status
- Not found errors return 404 status
- Unauthorized access returns 401 status
- Forbidden access returns 403 status
- Server errors return 500 status
- Rate limiting returns 429 status

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- CORS protection
- Helmet security headers
- Rate limiting
- Input validation
- SQL injection protection via Mongoose
