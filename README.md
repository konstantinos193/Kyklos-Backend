# ΚΥΚΛΟΣ Φροντιστήριο Backend API

Backend API for the ΚΥΚΛΟΣ Φροντιστήριο website, built with Node.js, Express, and MongoDB.

## Features

- 📝 Blog management system
- 📧 Newsletter subscription system
- 🔒 Secure API endpoints
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
- `EMAIL_*` - Email configuration for newsletter

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
3. Deploy automatically on push to main branch

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

## Error Handling

- Validation errors return 400 status
- Not found errors return 404 status
- Server errors return 500 status
- Rate limiting returns 429 status
