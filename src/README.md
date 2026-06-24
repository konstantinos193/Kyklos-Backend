# Kyklos Backend

## Overview
NestJS backend for the Kyklos tutoring platform with MongoDB database.

## Architecture

### Layer Pattern
- **Controllers**: Handle HTTP requests and responses
- **Services**: Business logic layer
- **Repositories**: Data access layer (BaseRepository pattern)
- **DTOs**: Data Transfer Objects with validation
- **Filters**: Global exception handling
- **Interceptors**: Response transformation

### Key Features
- JWT Authentication (Admin & Student)
- Role-based access control
- File upload/management
- Rate limiting (Redis-compatible)
- Caching (Redis-compatible)
- Input validation with class-validator
- Global error handling
- Standardized API responses

## Environment Variables
```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=kyklos_frontistirio
JWT_SECRET=your-secret-key
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
UPLOAD_DIR=./uploads
```

## Project Structure
```
src/
├── admin/                  # Admin module
│   ├── repositories/       # Admin repository
│   ├── dto/               # Admin DTOs
│   └── *.service.ts       # Admin service
├── students/              # Students module
│   ├── repositories/      # Student repository
│   └── *.service.ts       # Student service
├── auth/                  # Authentication
│   └── guards/            # JWT guards
├── common/                # Shared utilities
│   ├── repositories/      # Base repository
│   ├── filters/           # Exception filters
│   ├── interceptors/      # Response interceptors
│   ├── storage/           # File storage service
│   └── interfaces/        # TypeScript interfaces
└── main.ts                # Application bootstrap
```

## Running the Application

### Development
```bash
npm install
npm run start:dev
```

### Production
```bash
npm run build
npm run start:prod
```

## API Response Format

All responses follow this standard format:

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Error responses:
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Error message",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/endpoint"
}
```

## Audit Improvements Completed

### High Priority
- ✅ JWT_SECRET security fixes
- ✅ NestJS exception handling
- ✅ Response handling improvements

### Medium Priority
- ✅ Logging framework (NestJS Logger)
- ✅ Type safety improvements
- ✅ Pagination implementation
- ✅ Circular dependency fixes
- ✅ ConfigService usage
- ✅ Input validation with DTOs
- ✅ Query parameter DTOs

### Low Priority
- ✅ Rate limiting (cache-backed)
- ✅ File storage decoupling
- ✅ Error boundaries
- ✅ API response standardization
- ✅ Repository layer pattern

## License
Proprietary
