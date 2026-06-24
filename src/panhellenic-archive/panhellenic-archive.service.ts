import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AdminService } from '../admin/admin.service';
import { ObjectId } from 'mongodb';
import { CreateArchiveFileDto } from './dto/create-archive-file.dto';
import * as fs from 'fs';
import * as path from 'path';

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

@Injectable()
export class PanhellenicArchiveService {
  private readonly COLLECTION_NAME = 'panhellenicarchive';
  private readonly logger = new Logger(PanhellenicArchiveService.name);
  
  // Request deduplication cache
  private readonly pendingRequests = new Map<string, Promise<any>>();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly adminService: AdminService,
  ) {
    // Ensure upload directory exists in backend public folder
    const uploadDir = path.join(process.cwd(), 'public', 'panhellenic-archive');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  }

  private getCollection() {
    return this.databaseService.getDb().collection(this.COLLECTION_NAME);
  }

  private toObjectId(id: string | ObjectId): ObjectId | null {
    if (!id) return null;
    if (typeof id === 'string') {
      if (!ObjectId.isValid(id)) return null;
      return new ObjectId(id);
    }
    return id;
  }

  /**
   * Retry utility with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      maxDelay = 30000,
      backoffMultiplier = 2,
    } = options;

    let lastError: any;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Check if we should retry this error
        if (!this.shouldRetry(error) || attempt === maxRetries) {
          throw error;
        }

        this.logger.warn(
          `Archive service operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`,
          (error as Error)?.message || String(error)
        );

        // Wait with exponential backoff
        await this.sleep(delay);
        delay = Math.min(delay * backoffMultiplier, maxDelay);
      }
    }

    throw lastError;
  }

  /**
   * Determine if an error is retryable
   */
  private shouldRetry(error: any): boolean {
    // Retry on network errors
    if (!error.response) {
      return true;
    }

    // Retry on 5xx errors
    if (error.status && error.status >= 500) {
      return true;
    }

    // Retry on timeout
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      return true;
    }

    // Don't retry on 4xx client errors
    return false;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Deduplicate requests to prevent duplicate work
   */
  private async deduplicateRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // If request is already pending, return the existing promise
    if (this.pendingRequests.has(key)) {
      this.logger.debug(`Deduplicating request: ${key}`);
      return this.pendingRequests.get(key)!;
    }

    // Create new request
    const promise = fn()
      .finally(() => {
        // Clean up after request completes
        this.pendingRequests.delete(key);
      });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  async findAll(filters: any = {}) {
    const query: any = {
      isActive: true,
    };

    if (filters.subject) query.subject = filters.subject;
    if (filters.year) query.year = parseInt(filters.year);

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const skip = (page - 1) * limit;

    const collection = this.getCollection();
    
    // Get total count
    const totalCount = await collection.countDocuments(query);
    
    // Get paginated results
    const files = await collection
      .find(query)
      .sort({ year: -1, subject: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Ensure all files have 'url' field (migrate old files)
    const filesWithUrl = files.map(file => ({
      ...file,
      url: file.url || file.fileUrl || '',
    }));

    return {
      success: true,
      data: filesWithUrl,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  async findById(id: string) {
    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) {
      throw new NotFoundException('Invalid file ID');
    }

    const file = await collection.findOne({ _id: objectId });
    if (!file) {
      throw new NotFoundException('Το αρχείο δεν βρέθηκε');
    }

    return {
      success: true,
      data: file,
    };
  }

  async create(
    file: Express.Multer.File,
    createDto: CreateArchiveFileDto,
    uploadedBy: string,
  ) {
    if (!file) {
      throw new BadRequestException('Δεν επιλέχθηκε αρχείο');
    }

    // Validate file type
    const allowedMimeTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Μη υποστηριζόμενος τύπος αρχείου. Επιτρέπονται: PDF, PNG, JPG, GIF, DOC, DOCX, XLS, XLSX, PPT, PPTX',
      );
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      throw new BadRequestException('Το αρχείο είναι πολύ μεγάλο. Μέγιστο μέγεθος: 50MB');
    }

    const admin = await this.adminService.findById(uploadedBy);
    if (!admin) {
      throw new ForbiddenException('Admin not found');
    }

    // File is already saved by diskStorage in controller
    // Use the filename that was generated by diskStorage
    const uniqueFileName = file.filename;

    const collection = this.getCollection();

    // Generate fileName from displayName if not provided
    const originalFileName = file.originalname || `${createDto.displayName}.${file.mimetype.split('/')[1]}`;

    const archiveFile = {
      displayName: createDto.displayName,
      fileName: originalFileName,
      subject: createDto.subject,
      year: createDto.year,
      description: createDto.description || '',
      url: `/public/panhellenic-archive/${uniqueFileName}`,
      fileUrl: `/public/panhellenic-archive/${uniqueFileName}`, // Keep for backward compatibility
      publicId: uniqueFileName, // Store the unique filename as publicId
      mimeType: file.mimetype,
      fileSize: file.size,
      uploadedBy: uploadedBy,
      uploadedByName: admin.name || admin.email || 'Admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await collection.insertOne(archiveFile);

    return {
      success: true,
      message: 'Το αρχείο ανέβηκε επιτυχώς',
      data: { ...archiveFile, _id: result.insertedId },
    };
  }

  async update(id: string, updateData: Partial<CreateArchiveFileDto>, adminId: string) {
    const admin = await this.adminService.findById(adminId);
    if (!admin) {
      throw new ForbiddenException('Admin not found');
    }

    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) {
      throw new NotFoundException('Invalid file ID');
    }

    const file = await collection.findOne({ _id: objectId });
    if (!file) {
      throw new NotFoundException('Το αρχείο δεν βρέθηκε');
    }

    const updateFields: any = {};
    if (updateData.displayName) updateFields.displayName = updateData.displayName;
    if (updateData.subject) updateFields.subject = updateData.subject;
    if (updateData.year) updateFields.year = updateData.year;
    if (updateData.description !== undefined) updateFields.description = updateData.description;
    updateFields.updatedAt = new Date();

    const result = await collection.findOneAndUpdate(
      { _id: objectId },
      { $set: updateFields },
      { returnDocument: 'after' },
    );

    return {
      success: true,
      message: 'Το αρχείο ενημερώθηκε επιτυχώς',
      data: result,
    };
  }

  async delete(id: string, adminId: string) {
    const admin = await this.adminService.findById(adminId);
    if (!admin) {
      throw new ForbiddenException('Admin not found');
    }

    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) {
      throw new NotFoundException('Invalid file ID');
    }

    const file = await collection.findOne({ _id: objectId });
    if (!file) {
      throw new NotFoundException('Το αρχείο δεν βρέθηκε');
    }

    // Delete from local disk in backend public folder
    if (file.publicId) {
      const filePath = path.join(process.cwd(), 'public', 'panhellenic-archive', file.publicId);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error('Error deleting file from disk:', error);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete from database
    await collection.deleteOne({ _id: objectId });

    return {
      success: true,
      message: 'Το αρχείο διαγράφηκε επιτυχώς',
    };
  }

  async toggleActive(id: string, adminId: string) {
    const admin = await this.adminService.findById(adminId);
    if (!admin) {
      throw new ForbiddenException('Admin not found');
    }

    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) {
      throw new NotFoundException('Invalid file ID');
    }

    const file = await collection.findOne({ _id: objectId });
    if (!file) {
      throw new NotFoundException('Το αρχείο δεν βρέθηκε');
    }

    const result = await collection.findOneAndUpdate(
      { _id: objectId },
      { $set: { isActive: !file.isActive, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );

    return {
      success: true,
      message: `Το αρχείο ${!file.isActive ? 'ενεργοποιήθηκε' : 'απενεργοποιήθηκε'} επιτυχώς`,
      data: result,
    };
  }

  /**
   * Get file stream from local disk
   */
  async getFileStream(id: string): Promise<{ stream: NodeJS.ReadableStream; mimeType: string; fileName: string }> {
    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) {
      throw new NotFoundException('Invalid file ID');
    }

    const file = await collection.findOne({ _id: objectId });
    if (!file) {
      throw new NotFoundException('Το αρχείο δεν βρέθηκε');
    }

    if (!file.publicId) {
      throw new NotFoundException('Το αρχείο δεν έχει publicId');
    }

    const filePath = path.join(process.cwd(), 'public', 'panhellenic-archive', file.publicId);
    
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Το αρχείο δεν βρέθηκε στο δίσκο');
    }

    const stream = fs.createReadStream(filePath);
    
    return {
      stream,
      mimeType: file.mimeType || 'application/pdf',
      fileName: file.fileName || 'file.pdf',
    };
  }
}

