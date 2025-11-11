import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import * as bcrypt from 'bcryptjs';

@Controller('api/admin/admins')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminManagementController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllAdmins(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('role') role?: string,
    @Query('search') search?: string,
  ) {
    try {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 50;
      const skip = (pageNum - 1) * limitNum;

      const filter: any = {};
      
      if (role) {
        filter.role = role;
      }
      
      if (search) {
        filter.$or = [
          { email: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
        ];
      }

      const [admins, total] = await Promise.all([
        this.adminService.findAll(filter, {
          skip,
          limit: limitNum,
          sort: { createdAt: -1 },
        }),
        this.adminService.count(filter),
      ]);

      return {
        success: true,
        data: {
          admins,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to fetch admins',
      };
    }
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getAdminById(@Param('id') id: string) {
    try {
      const admin = await this.adminService.findById(id);
      
      if (!admin) {
        return {
          success: false,
          message: 'Admin not found',
        };
      }

      // Remove password from response
      const { password, ...adminWithoutPassword } = admin;

      return {
        success: true,
        data: {
          admin: adminWithoutPassword,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to fetch admin',
      };
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createAdmin(@Body() body: any, @Request() req: any) {
    try {
      const { email, password, name, role = 'teacher', isActive = true, permissions, specialization } = body;

      if (!email || !password || !name) {
        return {
          success: false,
          message: 'Email, password, and name are required',
        };
      }

      const existingAdmin = await this.adminService.findByEmail(email);
      if (existingAdmin) {
        return {
          success: false,
          message: 'Admin with this email already exists',
        };
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      
      // All teachers are automatically super admins with full permissions
      const finalRole = role === 'teacher' ? 'super_admin' : role;
      
      // Full permissions for super admins (teachers)
      const defaultPermissions = permissions || {
        students: { create: true, read: true, update: true, delete: true },
        blog: { create: true, read: true, update: true, delete: true },
        newsletter: { create: true, read: true, update: true, delete: true },
        settings: { read: true, update: true },
        archive: { read: true, upload: true, delete: true },
      };

      const adminData = {
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        role: finalRole,
        isActive,
        permissions: defaultPermissions,
        specialization: specialization || null,
        createdAt: new Date(),
        createdBy: req.admin?.id || null,
      };

      const admin = await this.adminService.create(adminData);

      // Remove password from response
      const { password: _, ...adminWithoutPassword } = admin;

      return {
        success: true,
        message: 'Admin created successfully',
        data: {
          admin: adminWithoutPassword,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to create admin',
      };
    }
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateAdmin(@Param('id') id: string, @Body() body: any) {
    try {
      const { email, password, name, role, isActive, permissions, specialization } = body;

      const existingAdmin = await this.adminService.findById(id);
      if (!existingAdmin) {
        return {
          success: false,
          message: 'Admin not found',
        };
      }

      const updateData: any = {};

      if (email && email !== existingAdmin.email) {
        const emailCheck = await this.adminService.findByEmail(email);
        if (emailCheck && emailCheck._id.toString() !== id) {
          return {
            success: false,
            message: 'Email already in use by another admin',
          };
        }
        updateData.email = email.toLowerCase();
      }

      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      if (name !== undefined) {
        updateData.name = name;
      }

      if (role !== undefined) {
        updateData.role = role;
      }

      if (isActive !== undefined) {
        updateData.isActive = isActive;
      }

      if (permissions !== undefined) {
        updateData.permissions = permissions;
      }

      if (specialization !== undefined) {
        updateData.specialization = specialization;
      }

      const updatedAdmin = await this.adminService.update(id, updateData);

      if (!updatedAdmin) {
        return {
          success: false,
          message: 'Failed to update admin',
        };
      }

      // Remove password from response
      const { password: _, ...adminWithoutPassword } = updatedAdmin;

      return {
        success: true,
        message: 'Admin updated successfully',
        data: {
          admin: adminWithoutPassword,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to update admin',
      };
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteAdmin(@Param('id') id: string, @Request() req: any) {
    try {
      // Prevent self-deletion
      if (req.admin?.id === id) {
        return {
          success: false,
          message: 'You cannot delete your own account',
        };
      }

      const admin = await this.adminService.findById(id);
      if (!admin) {
        return {
          success: false,
          message: 'Admin not found',
        };
      }

      // Prevent deletion of super_admin role (optional safety check)
      if (admin.role === 'super_admin') {
        return {
          success: false,
          message: 'Cannot delete super admin account',
        };
      }

      const deleted = await this.adminService.delete(id);

      if (!deleted) {
        return {
          success: false,
          message: 'Failed to delete admin',
        };
      }

      return {
        success: true,
        message: 'Admin deleted successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to delete admin',
      };
    }
  }
}

