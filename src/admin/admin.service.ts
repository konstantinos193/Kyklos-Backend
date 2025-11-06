import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ObjectId } from 'mongodb';

@Injectable()
export class AdminService {
  private readonly COLLECTION_NAME = 'admins';

  constructor(private readonly databaseService: DatabaseService) {}

  private getCollection() {
    return this.databaseService.getDb().collection(this.COLLECTION_NAME);
  }

  private toObjectId(id: string | ObjectId): ObjectId | null {
    if (!id) return null;
    if (typeof id === 'string') {
      return new ObjectId(id);
    }
    return id;
  }

  async findByEmail(email: string) {
    const collection = this.getCollection();
    return await collection.findOne({ email: email.toLowerCase() });
  }

  async findById(id: string | ObjectId) {
    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) return null;
    return await collection.findOne({ _id: objectId });
  }

  async create(data: any) {
    const collection = this.getCollection();
    const result = await collection.insertOne(data);
    return { ...data, _id: result.insertedId };
  }

  async updateLastLogin(id: string | ObjectId) {
    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) throw new Error('Invalid ID');
    await collection.updateOne({ _id: objectId }, { $set: { lastLogin: new Date() } });
  }

  async count(filter: any = {}) {
    const collection = this.getCollection();
    return await collection.countDocuments(filter);
  }
}

