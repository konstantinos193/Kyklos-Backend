import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('api/admin/teachers')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminTeachersController {
  @Get()
  async findAll() {
    return {
      success: true,
      data: [],
      // Placeholder - will be implemented based on admin-teachers.js
    };
  }
}

