import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { StudentService } from '../students/students.service';

@Controller('api/admin/students')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminStudentsController {
  constructor(private readonly studentService: StudentService) {}

  @Get()
  async findAll(@Query() query: any) {
    const options = {
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 10,
      sortBy: query.sortBy || 'createdAt',
      order: query.order || 'desc',
    };
    return this.studentService.find({}, options);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.studentService.findById(id);
  }

  @Post()
  async create(@Body() body: any) {
    try {
      const student = await this.studentService.create(body);
      return {
        success: true,
        data: student,
        message: 'Student created successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to create student',
        },
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.studentService.updateById(id, body);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.studentService.deleteById(id);
  }
}

