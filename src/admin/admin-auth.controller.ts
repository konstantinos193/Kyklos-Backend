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
import { ConfigService } from '@nestjs/config';
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
    private readonly configService: ConfigService,
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

    // Check if JWT_SECRET is configured using ConfigService
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    const envJwtSecret = process.env.JWT_SECRET;
    
    console.log('JWT_SECRET from ConfigService:', jwtSecret ? 'EXISTS' : 'MISSING', jwtSecret?.substring(0, 20) + '...');
    console.log('JWT_SECRET from process.env:', envJwtSecret ? 'EXISTS' : 'MISSING', envJwtSecret?.substring(0, 20) + '...');
    
    const finalJwtSecret = jwtSecret || envJwtSecret;
    
    if (!finalJwtSecret || finalJwtSecret === 'your-super-secret-jwt-key-here' || finalJwtSecret.trim() === '') {
      console.error('JWT_SECRET is not configured properly. Please set it in your .env file.');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error: JWT secret not configured',
      });
    }

    // JwtModule is already configured with the secret, so we can use it directly
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

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Request() req: any, @Res() res: Response) {
    try {
      // Extract token from header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'No token provided',
        });
      }

      const token = authHeader.substring(7);
      
      // Try to verify token, but allow expired tokens for refresh
      let decoded: any;
      try {
        decoded = await this.jwtService.verifyAsync(token);
      } catch (error: any) {
        // If token is expired, try to decode without verification
        if (error.name === 'TokenExpiredError') {
          decoded = this.jwtService.decode(token) as any;
          if (!decoded) {
            return res.status(401).json({
              success: false,
              message: 'Invalid token',
            });
          }
        } else {
          return res.status(401).json({
            success: false,
            message: 'Invalid token',
          });
        }
      }

      // Verify admin still exists and is active
      const adminData = await this.adminService.findById(decoded.id);
      if (!adminData || !adminData.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Admin account is not active',
        });
      }

      // Generate new token
      const newToken = this.jwtService.sign({
        id: adminData._id,
        email: adminData.email,
        name: adminData.name,
        role: adminData.role,
      });

      res.cookie('adminToken', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
      });

      return res.json({
        success: true,
        message: 'Token refreshed successfully',
        token: newToken,
        admin: {
          _id: adminData._id,
          email: adminData.email,
          name: adminData.name,
          role: adminData.role,
        },
      });
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Failed to refresh token',
      });
    }
  }
}

