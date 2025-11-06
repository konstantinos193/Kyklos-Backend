import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CacheService } from '../cache/cache.service';
import { EmailService } from '../email/email.service';

@Controller('api/health')
export class HealthController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cacheService: CacheService,
    private readonly emailService: EmailService,
  ) {}

  @Get()
  async health() {
    const start = Date.now();

    const withTimeout = (promise: Promise<any>, ms: number) => {
      return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
      ]);
    };

    const dbCheck = (async () => {
      try {
        const db = this.databaseService.getDb();
        await db.admin().ping();
        return { ok: true };
      } catch (e: any) {
        return { ok: false, details: e.message };
      }
    })();

    const cacheCheck = (async () => {
      try {
        await this.cacheService.get('health:check');
        return { ok: true };
      } catch (e: any) {
        return { ok: false, details: e.message };
      }
    })();

    const emailCheck = (async () => {
      try {
        const ok = await this.emailService.verifyConnection();
        return { ok };
      } catch (e: any) {
        return { ok: false, details: e.message };
      }
    })();

    try {
      const [db, cacheOk, emailOk] = await Promise.all([
        withTimeout(dbCheck, 1000),
        withTimeout(cacheCheck, 1000),
        withTimeout(emailCheck, 1000),
      ]);

      const services = {
        database: !!db.ok,
        cache: !!cacheOk.ok,
        email: !!emailOk.ok,
        api: true,
      };

      const healthy = services.database && services.cache && services.email && services.api;
      const degraded = !healthy && (services.database || services.cache || services.email);

      const payload = {
        status: healthy ? 'healthy' : degraded ? 'degraded' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        responseTimeMs: Date.now() - start,
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        services,
        details: {
          database: db,
          cache: cacheOk,
          email: emailOk,
        },
        system: {
          memory: process.memoryUsage(),
          pid: process.pid,
          platform: process.platform,
          node: process.version,
        },
      };

      return payload;
    } catch (err: any) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        error: err.message,
      };
    }
  }

  @Get('fast')
  async healthFast() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

