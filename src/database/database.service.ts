import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { MongoClient, Db } from 'mongodb';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    try {
      if (!this.client) {
        this.client = new MongoClient(process.env.MONGODB_URI || '', {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        });
        await this.client.connect();
      }

      const dbName = process.env.MONGODB_DB_NAME || 'kyklos_frontistirio';
      this.db = this.client.db(dbName);

      // Test connection
      await this.db.admin().ping();
      console.log(`📊 MongoDB Connected: ${dbName}`);
    } catch (error: any) {
      console.error('❌ Database connection error:', error.message);
      throw error;
    }
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  getClient(): MongoClient {
    if (!this.client) {
      throw new Error('Database client not initialized. Call connect() first.');
    }
    return this.client;
  }

  private async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }
}

