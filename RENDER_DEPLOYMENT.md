# 🚀 Render Deployment Guide

## Prerequisites

1. **MongoDB Atlas** (Free tier available)
2. **Redis Cloud** (Free tier available) 
3. **GitHub Repository** with your code

## Step 1: Set up MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free cluster
3. Create a database user
4. Get your connection string: `mongodb+srv://username:password@cluster.mongodb.net/kyklos_db`

## Step 2: Set up Upstash Redis (FREE)

1. Go to [Upstash](https://upstash.com/)
2. Sign up (no credit card required)
3. Create a new database
4. Get your connection string: `rediss://username:password@host:port`
5. **Free tier**: 10,000 requests/day (perfect for small projects)

## Step 3: Deploy to Render

1. **Connect GitHub Repository**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the `backend` folder

2. **Configure Build Settings**
   ```
   Build Command: npm install
   Start Command: npm start
   ```

3. **Set Environment Variables**
   ```
   NODE_ENV=production
   PORT=10000
   FRONTEND_URL=https://your-frontend-app.onrender.com
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/kyklos_db
   REDIS_URL=rediss://username:password@host:port
   # Get this from Upstash (free tier)
   JWT_SECRET=your-super-secret-jwt-key-here
   CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
   CLOUDINARY_API_KEY=your-cloudinary-api-key
   CLOUDINARY_API_SECRET=your-cloudinary-api-secret
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   EMAIL_FROM=noreply@kyklosedu.gr
   ```

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Your API will be available at: `https://your-backend-app.onrender.com`

## Step 4: Update Frontend

Update your frontend's environment variables:

```bash
# In my-nextjs-app/.env.local
NEXT_PUBLIC_API_URL=https://your-backend-app.onrender.com
```

## Step 5: Test the API

```bash
# Health check
curl https://your-backend-app.onrender.com/health

# Get blog posts
curl https://your-backend-app.onrender.com/api/blog

# Subscribe to newsletter
curl -X POST https://your-backend-app.onrender.com/api/newsletter/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

## Performance Features

✅ **Redis Caching** - 5-10x faster responses
✅ **Gzip Compression** - 70% smaller responses  
✅ **Database Optimization** - Lean queries
✅ **Error Handling** - Graceful degradation
✅ **Rate Limiting** - DDoS protection

## Monitoring

- Check Render logs for any issues
- Monitor Redis Cloud dashboard
- Monitor MongoDB Atlas metrics

## Troubleshooting

**Redis Connection Issues:**
- Check Redis Cloud credentials
- Ensure Redis URL is correct
- App will work without Redis (just slower)

**MongoDB Connection Issues:**
- Check MongoDB Atlas IP whitelist
- Verify connection string
- Check database user permissions

**Build Failures:**
- Check Node.js version (18+)
- Verify all dependencies in package.json
- Check build logs in Render dashboard
