import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Cookie parser
  app.use(cookieParser());

  // Remove X-Frame-Options header for all responses (before helmet)
  app.use((req, res, next) => {
    res.removeHeader('X-Frame-Options');
    res.removeHeader('x-frame-options');
    next();
  });

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      frameguard: false, // Disable X-Frame-Options to allow embedding
    }),
  );

  // Ensure X-Frame-Options is not set after helmet
  app.use((req, res, next) => {
    res.removeHeader('X-Frame-Options');
    res.removeHeader('x-frame-options');
    next();
  });

  // Compression middleware
  app.use(
    compression({
      level: 6,
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
    }),
  );

  // CORS configuration
  const allowedOrigins = [
    process.env.FRONTEND_URL?.replace(/\/$/, ''),
    'https://kyklosedu.gr',
    'http://localhost:3000',
  ].filter(Boolean); // Remove undefined/null values

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }

      // Normalize origin by removing trailing slash
      const normalizedOrigin = origin.replace(/\/$/, '');
      
      // Check if the normalized origin matches any allowed origin
      const isAllowed = allowedOrigins.some(allowed => {
        const normalizedAllowed = allowed.replace(/\/$/, '');
        return normalizedOrigin === normalizedAllowed;
      });

      if (isAllowed) {
        callback(null, normalizedOrigin);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'X-Requested-With'],
    exposedHeaders: ['Content-Type', 'Content-Disposition'],
  });

  // Logging
  if (process.env.NODE_ENV === 'production') {
    app.use(morgan('combined'));
  } else {
    app.use(morgan('dev'));
  }

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Serve static files from public directory
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/public/',
    setHeaders: (res, path, stat) => {
      // Set proper headers for PDF files to allow embedding
      if (path.endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="' + path.split('/').pop() + '"');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        // Explicitly remove X-Frame-Options to allow embedding
        res.removeHeader('X-Frame-Options');
        res.removeHeader('x-frame-options');
        // Add CORS headers for PDF files to allow cross-origin requests
        // Use the first allowed origin or allow all if in development
        const pdfOrigin = allowedOrigins[0] || '*';
        res.setHeader('Access-Control-Allow-Origin', pdfOrigin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      }
    },
  });

  const port = process.env.PORT || 5000;
  await app.listen(port);
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();

