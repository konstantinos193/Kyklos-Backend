import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ObjectId } from 'mongodb';

@Injectable()
export class NewsletterService {
  private readonly COLLECTION_NAME = 'newsletters';

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

  async create(data: any) {
    const collection = this.getCollection();
    const newsletterData = {
      ...data,
      subscribedAt: new Date(),
      isActive: data.isActive !== undefined ? data.isActive : true,
    };
    const result = await collection.insertOne(newsletterData);
    return { ...newsletterData, _id: result.insertedId };
  }

  async findById(id: string | ObjectId) {
    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) return null;
    return await collection.findOne({ _id: objectId });
  }

  async findOne(filter: any) {
    const collection = this.getCollection();
    return await collection.findOne(filter);
  }

  async findByEmail(email: string) {
    return await this.findOne({ email: email.toLowerCase() });
  }

  async updateById(id: string | ObjectId, data: any) {
    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) throw new Error('Invalid ID');

    const updateData = {
      ...data,
      updatedAt: new Date(),
    };

    const result = await collection.updateOne({ _id: objectId }, { $set: updateData });
    if (result.matchedCount === 0) {
      throw new Error('Document not found');
    }

    return await collection.findOne({ _id: objectId });
  }

  async resubscribe(email: string) {
    const subscriber = await this.findByEmail(email);
    if (!subscriber) {
      throw new Error('Subscriber not found');
    }

    return await this.updateById(subscriber._id, {
      isActive: true,
      subscribedAt: new Date(),
      unsubscribedAt: null,
    });
  }

  async count(filter: any = {}) {
    const collection = this.getCollection();
    return await collection.countDocuments(filter);
  }

  async find(filter: any = {}, options: any = {}) {
    const collection = this.getCollection();
    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;

    const cursor = collection.find(filter).skip(skip).limit(limit);
    const documents = await cursor.toArray();
    const total = await collection.countDocuments(filter);

    return {
      data: documents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}

