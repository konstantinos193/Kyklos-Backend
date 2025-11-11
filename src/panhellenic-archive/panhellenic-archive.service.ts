import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AdminService } from '../admin/admin.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { ObjectId } from 'mongodb';
import { CreateArchiveFileDto } from './dto/create-archive-file.dto';
import * as https from 'https';
import * as http from 'http';

@Injectable()
export class PanhellenicArchiveService {
  private readonly COLLECTION_NAME = 'panhellenicarchive';

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly adminService: AdminService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

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

  async findAll(filters: any = {}) {
    const query: any = {
      isActive: true,
    };

    if (filters.subject) query.subject = filters.subject;
    if (filters.year) query.year = parseInt(filters.year);

    const collection = this.getCollection();
    const files = await collection
      .find(query)
      .sort({ year: -1, subject: 1, createdAt: -1 })
      .toArray();

    return {
      success: true,
      data: files,
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

    // Upload to Cloudinary
    let cloudinaryResult;
    try {
      cloudinaryResult = await this.cloudinaryService.uploadFile(file, 'panhellenic-archive');
    } catch (error) {
      console.error('Error uploading to Cloudinary:', error);
      throw new BadRequestException('Σφάλμα κατά το ανέβασμα του αρχείου');
    }

    const collection = this.getCollection();

    // Generate fileName from displayName if not provided
    const fileName = file.originalname || `${createDto.displayName}.${file.mimetype.split('/')[1]}`;

    const archiveFile = {
      displayName: createDto.displayName,
      fileName,
      subject: createDto.subject,
      year: createDto.year,
      description: createDto.description || '',
      fileUrl: cloudinaryResult.secureUrl,
      publicId: cloudinaryResult.publicId,
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

    // Delete from Cloudinary
    if (file.publicId) {
      try {
        // Determine resource type based on mimeType
        // PDFs and documents are stored as 'raw', images/videos as 'auto'
        const isPdf = file.mimeType === 'application/pdf';
        const isDocument = [
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ].includes(file.mimeType);
        
        const resourceType = isPdf || isDocument ? 'raw' : 'auto';
        await this.cloudinaryService.deleteFile(file.publicId, resourceType);
      } catch (error) {
        console.error('Error deleting file from Cloudinary:', error);
        // Continue with database deletion even if Cloudinary deletion fails
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
   * Get file stream for proxying
   * This is used to serve files that might not be directly accessible (e.g., old uploads)
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

    // Determine resource type based on mimeType
    const isPdf = file.mimeType === 'application/pdf';
    const isDocument = [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ].includes(file.mimeType);
    
    const resourceType = isPdf || isDocument ? 'raw' : 'image';

    // Get the Cloudinary URL
    const cloudinaryUrl = this.cloudinaryService.getFileUrl(file.publicId, resourceType);

    // Return a promise that resolves to a stream
    return new Promise((resolve, reject) => {
      const urlObj = new URL(cloudinaryUrl);
      const client = urlObj.protocol === 'https:' ? https : http;

      const req = client.get(cloudinaryUrl, (res) => {
        if (res.statusCode === 401 || res.statusCode === 403) {
          reject(new ForbiddenException('Το αρχείο δεν είναι προσβάσιμο. Παρακαλώ ανεβάστε το ξανά.'));
          return;
        }

        if (res.statusCode !== 200) {
          reject(new NotFoundException(`Failed to fetch file: ${res.statusCode}`));
          return;
        }

        resolve({
          stream: res,
          mimeType: file.mimeType || 'application/pdf',
          fileName: file.fileName || 'file.pdf',
        });
      });

      req.on('error', (error) => {
        reject(new NotFoundException(`Failed to fetch file: ${error.message}`));
      });
    });
  }
}

