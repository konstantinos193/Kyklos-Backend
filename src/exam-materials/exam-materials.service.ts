import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { StudentService } from '../students/students.service';
import { AdminService } from '../admin/admin.service';
import { ObjectId } from 'mongodb';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class ExamMaterialsService {
  private readonly COLLECTION_NAME = 'exammaterials';

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly studentService: StudentService,
    private readonly adminService: AdminService,
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

  async hasStudentAccess(material: any, student: any): Promise<boolean> {
    // Check if material is active and not locked
    if (!material.isActive || material.isLocked) {
      return false;
    }

    // Ensure accessPermissions exists
    const accessPermissions = material.accessPermissions || {
      students: [],
      grades: [],
      subjects: [],
      timeRestrictions: null,
    };

    // Check access level
    const studentAccessLevel = student.accessLevel || 'basic';
    const accessLevels = ['basic', 'premium', 'vip'];
    const studentLevelIndex = accessLevels.indexOf(studentAccessLevel);
    const materialLevelIndex = accessLevels.indexOf(material.accessLevel || 'basic');

    if (studentLevelIndex < materialLevelIndex) {
      return false;
    }

    // Check specific permissions - if any are set, they must be satisfied
    if (accessPermissions.students && accessPermissions.students.length > 0) {
      if (!accessPermissions.students.includes(student._id.toString())) {
        return false;
      }
    }

    if (accessPermissions.grades && accessPermissions.grades.length > 0) {
      if (!accessPermissions.grades.includes(student.grade)) {
        return false;
      }
    }

    if (accessPermissions.subjects && accessPermissions.subjects.length > 0) {
      const studentSubjects = student.subjects || [];
      const hasSubjectAccess = accessPermissions.subjects.some((subject: string) =>
        studentSubjects.includes(subject),
      );
      if (!hasSubjectAccess) {
        return false;
      }
    }

    // Check time restrictions
    if (accessPermissions.timeRestrictions) {
      const now = new Date();
      const { startDate, endDate } = accessPermissions.timeRestrictions;

      if (startDate && now < new Date(startDate)) {
        return false;
      }

      if (endDate && now > new Date(endDate)) {
        return false;
      }
    }

    return true;
  }

  async findAllForStudent(studentId: string, filters: any = {}) {
    const student = await this.studentService.findById(studentId);
    if (!student || student.status !== 'active') {
      throw new ForbiddenException('Μη έγκυρος μαθητής');
    }

    // Check if student has access to exam materials
    if (!student.hasAccessToThemata) {
      throw new ForbiddenException(
        'Δεν έχετε πρόσβαση στα θέματα πανελληνίων. Επικοινωνήστε με το φροντιστήριο.',
      );
    }

    // Build filters
    const query: any = {
      isActive: true,
      isLocked: false,
    };

    if (filters.subject) query.subject = filters.subject;
    if (filters.grade) query.grade = filters.grade;
    if (filters.type) query.type = filters.type;
    if (filters.year) query.year = parseInt(filters.year);

    // Pagination
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const collection = this.getCollection();
    const materials = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .project({ filePath: 0 })
      .toArray();

    // Filter materials based on student access
    const accessibleMaterials = [];
    for (const material of materials) {
      if (await this.hasStudentAccess(material, student)) {
        accessibleMaterials.push(material);
      }
    }

    // Get total count for pagination
    const totalCount = await collection.countDocuments(query);

    return {
      success: true,
      data: accessibleMaterials,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    };
  }

  async findByIdForStudent(id: string, studentId: string) {
    const student = await this.studentService.findById(studentId);
    if (!student || student.status !== 'active') {
      throw new ForbiddenException('Μη έγκυρος μαθητής');
    }

    // Check if student has access to exam materials
    if (!student.hasAccessToThemata) {
      throw new ForbiddenException(
        'Δεν έχετε πρόσβαση στα θέματα πανελληνίων. Επικοινωνήστε με το φροντιστήριο.',
      );
    }

    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    const material = await collection.findOne({
      _id: objectId || { $exists: false },
    });

    if (!material) {
      throw new NotFoundException('Το υλικό δεν βρέθηκε');
    }

    // Check if student has access
    if (!(await this.hasStudentAccess(material, student))) {
      throw new ForbiddenException('Δεν έχετε πρόσβαση σε αυτό το υλικό');
    }

    return {
      success: true,
      data: material,
    };
  }

  async downloadForStudent(id: string, studentId: string) {
    const student = await this.studentService.findById(studentId);
    if (!student || student.status !== 'active') {
      throw new ForbiddenException('Μη έγκυρος μαθητής');
    }

    // Check if student has access to exam materials
    if (!student.hasAccessToThemata) {
      throw new ForbiddenException(
        'Δεν έχετε πρόσβαση στα θέματα πανελληνίων. Επικοινωνήστε με το φροντιστήριο.',
      );
    }

    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    const material = await collection.findOne({
      _id: objectId || { $exists: false },
    });

    if (!material) {
      throw new NotFoundException('Το υλικό δεν βρέθηκε');
    }

    // Check if student has access
    if (!(await this.hasStudentAccess(material, student))) {
      throw new ForbiddenException('Δεν έχετε πρόσβαση σε αυτό το υλικό');
    }

    // Check if file exists
    try {
      await fs.access(material.filePath);
    } catch (error) {
      throw new NotFoundException('Το αρχείο δεν βρέθηκε στον διακομιστή');
    }

    // Increment download count
    await this.incrementDownload(id);

    return {
      filePath: material.filePath,
      fileName: material.fileName,
      mimeType: material.mimeType,
      fileSize: material.fileSize,
    };
  }

  async findAllForAdmin(filters: any = {}, adminId?: string) {
    const query: any = {};

    if (filters.subject) query.subject = filters.subject;
    if (filters.grade) query.grade = filters.grade;
    if (filters.type) query.type = filters.type;
    if (filters.status) {
      if (filters.status === 'active') query.isActive = true;
      if (filters.status === 'inactive') query.isActive = false;
      if (filters.status === 'locked') query.isLocked = true;
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const collection = this.getCollection();
    const materials = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const totalCount = await collection.countDocuments(query);

    return {
      success: true,
      data: materials,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    };
  }

  async findByIdForAdmin(id: string) {
    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) {
      throw new NotFoundException('Invalid exam material ID');
    }

    const material = await collection.findOne({ _id: objectId });
    if (!material) {
      throw new NotFoundException('Το υλικό δεν βρέθηκε');
    }

    return {
      success: true,
      data: material,
    };
  }

  async create(data: any, adminId: string) {
    const admin = await this.adminService.findById(adminId);
    if (!admin) {
      throw new ForbiddenException('Admin not found');
    }

    const collection = this.getCollection();

    // Parse tags
    const tagArray = data.tags
      ? data.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag)
      : [];

    const examMaterial = {
      title: data.title,
      description: data.description,
      subject: data.subject,
      grade: data.grade,
      year: parseInt(data.year),
      type: data.type,
      accessLevel: data.accessLevel || 'basic',
      filePath: data.filePath,
      fileName: data.fileName,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      tags: tagArray,
      uploadedBy: adminId,
      uploadedByName: admin.name || admin.email || 'Admin',
      metadata: {
        difficulty: data.metadata?.difficulty || 'medium',
        duration: parseInt(data.metadata?.duration || 120),
        questions: parseInt(data.metadata?.questions || 0),
        points: parseInt(data.metadata?.points || 0),
      },
      isActive: true,
      isLocked: false,
      downloadCount: 0,
      createdAt: new Date(),
    };

    const result = await collection.insertOne(examMaterial);

    return {
      success: true,
      message: 'Το υλικό ανέβηκε επιτυχώς',
      data: { ...examMaterial, _id: result.insertedId },
    };
  }

  async update(id: string, data: any, adminId: string) {
    const admin = await this.adminService.findById(adminId);
    if (!admin) {
      throw new ForbiddenException('Admin not found');
    }

    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) {
      throw new NotFoundException('Invalid exam material ID');
    }

    const material = await collection.findOne({ _id: objectId });
    if (!material) {
      throw new NotFoundException('Το υλικό δεν βρέθηκε');
    }

    // Update fields
    const updateFields: any = {};
    if (data.title) updateFields.title = data.title;
    if (data.description) updateFields.description = data.description;
    if (data.subject) updateFields.subject = data.subject;
    if (data.grade) updateFields.grade = data.grade;
    if (data.year) updateFields.year = parseInt(data.year);
    if (data.type) updateFields.type = data.type;
    if (data.accessLevel) updateFields.accessLevel = data.accessLevel;
    if (data.isActive !== undefined) updateFields.isActive = data.isActive;
    if (data.isLocked !== undefined) updateFields.isLocked = data.isLocked;
    if (data.lockReason) updateFields.lockReason = data.lockReason;

    if (data.tags) {
      updateFields.tags = data.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag);
    }

    if (data.metadata) {
      updateFields.metadata = { ...material.metadata, ...data.metadata };
    }

    updateFields.updatedAt = new Date();

    const result = await collection.findOneAndUpdate(
      { _id: objectId },
      { $set: updateFields },
      { returnDocument: 'after' },
    );

    return {
      success: true,
      message: 'Το υλικό ενημερώθηκε επιτυχώς',
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
      throw new NotFoundException('Invalid exam material ID');
    }

    const material = await collection.findOne({ _id: objectId });
    if (!material) {
      throw new NotFoundException('Το υλικό δεν βρέθηκε');
    }

    // Delete file from filesystem
    try {
      await fs.unlink(material.filePath);
    } catch (error) {
      console.error('Error deleting file:', error);
    }

    // Delete from database
    await collection.deleteOne({ _id: objectId });

    return {
      success: true,
      message: 'Το υλικό διαγράφηκε επιτυχώς',
    };
  }

  private async incrementDownload(id: string) {
    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) return;

    await collection.updateOne(
      { _id: objectId },
      {
        $inc: { downloadCount: 1 },
        $set: { lastDownloaded: new Date() },
      },
    );
  }
}
