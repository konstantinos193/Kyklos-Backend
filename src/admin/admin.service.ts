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

  async findAll(filter: any = {}, options: { skip?: number; limit?: number; sort?: any } = {}) {
    const collection = this.getCollection();
    let query = collection.find(filter);
    
    if (options.sort) {
      query = query.sort(options.sort);
    }
    
    if (options.skip) {
      query = query.skip(options.skip);
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const admins = await query.toArray();
    // Remove password from results
    return admins.map(admin => {
      const { password, ...adminWithoutPassword } = admin;
      return adminWithoutPassword;
    });
  }

  async update(id: string | ObjectId, data: any) {
    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) throw new Error('Invalid ID');
    
    const updateData = { ...data, updatedAt: new Date() };
    const result = await collection.updateOne(
      { _id: objectId },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return null;
    }
    
    return await this.findById(id);
  }

  async delete(id: string | ObjectId) {
    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) throw new Error('Invalid ID');
    
    const result = await collection.deleteOne({ _id: objectId });
    return result.deletedCount > 0;
  }
}

