import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ObjectId } from 'mongodb';

@Injectable()
export class StudentService {
  private readonly COLLECTION_NAME = 'students';

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

  private isValidObjectId(id: string | ObjectId): boolean {
    if (!id) return false;
    return ObjectId.isValid(id);
  }

  /**
   * Generate a unique student key in format: STU-YYYY-XXXXXX-X
   * Where YYYY is the year, XXXXXX is 6 random alphanumeric characters, and X is a random letter
   */
  private generateUniqueKey(): string {
    const year = new Date().getFullYear();
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    
    // Generate 6 random alphanumeric characters
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Generate a random letter suffix
    const suffix = letters.charAt(Math.floor(Math.random() * letters.length));
    
    return `STU-${year}-${randomPart}-${suffix}`;
  }

  /**
   * Generate a unique key that doesn't exist in the database
   */
  private async generateUniqueKeyWithCheck(): Promise<string> {
    const collection = this.getCollection();
    let attempts = 0;
    const maxAttempts = 100;
    
    while (attempts < maxAttempts) {
      const key = this.generateUniqueKey();
      const existing = await collection.findOne({ uniqueKey: key });
      
      if (!existing) {
        return key;
      }
      
      attempts++;
    }
    
    // If we couldn't generate a unique key after max attempts, throw an error
    throw new BadRequestException('Unable to generate unique student key. Please try again.');
  }

  async create(data: any) {
    // Generate unique key if not provided
    let uniqueKey = data.uniqueKey;
    if (!uniqueKey || uniqueKey.trim() === '') {
      uniqueKey = await this.generateUniqueKeyWithCheck();
    } else {
      // Check if provided key is unique
      const collection = this.getCollection();
      const existing = await collection.findOne({ uniqueKey: uniqueKey.toUpperCase() });
      if (existing) {
        throw new BadRequestException(`Student key ${uniqueKey} already exists`);
      }
      uniqueKey = uniqueKey.toUpperCase();
    }

    const studentData = {
      ...data,
      uniqueKey,
      registrationDate: new Date(),
      lastLogin: null,
      hasAccessToThemata: data.hasAccessToThemata !== undefined ? data.hasAccessToThemata : false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const collection = this.getCollection();
    const result = await collection.insertOne(studentData);
    return { ...studentData, _id: result.insertedId };
  }

  async findById(id: string | ObjectId) {
    if (!this.isValidObjectId(id)) {
      throw new BadRequestException('Invalid student ID');
    }
    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) return null;
    return await collection.findOne({ _id: objectId });
  }

  async findOne(filter: any) {
    const collection = this.getCollection();
    return await collection.findOne(filter);
  }

  async find(filter: any = {}, options: any = {}) {
    const collection = this.getCollection();
    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;
    const sortBy = options.sortBy || 'createdAt';
    const order = options.order || 'desc';
    const sortOrder = order === 'desc' ? -1 : 1;

    const cursor = collection
      .find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ [sortBy]: sortOrder });
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

  async updateById(id: string | ObjectId, data: any) {
    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) throw new BadRequestException('Invalid ID');

    const updateData = {
      ...data,
      updatedAt: new Date(),
    };

    const result = await collection.updateOne({ _id: objectId }, { $set: updateData });

    if (result.matchedCount === 0) {
      throw new BadRequestException('Document not found');
    }

    return await collection.findOne({ _id: objectId });
  }

  async deleteById(id: string | ObjectId) {
    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) throw new BadRequestException('Invalid ID');

    const result = await collection.deleteOne({ _id: objectId });
    if (result.deletedCount === 0) {
      throw new BadRequestException('Document not found');
    }

    return { success: true };
  }

  async count(filter: any = {}) {
    const collection = this.getCollection();
    return await collection.countDocuments(filter);
  }

  async findByStudentId(studentId: string) {
    return await this.findOne({ studentId: studentId.trim() });
  }

  async findByUniqueKey(uniqueKey: string) {
    return await this.findOne({ uniqueKey: uniqueKey.toUpperCase() });
  }

  async findByEmail(email: string) {
    return await this.findOne({ email: email.toLowerCase() });
  }

  async updateLastLogin(id: string | ObjectId) {
    return await this.updateById(id, { lastLogin: new Date() });
  }

  async getActiveStudents(options: any = {}) {
    return await this.find({ status: 'active' }, options);
  }

  async getStudentsByGrade(grade: string, options: any = {}) {
    return await this.find({ grade }, options);
  }

  addVirtualFields(student: any) {
    if (!student) return student;

    return {
      ...student,
      fullName: `${student.firstName} ${student.lastName}`,
      displayName: `${student.firstName} ${student.lastName.charAt(0)}.`,
    };
  }
}

