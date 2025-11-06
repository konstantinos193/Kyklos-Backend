import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { StudentService } from '../students/students.service';
import { AdminService } from './admin.service';

@Controller('api/admin/stats')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminStatsController {
  constructor(
    private readonly studentService: StudentService,
    private readonly adminService: AdminService,
  ) {}

  @Get()
  async getStats() {
    const totalStudents = await this.studentService.count();
    const activeStudents = await this.studentService.count({ status: 'active' });
    const totalAdmins = await this.adminService.count();

    return {
      success: true,
      data: {
        students: {
          total: totalStudents,
          active: activeStudents,
        },
        admins: {
          total: totalAdmins,
        },
      },
    };
  }
}

