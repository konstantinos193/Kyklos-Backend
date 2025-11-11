import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ObjectId } from 'mongodb';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { AdminService } from '../admin/admin.service';
import { StudentService } from '../students/students.service';

@Injectable()
export class ExercisesService {
  private readonly COLLECTION_NAME = 'exercises';

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly adminService: AdminService,
    private readonly studentService: StudentService,
  ) {}

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

  async create(
    files: Express.Multer.File[],
    exerciseData: {
      title: string;
      description?: string;
      subject: string;
      grade?: string;
      teacherId: string;
      textContent?: string;
    },
  ) {
    if (!exerciseData.title || !exerciseData.subject || !exerciseData.teacherId) {
      throw new BadRequestException('Title, subject, and teacherId are required');
    }

    // Verify teacher exists
    const teacher = await this.adminService.findById(exerciseData.teacherId);
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    // Upload files to Cloudinary
    const uploadedFiles: Array<{
      url: string;
      secureUrl: string;
      publicId: string;
      fileName: string;
      fileType: string;
      fileSize: number;
    }> = [];

    if (files && files.length > 0) {
      for (const file of files) {
        try {
          const cloudinaryResult = await this.cloudinaryService.uploadFile(
            file,
            'exercises',
          );
          uploadedFiles.push({
            url: cloudinaryResult.url,
            secureUrl: cloudinaryResult.secureUrl,
            publicId: cloudinaryResult.publicId,
            fileName: file.originalname,
            fileType: file.mimetype,
            fileSize: file.size,
          });
        } catch (error) {
          console.error('Error uploading file:', error);
          throw new BadRequestException(`Failed to upload file: ${file.originalname}`);
        }
      }
    }

    const collection = this.getCollection();
    const exercise = {
      title: exerciseData.title,
      description: exerciseData.description || '',
      textContent: exerciseData.textContent || '',
      subject: exerciseData.subject,
      grade: exerciseData.grade || null,
      teacherId: this.toObjectId(exerciseData.teacherId),
      teacherName: teacher.name,
      teacherSpecialization: teacher.specialization || null,
      files: uploadedFiles,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await collection.insertOne(exercise);
    return { ...exercise, _id: result.insertedId };
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

    return await query.toArray();
  }

  async findById(id: string | ObjectId) {
    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) return null;
    return await collection.findOne({ _id: objectId });
  }

  async findByTeacher(teacherId: string | ObjectId, filters: any = {}) {
    const collection = this.getCollection();
    const objectId = this.toObjectId(teacherId);
    if (!objectId) return [];

    const filter = {
      teacherId: objectId,
      ...filters,
    };

    return await collection.find(filter).sort({ createdAt: -1 }).toArray();
  }

  async findForStudent(studentId: string | ObjectId, filters: any = {}) {
    const student = await this.studentService.findById(studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const collection = this.getCollection();
    const filter: any = {
      isActive: true,
      ...filters,
    };

    // Filter by student's grade if exercise has grade restriction
    if (student.grade) {
      filter.$or = [
        { grade: null },
        { grade: student.grade },
        { grade: { $exists: false } },
      ];
    }

    // Filter by student's subjects if available
    if (student.subjects && student.subjects.length > 0) {
      filter.$or = [
        ...(filter.$or || []),
        { subject: { $in: student.subjects } },
      ];
    }

    return await collection.find(filter).sort({ createdAt: -1 }).toArray();
  }

  async update(id: string | ObjectId, updateData: any) {
    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) throw new BadRequestException('Invalid ID');

    const update = {
      ...updateData,
      updatedAt: new Date(),
    };

    const result = await collection.updateOne({ _id: objectId }, { $set: update });

    if (result.matchedCount === 0) {
      throw new NotFoundException('Exercise not found');
    }

    return await this.findById(id);
  }

  async delete(id: string | ObjectId) {
    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) throw new BadRequestException('Invalid ID');

    const exercise = await this.findById(id);
    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }

    // Delete files from Cloudinary
    if (exercise.files && exercise.files.length > 0) {
      for (const file of exercise.files) {
        try {
          await this.cloudinaryService.deleteFile(file.publicId);
        } catch (error) {
          console.error('Error deleting file from Cloudinary:', error);
        }
      }
    }

    const result = await collection.deleteOne({ _id: objectId });
    return result.deletedCount > 0;
  }

  async count(filter: any = {}) {
    const collection = this.getCollection();
    return await collection.countDocuments(filter);
  }

  async addFiles(id: string | ObjectId, files: Express.Multer.File[]) {
    const exercise = await this.findById(id);
    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }

    const uploadedFiles: Array<{
      url: string;
      secureUrl: string;
      publicId: string;
      fileName: string;
      fileType: string;
      fileSize: number;
    }> = [];

    if (files && files.length > 0) {
      for (const file of files) {
        try {
          const cloudinaryResult = await this.cloudinaryService.uploadFile(
            file,
            'exercises',
          );
          uploadedFiles.push({
            url: cloudinaryResult.url,
            secureUrl: cloudinaryResult.secureUrl,
            publicId: cloudinaryResult.publicId,
            fileName: file.originalname,
            fileType: file.mimetype,
            fileSize: file.size,
          });
        } catch (error) {
          console.error('Error uploading file:', error);
          throw new BadRequestException(`Failed to upload file: ${file.originalname}`);
        }
      }
    }

    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    await collection.updateOne(
      { _id: objectId },
      {
        $push: { files: { $each: uploadedFiles } } as any,
        $set: { updatedAt: new Date() },
      },
    );

    return await this.findById(id);
  }

  async deleteFile(id: string | ObjectId, filePublicId: string) {
    const exercise = await this.findById(id);
    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }

    const file = exercise.files?.find((f: any) => f.publicId === filePublicId);
    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Delete from Cloudinary
    try {
      await this.cloudinaryService.deleteFile(filePublicId);
    } catch (error) {
      console.error('Error deleting file from Cloudinary:', error);
    }

    // Remove from database
    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    await collection.updateOne(
      { _id: objectId },
      {
        $pull: { files: { publicId: filePublicId } } as any,
        $set: { updatedAt: new Date() },
      },
    );

    return await this.findById(id);
  }
}

