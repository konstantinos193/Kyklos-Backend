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
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { CreateAdminDto } from './dto/create-admin.dto';
import { LoginDto } from './dto/login.dto';
import { AdminRequest } from '../common/interfaces/request.interface';
@Controller('api/admin/auth')
export class AdminAuthController {
  constructor(
    private readonly adminService: AdminService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createAdmin(@Body() createAdminDto: CreateAdminDto) {
    const { email, password, name, role = 'admin', isActive = true, permissions } = createAdminDto;

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
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { email, password } = loginDto;
    const normalizedEmail = email.toLowerCase().trim();

    const admin = await this.adminService.findByEmail(normalizedEmail);
    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!admin.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.adminService.updateLastLogin(admin._id);

    // JwtModule is already configured with the secret, so we can use it directly
    const token = this.jwtService.sign({
      id: admin._id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    });

    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return {
      success: true,
      message: 'Login successful',
      admin: {
        _id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
      token,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('adminToken');
    return {
      success: true,
      message: 'Logout successful',
    };
  }

  @Get('verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verify(@Request() req: AdminRequest) {
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
  async refresh(@Request() req: AdminRequest, @Res({ passthrough: true }) res: Response) {
    // Extract token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
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
          throw new UnauthorizedException('Invalid token');
        }
      } else {
        throw new UnauthorizedException('Invalid token');
      }
    }

    // Verify admin still exists and is active
    const adminData = await this.adminService.findById(decoded.id);
    if (!adminData || !adminData.isActive) {
      throw new UnauthorizedException('Admin account is not active');
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
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return {
      success: true,
      message: 'Token refreshed successfully',
      token: newToken,
      admin: {
        _id: adminData._id,
        email: adminData.email,
        name: adminData.name,
        role: adminData.role,
      },
    };
  }
}

