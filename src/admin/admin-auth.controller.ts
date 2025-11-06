import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Controller('api/admin/auth')
export class AdminAuthController {
  constructor(
    private readonly adminService: AdminService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createAdmin(@Body() body: any) {
    const { email, password, name, role = 'admin', isActive = true, permissions } = body;

    const existingAdmin = await this.adminService.findByEmail(email);
    if (existingAdmin) {
      return {
        success: false,
        message: 'Admin with this email already exists',
      };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const adminData = {
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role,
      isActive,
      permissions:
        permissions ||
        {
          students: { create: true, read: true, update: true, delete: true },
          blog: { create: true, read: true, update: true, delete: true },
          newsletter: { create: true, read: true, update: true, delete: true },
          settings: { read: true, update: true },
        },
      createdAt: new Date(),
    };

    const admin = await this.adminService.create(adminData);

    return {
      success: true,
      message: 'Admin created successfully',
      data: {
        admin: {
          _id: admin._id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
      },
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: any, @Res() res: Response) {
    const { email, password } = body;
    const normalizedEmail = email.toLowerCase().trim();

    const admin = await this.adminService.findByEmail(normalizedEmail);
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    if (!admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated',
      });
    }

    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    await this.adminService.updateLastLogin(admin._id);

    const token = this.jwtService.sign({
      id: admin._id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    });

    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      message: 'Login successful',
      admin: {
        _id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
      token,
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res() res: Response) {
    res.clearCookie('adminToken');
    return res.json({
      success: true,
      message: 'Logout successful',
    });
  }

  @Get('verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verify(@Request() req: any) {
    const admin = req.admin;
    return {
      success: true,
      data: {
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
      },
    };
  }
}

