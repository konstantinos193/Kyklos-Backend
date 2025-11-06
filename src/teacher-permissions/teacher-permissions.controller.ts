import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TeacherPermissionsService } from './teacher-permissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateTeacherPermissionDto } from './dto/create-teacher-permission.dto';
import { UpdateTeacherPermissionDto } from './dto/update-teacher-permission.dto';

@Controller('api/teacher-permissions')
export class TeacherPermissionsController {
  constructor(private readonly teacherPermissionsService: TeacherPermissionsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAll(@Query() query: any, @Request() req: any) {
    return this.teacherPermissionsService.findAll(query, req.admin.id);
  }

  @Get('check')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async checkPermission(@Query() query: any) {
    const { teacherId, examMaterialId, action } = query;
    const hasPermission = await this.teacherPermissionsService.checkPermission(
      teacherId,
      examMaterialId,
      action,
    );
    return {
      success: true,
      data: {
        hasPermission,
        teacherId,
        examMaterialId,
        action,
      },
    };
  }

  @Get('teacher/:teacherId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getForTeacher(@Param('teacherId') teacherId: string, @Query() query: any, @Request() req: any) {
    return this.teacherPermissionsService.getForTeacher(teacherId, query, req.admin.id);
  }

  @Get('exam-material/:examMaterialId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getForExamMaterial(@Param('examMaterialId') examMaterialId: string, @Request() req: any) {
    return this.teacherPermissionsService.getForExamMaterial(examMaterialId, req.admin.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.teacherPermissionsService.findById(id, req.admin.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDto: CreateTeacherPermissionDto, @Request() req: any) {
    return this.teacherPermissionsService.create(createDto, req.admin.id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateTeacherPermissionDto,
    @Request() req: any,
  ) {
    return this.teacherPermissionsService.update(id, updateDto, req.admin.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async delete(@Param('id') id: string, @Request() req: any) {
    return this.teacherPermissionsService.delete(id, req.admin.id);
  }
}
