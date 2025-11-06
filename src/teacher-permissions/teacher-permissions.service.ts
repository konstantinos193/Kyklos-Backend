import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AdminService } from '../admin/admin.service';
import { ObjectId } from 'mongodb';

@Injectable()
export class TeacherPermissionsService {
  private readonly COLLECTION_NAME = 'teacherpermissions';

  constructor(
    private readonly databaseService: DatabaseService,
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

  private isValid(permission: any): boolean {
    if (!permission.isActive) {
      return false;
    }

    if (permission.expiresAt && new Date() > new Date(permission.expiresAt)) {
      return false;
    }

    return true;
  }

  async findAll(filters: any = {}, adminId: string) {
    const admin = await this.adminService.findById(adminId);
    if (!admin || !['admin', 'super_admin', 'moderator'].includes(admin.role)) {
      throw new ForbiddenException('Unauthorized access');
    }

    const query: any = {};

    if (filters.teacherId) {
      const teacherObjectId = this.toObjectId(filters.teacherId);
      if (teacherObjectId) query.teacher = teacherObjectId;
    }
    if (filters.examMaterialId) {
      const materialObjectId = this.toObjectId(filters.examMaterialId);
      if (materialObjectId) query.examMaterial = materialObjectId;
    }
    if (filters.permissionType) query.permissionType = filters.permissionType;

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const collection = this.getCollection();
    const permissions = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const totalCount = await collection.countDocuments(query);

    return {
      success: true,
      data: {
        permissions,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalPermissions: totalCount,
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPrevPage: page > 1,
        },
      },
    };
  }

  async findById(id: string, adminId: string) {
    const admin = await this.adminService.findById(adminId);
    if (!admin || !['admin', 'super_admin', 'moderator'].includes(admin.role)) {
      throw new ForbiddenException('Unauthorized access');
    }

    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) {
      throw new NotFoundException('Invalid permission ID');
    }

    const permission = await collection.findOne({ _id: objectId });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    return {
      success: true,
      data: permission,
    };
  }

  async create(data: any, adminId: string) {
    const admin = await this.adminService.findById(adminId);
    if (!admin || !['admin', 'super_admin', 'moderator'].includes(admin.role)) {
      throw new ForbiddenException('Unauthorized access');
    }

    const teacherObjectId = this.toObjectId(data.teacherId);
    const examMaterialObjectId = this.toObjectId(data.examMaterialId);

    if (!teacherObjectId || !examMaterialObjectId) {
      throw new BadRequestException('Invalid teacher or exam material ID');
    }

    // Check if teacher exists
    const teacher = await this.adminService.findById(data.teacherId);
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    // Check if exam material exists (we need to check the exam materials collection)
    const examMaterialsCollection = this.databaseService.getDb().collection('exammaterials');
    const examMaterial = await examMaterialsCollection.findOne({ _id: examMaterialObjectId });
    if (!examMaterial) {
      throw new NotFoundException('Exam material not found');
    }

    // Check if permission already exists
    const collection = this.getCollection();
    const existingPermission = await collection.findOne({
      teacher: teacherObjectId,
      examMaterial: examMaterialObjectId,
      isActive: true,
    });

    if (existingPermission) {
      throw new BadRequestException('Permission already exists for this teacher and exam material');
    }

    // Create permission
    const permission = {
      teacher: teacherObjectId,
      teacherName: teacher.name || teacher.email || 'Teacher',
      examMaterial: examMaterialObjectId,
      permissionType: data.permissionType,
      grantedBy: adminId,
      grantedByName: admin.name || admin.email || 'Admin',
      grantedAt: new Date(),
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      notes: data.notes || '',
      isActive: true,
      accessLog: [],
      createdAt: new Date(),
    };

    const result = await collection.insertOne(permission);

    // Log the action
    await this.logAccess(result.insertedId.toString(), 'grant', `Permission ${data.permissionType} granted`);

    return {
      success: true,
      message: 'Permission granted successfully',
      data: { ...permission, _id: result.insertedId },
    };
  }

  async update(id: string, data: any, adminId: string) {
    const admin = await this.adminService.findById(adminId);
    if (!admin || !['admin', 'super_admin', 'moderator'].includes(admin.role)) {
      throw new ForbiddenException('Unauthorized access');
    }

    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) {
      throw new NotFoundException('Invalid permission ID');
    }

    const permission = await collection.findOne({ _id: objectId });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    // Update fields
    const updateFields: any = {};
    if (data.permissionType) updateFields.permissionType = data.permissionType;
    if (data.expiresAt !== undefined) {
      updateFields.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    }
    if (data.isActive !== undefined) updateFields.isActive = data.isActive;
    if (data.notes !== undefined) updateFields.notes = data.notes;

    updateFields.updatedAt = new Date();

    const result = await collection.findOneAndUpdate(
      { _id: objectId },
      { $set: updateFields },
      { returnDocument: 'after' },
    );

    // Log the action
    await this.logAccess(id, 'modify', 'Permission updated');

    return {
      success: true,
      message: 'Permission updated successfully',
      data: result,
    };
  }

  async delete(id: string, adminId: string) {
    const admin = await this.adminService.findById(adminId);
    if (!admin || !['admin', 'super_admin', 'moderator'].includes(admin.role)) {
      throw new ForbiddenException('Unauthorized access');
    }

    const collection = this.getCollection();
    const objectId = this.toObjectId(id);
    if (!objectId) {
      throw new NotFoundException('Invalid permission ID');
    }

    const permission = await collection.findOne({ _id: objectId });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    // Log the action before deleting
    await this.logAccess(id, 'revoke', 'Permission revoked');

    // Soft delete by setting isActive to false
    await collection.updateOne(
      { _id: objectId },
      {
        $set: {
          isActive: false,
          updatedAt: new Date(),
        },
      },
    );

    return {
      success: true,
      message: 'Permission revoked successfully',
    };
  }

  async checkPermission(teacherId: string, examMaterialId: string, action: string) {
    const teacherObjectId = this.toObjectId(teacherId);
    const examMaterialObjectId = this.toObjectId(examMaterialId);

    if (!teacherObjectId || !examMaterialObjectId) {
      return false;
    }

    const collection = this.getCollection();
    const permission = await collection.findOne({
      teacher: teacherObjectId,
      examMaterial: examMaterialObjectId,
      isActive: true,
    });

    if (!permission || !this.isValid(permission)) {
      return false;
    }

    // Check permission level
    const permissionLevels: { [key: string]: number } = {
      view: 1,
      download: 2,
      manage: 3,
      full: 4,
    };

    const requiredLevel = permissionLevels[action] || 1;
    const userLevel = permissionLevels[permission.permissionType] || 0;

    return userLevel >= requiredLevel;
  }

  async getForTeacher(teacherId: string, filters: any = {}, adminId: string) {
    const admin = await this.adminService.findById(adminId);
    if (!admin || !['admin', 'super_admin', 'moderator'].includes(admin.role)) {
      throw new ForbiddenException('Unauthorized access');
    }

    const teacherObjectId = this.toObjectId(teacherId);
    if (!teacherObjectId) {
      throw new BadRequestException('Invalid teacher ID');
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const collection = this.getCollection();
    const permissions = await collection
      .find({
        teacher: teacherObjectId,
        isActive: true,
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const totalCount = await collection.countDocuments({
      teacher: teacherObjectId,
      isActive: true,
    });

    return {
      success: true,
      data: {
        permissions,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
        },
      },
    };
  }

  async getForExamMaterial(examMaterialId: string, adminId: string) {
    const admin = await this.adminService.findById(adminId);
    if (!admin || !['admin', 'super_admin', 'moderator'].includes(admin.role)) {
      throw new ForbiddenException('Unauthorized access');
    }

    const examMaterialObjectId = this.toObjectId(examMaterialId);
    if (!examMaterialObjectId) {
      throw new BadRequestException('Invalid exam material ID');
    }

    const collection = this.getCollection();
    const permissions = await collection
      .find({
        examMaterial: examMaterialObjectId,
        isActive: true,
      })
      .sort({ createdAt: -1 })
      .toArray();

    return {
      success: true,
      data: permissions,
    };
  }

  private async logAccess(permissionId: string, action: string, details: string = '') {
    const collection = this.getCollection();
    const objectId = this.toObjectId(permissionId);
    if (!objectId) return;

    const logEntry = {
      action,
      details,
      timestamp: new Date(),
    };

    const permission = await collection.findOne({ _id: objectId });
    if (!permission) return;

    const accessLog = permission.accessLog || [];
    const updatedAccessLog = [...accessLog, logEntry].slice(-50); // Keep only last 50 log entries

    await collection.updateOne(
      { _id: objectId },
      {
        $set: {
          accessLog: updatedAccessLog,
        },
      },
    );
  }
}
