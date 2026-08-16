import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join, sep } from 'path';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

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

  // Keep this host out of the search index.
  //
  // The archive page links straight at files on api.kyklosedu.gr, so crawlers
  // walked onto the host and Search Console started reporting the API root as
  // "Crawled - currently not indexed". This API is machinery, not content:
  // everything outside /public/ is marked noindex so Google drops it, while the
  // archive PDFs under /public/ stay eligible.
  //
  // Crawling is deliberately left open - blocking the host in robots.txt would
  // stop Google fetching these URLs at all, and a URL that is never fetched can
  // never report its noindex.
  app.use((req, res, next) => {
    if (req.path === '/robots.txt') {
      res.type('text/plain').send('User-agent: *\nAllow: /public/\nDisallow: /api/\n');
      return;
    }

    if (!req.path.startsWith('/public/')) {
      res.setHeader('X-Robots-Tag', 'noindex');
    }

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

  // Rate limiting.
  //
  // The app sits behind nginx, so without trusting one proxy hop every request
  // appears to come from the proxy and the limiters would throttle all users as
  // a single client. One hop only - trusting the whole chain would let a caller
  // spoof X-Forwarded-For and sidestep the limits entirely.
  app.set('trust proxy', 1);

  const windowMs = parseInt(configService.get('RATE_LIMIT_WINDOW_MS') || '900000', 10);
  const authMax = parseInt(configService.get('AUTH_RATE_LIMIT_MAX') || '10', 10);
  const publicWriteMax = parseInt(configService.get('PUBLIC_WRITE_RATE_LIMIT_MAX') || '20', 10);

  const denied = (message: string) => ({ success: false, statusCode: 429, message });

  // Deliberately no catch-all limiter. Pages are rendered server-side, so every
  // SSR fetch reaches this API from the one frontend container address; a global
  // per-IP cap would count the whole site's traffic as a single client and lock
  // everyone out at once. Only the endpoints actually worth attacking are capped.
  const limiter = (limit: number, message: string, skipSuccessfulRequests = false) =>
    rateLimit({
      windowMs,
      limit,
      skipSuccessfulRequests,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: denied(message),
    });

  // Credentials. Successful sign-ins are not counted, so ordinary use never
  // erodes the budget - only failures do.
  const tooManyAttempts = 'Πάρα πολλές προσπάθειες. Δοκιμάστε ξανά αργότερα.';
  app.use('/api/admin/auth/login', limiter(authMax, tooManyAttempts, true));
  app.use('/api/admin/auth/create', limiter(authMax, tooManyAttempts, true));
  app.use('/api/admin/auth/refresh', limiter(authMax, tooManyAttempts, true));
  app.use('/api/auth/student-login', limiter(authMax, tooManyAttempts, true));

  // Unauthenticated writes, throttled against spam rather than guessing.
  const tooManyRequests = 'Πάρα πολλές αιτήσεις. Δοκιμάστε ξανά αργότερα.';
  app.use('/api/contact', limiter(publicWriteMax, tooManyRequests));
  app.use('/api/newsletter/subscribe', limiter(publicWriteMax, tooManyRequests));

  logger.log(`Rate limiting: auth=${authMax}, public writes=${publicWriteMax} per ${windowMs}ms`);

  // CORS configuration
  const isProduction = configService.get('NODE_ENV') === 'production';

  // An origin is only ever matched exactly, so every hostname the site is reachable
  // on has to be listed. Missing the www variant silently breaks every API call for
  // visitors who land on it.
  const withWwwVariants = (origin: string): string[] => {
    try {
      const url = new URL(origin);
      const bare = url.host.replace(/^www\./, '');
      // Only real domains get a www counterpart - not localhost or bare IPs.
      const isDomain = bare.includes('.') && !/^[\d.:]+$/.test(bare);
      return isDomain
        ? [`${url.protocol}//${bare}`, `${url.protocol}//www.${bare}`]
        : [`${url.protocol}//${url.host}`];
    } catch {
      return [origin];
    }
  };

  const configuredOrigins = [
    configService.get('FRONTEND_URL'),
    ...(configService.get('CORS_ORIGINS') ?? '').split(','),
    'https://kyklosedu.gr',
  ]
    .map((value: string | undefined) => value?.trim().replace(/\/$/, ''))
    .filter((value): value is string => Boolean(value));

  const allowedOrigins = Array.from(
    new Set([
      ...configuredOrigins.flatMap(withWwwVariants),
      // Local development hosts must never be trusted by the production API.
      ...(isProduction
        ? []
        : ['http://localhost:3000', 'http://localhost:8765', 'http://127.0.0.1:8765']),
    ]),
  );

  logger.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`);

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
  if (configService.get('NODE_ENV') === 'production') {
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

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global response interceptor
  app.useGlobalInterceptors(new TransformInterceptor());

  // Serve static files from public directory
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/public/',
    setHeaders: (res, path, stat) => {
      // Everything under /public/ exists to be embedded by the site, which is
      // on another origin. Helmet defaults every response to
      // Cross-Origin-Resource-Policy: same-origin, and a browser drops a
      // cross-origin <img> that carries it - the cover images would load in a
      // tab of their own and nowhere else.
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      // Uploads are named after a digest of their own bytes, so a given URL can
      // never point at different content. That makes them safe to cache
      // permanently - the browser stops revalidating, and a changed image is a
      // changed URL rather than a stale one.
      if (path.includes(`${sep}uploads${sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }

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

  const port = configService.get('PORT') || 5000;
  await app.listen(port);
  logger.log(`🚀 Server running on port ${port}`);
  logger.log(`📝 Environment: ${configService.get('NODE_ENV') || 'development'}`);
}

bootstrap();

