import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

// Talks the Redis wire protocol to the in-house container over REDIS_URL.
//
// This used to be an Upstash REST client (axios against
// UPSTASH_REDIS_REST_URL), while the Docker deploy has pointed that variable
// at a plain redis://... container since it was introduced in 18fd5da. axios
// cannot speak to a redis:// URL, so every get() threw, was swallowed, and
// returned null: production has never served from cache, and nothing reported
// it because the health check counted "did not throw" as healthy. The REST
// path was also never exercised anywhere real: Upstash wraps replies in
// {result: ...} and get() handed that envelope back as the cached value.
//
// The cache is best-effort by design: a Redis that is down, misconfigured or
// still starting must never fail a request or hold the API up at boot. Every
// method short-circuits while the client is not ready and the client keeps
// reconnecting in the background. What it must not do is fail silently -
// ping() below tells the health endpoint the truth.
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: RedisClientType | null = null;
  private outageLogged = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const url = this.configService.get<string>('REDIS_URL') || '';
    if (!url) {
      this.logger.warn('REDIS_URL not set - running without cache');
      return;
    }

    this.client = createClient({
      url,
      // Commands issued while disconnected reject instead of piling up in a
      // queue that would all flush into Redis at once when it comes back.
      disableOfflineQueue: true,
      socket: {
        connectTimeout: 5000,
        // Keep retrying forever; the container may be restarting. Backs off
        // to one attempt every 10s so a long outage does not spin.
        reconnectStrategy: (retries) => Math.min(500 * (retries + 1), 10_000),
      },
    });

    // node-redis emits 'error' on every failed attempt. Log the first one of
    // an outage with its cause (ECONNREFUSED vs WRONGPASS matters), then stay
    // quiet until the connection is back.
    this.client.on('error', (err: Error) => {
      if (this.outageLogged) return;
      this.outageLogged = true;
      this.logger.warn(`Redis unavailable (${err.message}); continuing without cache`);
    });
    this.client.on('ready', () => {
      this.outageLogged = false;
      this.logger.log(`Redis connected (${describeTarget(url)})`);
    });

    // Deliberately not awaited: connect() stays pending while it retries, and
    // a Redis that is down at boot must not block the API from serving.
    this.client.connect().catch(() => {
      /* reported through the 'error' listener above */
    });
  }

  async onModuleDestroy() {
    if (!this.client) return;
    try {
      if (this.client.isOpen) await this.client.close();
    } catch {
      this.client.destroy();
    }
  }

  private get ready(): RedisClientType | null {
    return this.client?.isReady ? this.client : null;
  }

  // Called from the health endpoint. False when unconfigured or unreachable,
  // so an outage shows up as "degraded" instead of hiding behind a get() that
  // swallowed the error.
  async ping(): Promise<boolean> {
    const client = this.ready;
    if (!client) return false;
    try {
      return (await client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async get(key: string): Promise<any> {
    const client = this.ready;
    if (!client) return null;

    try {
      const raw = await client.get(key);
      // null on a miss; the typing also admits Buffer for other reply modes.
      if (typeof raw !== 'string') return null;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    } catch (error) {
      this.report('GET', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    const client = this.ready;
    if (!client) return;

    try {
      await client.set(key, JSON.stringify(value), { EX: ttl });
    } catch (error) {
      this.report('SET', error);
    }
  }

  async del(key: string): Promise<void> {
    const client = this.ready;
    if (!client) return;

    try {
      await client.del(key);
    } catch (error) {
      this.report('DEL', error);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    const client = this.ready;
    if (!client) return;

    try {
      // SCAN rather than KEYS: KEYS blocks the server for the whole keyspace.
      // One page of keys per iteration, deleted as a batch.
      for await (const keys of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        if (keys.length > 0) await client.del(keys);
      }
    } catch (error) {
      this.report('DEL pattern', error);
    }
  }

  private report(op: string, error: unknown) {
    // The socket dropped between the ready check and the command; the
    // 'error' listener has already logged the outage once.
    if (!this.client?.isReady) return;
    const msg = error instanceof Error ? error.message : String(error);
    this.logger.error(`Redis ${op} error: ${msg}`);
  }
}

// host:port for the boot log, never the password embedded in the URL.
function describeTarget(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || 6379}`;
  } catch {
    return 'unparseable REDIS_URL';
  }
}
