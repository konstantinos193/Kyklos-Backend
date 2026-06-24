import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ObjectId } from 'mongodb';

export interface PaginationOptions {
  page?: number;
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export abstract class BaseRepository<T> {
  protected readonly logger = new Logger(this.constructor.name);
  protected readonly collectionName: string;

  constructor(protected readonly databaseService: DatabaseService, collectionName: string) {
    this.collectionName = collectionName;
  }

  protected getCollection() {
    return this.databaseService.getDb().collection(this.collectionName);
  }

  protected toObjectId(id: string | ObjectId): ObjectId | null {
    if (!id) return null;
    if (typeof id === 'string') {
      if (!ObjectId.isValid(id)) return null;
      return new ObjectId(id);
    }
    return id;
  }

  protected isValidObjectId(id: string | ObjectId): boolean {
    if (!id) return false;
    return ObjectId.isValid(id);
  }

  async create(data: Partial<T>): Promise<T> {
    const collection = this.getCollection();
    const result = await collection.insertOne({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { ...data, _id: result.insertedId } as T;
  }

  async findById(id: string | ObjectId): Promise<T | null> {
    const objectId = this.toObjectId(id);
    if (!objectId) return null;

    const collection = this.getCollection();
    return await collection.findOne({ _id: objectId }) as T | null;
  }

  async findOne(filter: Record<string, any>): Promise<T | null> {
    const collection = this.getCollection();
    return await collection.findOne(filter) as T | null;
  }

  async find(
    filter: Record<string, any> = {},
    options: PaginationOptions = {},
  ): Promise<PaginationResult<T>> {
    const collection = this.getCollection();
    const { page = 1, limit = 50, sort = { createdAt: -1 } } = options;
    const skip = options.skip || (page - 1) * limit;

    const [data, total] = await Promise.all([
      collection.find(filter).sort(sort).skip(skip).limit(limit).toArray() as Promise<T[]>,
      collection.countDocuments(filter),
    ]);

    return {
      data: data as unknown as T[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAll(filter: Record<string, any> = {}): Promise<T[]> {
    const collection = this.getCollection();
    const result = await collection.find(filter).toArray();
    return result as unknown as T[];
  }

  async update(
    id: string | ObjectId,
    data: Partial<T>,
  ): Promise<T | null> {
    const objectId = this.toObjectId(id);
    if (!objectId) throw new BadRequestException('Invalid ID');

    const collection = this.getCollection();
    const updateData = { ...data, updatedAt: new Date() };
    const result = await collection.updateOne(
      { _id: objectId },
      { $set: updateData },
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException('Document not found');
    }

    return this.findById(id);
  }

  async updateOne(
    filter: Record<string, any>,
    data: Partial<T>,
  ): Promise<boolean> {
    const collection = this.getCollection();
    const updateData = { ...data, updatedAt: new Date() };
    const result = await collection.updateOne(filter, { $set: updateData });
    return result.matchedCount > 0;
  }

  async delete(id: string | ObjectId): Promise<boolean> {
    const objectId = this.toObjectId(id);
    if (!objectId) throw new BadRequestException('Invalid ID');

    const collection = this.getCollection();
    const result = await collection.deleteOne({ _id: objectId });
    return result.deletedCount > 0;
  }

  async count(filter: Record<string, any> = {}): Promise<number> {
    const collection = this.getCollection();
    return await collection.countDocuments(filter);
  }

  async exists(filter: Record<string, any>): Promise<boolean> {
    const count = await this.count(filter);
    return count > 0;
  }
}
