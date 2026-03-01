# ΚΥΚΛΟΣ Εκπαίδευση Backend API - Where Data Goes to Get Organized (and Sometimes Lost)

<div class="flex items-center justify-start">
  <a href="https://kyklosedu.gr" class="flex items-center">
    <img alt="ΚΥΚΛΟΣ Εκπαίδευση" loading="eager" width="120" height="40" decoding="async" class="object-contain transition-all duration-300 max-w-[120px] sm:max-w-[140px] md:max-w-none" style="color:transparent;height:auto" src="https://kyklosedu.gr/logo.png">
  </a>
</div>

> **Because even ancient Greek literature needs a database to hide in** 
> Node.js wizardry • MongoDB sorcery • API magic that actually works • 0 students harmed in the making

**Author**: [konstantinos193](https://github.com/konstantinos193)  
**Property**: [adinfinity.gr](https://adinfinity.gr/)  
**Year**: 2026

[![Node.js](https://img.shields.io/badge/Node.js-20.9.0-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18.2-000000?style=for-the-badge&logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

## The Digital Backbone of Chaos

The **ΚΥΚΛΟΣ Εκπαίδευση Backend** is what happens when you need to organize 25+ years of educational chaos into something resembling a database. It's the invisible force that powers our digital asylum, handling everything from student data to blog posts nobody reads. Built with technology so reliable it's probably being used by the ancient gods themselves.

### What We've Got

- **RESTful API** - So clean you could eat off of it (but please don't)
- **MongoDB Database** - NoSQL because SQL is for people who enjoy suffering
- **JWT Authentication** - Security so tight even Socrates couldn't break in
- **Express.js Framework** - Minimalist web framework for maximal results
- **TypeScript Support** - Type safety because we make mistakes (unlike our students)
- **Rate Limiting** - Prevents API abuse (and student cheating)
- **CORS Protection** - Because cross-origin requests are the devil's work
- **Helmet Security** - Headers so secure they're basically Fort Knox

## The Tech Stack That Keeps the Lights On

### Backend Core
- **Node.js 20.9.0** - JavaScript runtime that never sleeps (like our students during exam season)
- **Express.js 4.18.2** - Web framework that's faster than a student running from homework
- **TypeScript 5.9.3** - Type-safe JavaScript so we don't accidentally summon database demons
- **MongoDB 6.0+** - Document database that's more flexible than our curriculum

### Authentication & Security
- **JWT (jsonwebtoken)** - Token-based authentication that's cryptographically secure
- **bcryptjs** - Password hashing so strong even Hercules couldn't crack it
- **Helmet.js** - Security headers because we care about not getting hacked
- **Express-rate-limit** - Rate limiting because some people have no self-control

### Database & Caching
- **Mongoose** - MongoDB ODM that makes database queries actually readable
- **Upstash Redis** - Caching layer faster than a student's excuse for missing homework
- **MongoDB Atlas** - Cloud database that's more reliable than our coffee machine

### Development Tools
- **Nodemon** - Auto-restart development server because we're lazy
- **Jest** - Testing framework because we pretend to care about code quality
- **ESLint** - Code linting to maintain the illusion of professionalism
- **Prettier** - Code formatting so it looks like we know what we're doing

## The Digital Catacombs

```
Kyklos-Backend/
├── src/                    # Source code (where the magic happens)
│   ├── admin/             # Admin-related routes and controllers
│   │   ├── auth/          # Admin authentication (because we can't trust anyone)
│   │   ├── blog/          # Blog management (for posts nobody reads)
│   │   ├── newsletter/    # Newsletter management (spam control center)
│   │   └── students/      # Student management (the power center)
│   ├── auth/              # Authentication routes (student login stuff)
│   ├── blog/              # Public blog routes (read-only access)
│   ├── config/            # Configuration files (the dark arts)
│   │   ├── database.ts    # Database connection (don't touch this)
│   │   ├── cloudinary.ts  # Image upload configuration
│   │   └── email.ts       # Email service configuration
│   ├── middleware/        # Express middleware (the bouncers)
│   │   ├── auth.ts        # Authentication middleware (gatekeeper)
│   │   ├── cors.ts        # CORS configuration (border control)
│   │   └── rateLimit.ts   # Rate limiting (party pooper)
│   ├── models/            # Database models (the blueprints)
│   │   ├── Admin.ts       # Admin user model (the overlords)
│   │   ├── Student.ts     # Student model (the victims)
│   │   ├── BlogPost.ts    # Blog post model (digital scrolls)
│   │   └── Newsletter.ts  # Newsletter subscriber model (the mailing list)
│   ├── routes/            # Route definitions (the road map)
│   │   ├── admin.ts       # Admin routes (VIP access)
│   │   ├── auth.ts        # Authentication routes (the security checkpoint)
│   │   ├── blog.ts        # Blog routes (public library)
│   │   ├── contact.ts     # Contact form route (digital suggestion box)
│   │   └── index.ts       # Main route file (the traffic controller)
│   ├── utils/             # Utility functions (the Swiss Army knife)
│   │   ├── apiResponse.ts # Standardized API responses
│   │   ├── validation.ts  # Input validation (the fact-checkers)
│   │   ├── email.ts       # Email utilities (digital post office)
│   │   └── cache.ts       # Caching utilities (short-term memory)
│   ├── app.controller.ts # Main application controller (the brain)
│   ├── app.module.ts      # Main application module (the heart)
│   └── main.ts            # Application entry point (the birth)
├── scripts/               # Utility scripts (the maintenance crew)
│   ├── reset-database.js  # Database reset button (the big red button)
│   └── reset-cloudinary.js # Cloudinary reset (digital spring cleaning)
├── public/                # Static assets (the public square)
│   ├── math/              # Math resources (numbers and stuff)
│   ├── physics/           # Physics resources (things that go boom)
│   └── ximia/             # Educational materials (the good stuff)
├── tests/                 # Test files (the torture chamber)
├── .env.example           # Environment variables template (the cheat sheet)
├── package.json           # Dependencies and scripts (the recipe book)
├── tsconfig.json          # TypeScript configuration (the rulebook)
├── jest.config.js         # Jest testing configuration (the test master)
└── README.md              # This file (you're reading it, dummy)
```

### Blog Posts (Digital Scrolls)
- `GET /api/blog` - Get all published blog posts (for the 3 people who read)
- `GET /api/blog/:id` - Get single blog post (if you can find the ID)
- `POST /api/blog` - Create new blog post (Admin only, mortals need not apply)
- `PUT /api/blog/:id` - Update blog post (Admin privileges required)
- `DELETE /api/blog/:id` - Delete blog post (Admin only, with great power comes great responsibility)

### Newsletter (Spam Control Center)
- `POST /api/newsletter/subscribe` - Subscribe to newsletter (join the spam club)
- `POST /api/newsletter/unsubscribe` - Unsubscribe from newsletter (leave the spam club)
- `GET /api/newsletter/subscribers` - Get all subscribers (Admin's mailing list)

### Admin Authentication (The VIP Lounge)
- `POST /api/admin/auth/login` - Admin login (show me the papers)
- `POST /api/admin/auth/logout` - Admin logout (don't let the door hit you)
- `GET /api/admin/auth/verify` - Verify admin token (are you really who you say you are?)

### Student Management (The Power Center)
- `GET /api/admin/students` - Get all students (Admin's student roster)
- `POST /api/admin/students` - Create new student (Admin creates victims)
- `PUT /api/admin/students/:id` - Update student (Admin modifies the subjects)
- `DELETE /api/admin/students/:id` - Delete student (Admin removes from existence)

### Student Authentication (The Student Gate)
- `POST /api/auth/student/login` - Student login (enter the matrix)
- `POST /api/auth/student/logout` - Student logout (exit the matrix)
- `GET /api/auth/student/verify` - Verify student token (who goes there?)

### Contact (Digital Suggestion Box)
- `POST /api/contact` - Send contact form (messages that go to /dev/null)

### Health Check (The Pulse Check)
- `GET /api/health` - API health status (is it alive?)
- `GET /health` - Detailed health check (how alive is it?)

## Environment Variables (The Secret Sauce)

Copy `env.example` to `.env` and pray you don't mess up:

```bash
cp env.example .env
```

### Required Variables (Don't Skip These)
- `MONGODB_URI` - MongoDB connection string (the database lifeline)
- `JWT_SECRET` - JWT secret for authentication (make it long and random)
- `FRONTEND_URL` - Frontend URL for CORS (where the frontend lives)
- `CLOUDINARY_*` - Cloudinary credentials for image uploads (cloud storage magic)
- `EMAIL_*` - Email configuration for newsletter and contact forms (digital post office)
- `UPSTASH_REDIS_*` - Redis cache configuration (short-term memory)

### Optional Variables (Nice to Have)
- `NODE_ENV` - Environment mode (development/production)
- `PORT` - Server port (default: 3001)
- `LOG_LEVEL` - Logging verbosity (how much noise to make)

## Setup Instructions (Follow These or Cry Trying)

### What You Need Before You Begin
- **Node.js** 20.9.0+ (because ancient versions are for ancient Greeks)
- **npm** 9.0+ or **pnpm** 8.0+ or **yarn** 1.22+ (we don't judge, but we prefer npm)
- **MongoDB** 6.0+ (database that's more reliable than our students)
- **Git** (because version control is for smart people)

### The Ritual of Installation

1. **Clone this monstrosity**
   ```bash
   git clone https://github.com/konstantinos193/Kyklos-Backend.git
   cd Kyklos-Backend
   ```

2. **Install the dependencies** (pray to the tech gods)
   ```bash
   npm install
   # or
   pnpm install
   # or
   yarn install
   ```

3. **Set up environment variables** (the secret sauce)
   ```bash
   cp env.example .env
   # Edit .env with your actual values (don't commit this!)
   ```

4. **Start the development server** (hold your breath)
   ```bash
   npm run dev
   # or
   pnpm dev
   # or
   yarn dev
   ```

5. **Verify it's working** (if it worked, buy a lottery ticket)
   ```
   http://localhost:3001/api/health
   ```

## Available Commands (Use Wisely)

| Command | What It Actually Does |
|--------|---------------------|
| `npm run dev` | Starts development server with auto-reload (the magic button) |
| `npm run build` | Compiles TypeScript to JavaScript (the transformation) |
| `npm run start` | Starts production server (if you're brave enough) |
| `npm test` | Runs tests (and probably finds bugs) |
| `npm run test:watch` | Runs tests in watch mode (for the patient developer) |
| `npm run lint` | Finds all your mistakes and judges you harshly |
| `npm run lint:fix` | Fixes some mistakes automatically (the merciful judge) |
| `npm run format` | Formats code so it looks like you know what you're doing |
| `npm run type-check` | TypeScript validation because TypeScript hates you |

## Database Models (The Digital Blueprints)

### Admin (The Overlords)
- **Email and hashed password** - Because plaintext passwords are for amateurs
- **Name and role** - admin/super_admin (the hierarchy of power)
- **Account status** - Active/inactive (the on/off switch)
- **Activity tracking** - Last login, IP addresses (big brother is watching)
- **JWT token management** - Because sessions are so 2010

### Student (The Victims)
- **Student ID** - Unique identifier (like a digital roll number)
- **Personal information** - Name, email, grade (the basics)
- **Access level** - What they can and can't do (the permissions)
- **Exam permissions** - Which materials they can access (the keys)
- **Created by admin** - Because students can't create themselves
- **Notes and status** - Admin's secret observations (the file)

### Blog Post (Digital Scrolls)
- **Title, slug, excerpt** - The basics of content management
- **Content** - The actual text (probably about ancient Greek)
- **Author information** - Who wrote this masterpiece
- **Category and tags** - Organization is key (or so they say)
- **Image with alt text** - Because we care about SEO and accessibility
- **SEO metadata** - Meta descriptions, keywords (Google bait)
- **Publishing status** - Draft/published (the release valve)
- **Dates** - Created/updated timestamps (the paper trail)

### Newsletter Subscriber (The Mailing List)
- **Email and name** - The basics of subscription
- **Subscription preferences** - What they want to receive (the choices)
- **Activity tracking** - When they subscribed, opened emails (the stats)
- **Bounce management** - Handling failed deliveries (the cleanup crew)

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
