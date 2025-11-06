import { Injectable, OnModuleInit } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class CacheService implements OnModuleInit {
  private baseUrl: string;
  private token: string;
  private isConfigured: boolean;
  private networkWarned: boolean = false;

  constructor() {
    this.baseUrl = process.env.UPSTASH_REDIS_REST_URL || '';
    this.token = process.env.UPSTASH_REDIS_REST_TOKEN || '';
    this.isConfigured = !!(this.baseUrl && this.token);
  }

  onModuleInit() {
    if (!this.isConfigured) {
      console.log('⚠️  Upstash Redis not configured - running without cache');
    } else {
      console.log('✅ Upstash Redis REST API configured');
    }
  }

  async get(key: string): Promise<any> {
    if (!this.isConfigured) return null;

    try {
      const response = await axios.get(`${this.baseUrl}/get/${key}`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.data) return null;

      if (typeof response.data === 'object') {
        return response.data;
      }

      if (typeof response.data === 'string') {
        try {
          return JSON.parse(response.data);
        } catch (parseError) {
          return response.data;
        }
      }

      return response.data;
    } catch (error: any) {
      const msg = error?.message || '';
      const isNetwork = msg.includes('ENOTFOUND') || msg.includes('ECONN') || msg.includes('ENET');
      if (isNetwork) {
        if (!this.networkWarned) {
          console.warn('Redis GET network error detected; continuing without cache.');
          this.networkWarned = true;
        }
      } else {
        console.error('Redis GET error:', msg);
      }
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    if (!this.isConfigured) return;

    try {
      await axios.post(`${this.baseUrl}/set/${key}`, JSON.stringify(value), {
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        params: { ex: ttl },
      });
    } catch (error: any) {
      const msg = error?.message || '';
      const isNetwork = msg.includes('ENOTFOUND') || msg.includes('ECONN') || msg.includes('ENET');
      if (isNetwork) {
        if (!this.networkWarned) {
          console.warn('Redis SET network error detected; continuing without cache.');
          this.networkWarned = true;
        }
      } else {
        console.error('Redis SET error:', msg);
      }
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConfigured) return;

    try {
      await axios.delete(`${this.baseUrl}/del/${key}`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });
    } catch (error: any) {
      const msg = error?.message || '';
      const isNetwork = msg.includes('ENOTFOUND') || msg.includes('ECONN') || msg.includes('ENET');
      if (isNetwork) {
        if (!this.networkWarned) {
          console.warn('Redis DEL network error detected; continuing without cache.');
          this.networkWarned = true;
        }
      } else {
        console.error('Redis DEL error:', msg);
      }
    }
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.isConfigured) return;

    try {
      const response = await axios.get(`${this.baseUrl}/keys/${pattern}`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (response.data && response.data.length > 0) {
        const deletePromises = response.data.map((key: string) =>
          axios
            .delete(`${this.baseUrl}/del/${key}`, {
              headers: {
                Authorization: `Bearer ${this.token}`,
              },
            })
            .catch((err) => {
              console.error(`Failed to delete key ${key}:`, err.message);
              return null;
            }),
        );

        await Promise.all(deletePromises);
      }
    } catch (error: any) {
      const msg = error?.message || '';
      const isNetwork = msg.includes('ENOTFOUND') || msg.includes('ECONN') || msg.includes('ENET');
      if (isNetwork) {
        if (!this.networkWarned) {
          console.warn('Redis DEL pattern network error detected; continuing without cache.');
          this.networkWarned = true;
        }
      } else {
        console.error('Redis DEL pattern error:', msg);
      }
    }
  }
}

