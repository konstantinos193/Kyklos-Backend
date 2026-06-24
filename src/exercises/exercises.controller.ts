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
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ExercisesService } from './exercises.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { StudentJwtGuard } from '../auth/guards/student-jwt.guard';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { AdminRequest } from '../common/interfaces/request.interface';
import { StudentRequest } from '../common/interfaces/request.interface';

@Controller('api/exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  // Teacher endpoints (admin panel)
  @Get('teacher')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async getTeacherExercises(
    @Request() req: AdminRequest,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('subject') subject?: string,
    @Query('grade') grade?: string,
  ) {
    try {
      const teacherId = req.admin?.id;
      if (!teacherId) {
        return {
          success: false,
          message: 'Teacher ID not found',
        };
      }

      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 50;
      const skip = (pageNum - 1) * limitNum;

      const filters: any = {};
      if (subject) {
        filters.subject = subject;
      }
      if (grade) {
        filters.grade = grade;
      }

      const [exercises, total] = await Promise.all([
        this.exercisesService.findByTeacher(teacherId, filters),
        this.exercisesService.count({ teacherId, ...filters }),
      ]);

      // Apply pagination manually since findByTeacher doesn't support it
      const paginatedExercises = exercises.slice(skip, skip + limitNum);

      return {
        success: true,
        data: {
          exercises: paginatedExercises,
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
        message: error.message || 'Failed to fetch exercises',
      };
    }
  }

  @Post('teacher')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(FilesInterceptor('files', 10))
  @HttpCode(HttpStatus.CREATED)
  async createExercise(
    @Request() req: AdminRequest,
    @Body() createExerciseDto: CreateExerciseDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    try {
      const teacherId = req.admin?.id;
      if (!teacherId) {
        return {
          success: false,
          message: 'Teacher ID not found',
        };
      }

      const exerciseData = {
        title: createExerciseDto.title,
        description: createExerciseDto.description,
        subject: createExerciseDto.subject,
        grade: createExerciseDto.grade || null,
        teacherId,
        textContent: createExerciseDto.textContent,
      };

      const exercise = await this.exercisesService.create(files || [], exerciseData);

      return {
        success: true,
        message: 'Exercise created successfully',
        data: {
          exercise,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to create exercise',
      };
    }
  }

  @Put('teacher/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async updateExercise(
    @Param('id') id: string,
    @Request() req: AdminRequest,
    @Body() updateExerciseDto: UpdateExerciseDto,
  ) {
    try {
      const teacherId = req.admin?.id;
      const exercise = await this.exercisesService.findById(id);

      if (!exercise) {
        return {
          success: false,
          message: 'Exercise not found',
        };
      }

      // Verify teacher owns this exercise
      if (exercise.teacherId.toString() !== teacherId) {
        return {
          success: false,
          message: 'You do not have permission to update this exercise',
        };
      }

      const updateData: any = {};
      if (updateExerciseDto.title !== undefined) updateData.title = updateExerciseDto.title;
      if (updateExerciseDto.description !== undefined) updateData.description = updateExerciseDto.description;
      if (updateExerciseDto.subject !== undefined) updateData.subject = updateExerciseDto.subject;
      if (updateExerciseDto.grade !== undefined) updateData.grade = updateExerciseDto.grade;
      if (updateExerciseDto.textContent !== undefined) updateData.textContent = updateExerciseDto.textContent;
      if (updateExerciseDto.isActive !== undefined) updateData.isActive = updateExerciseDto.isActive;

      const updatedExercise = await this.exercisesService.update(id, updateData);

      return {
        success: true,
        message: 'Exercise updated successfully',
        data: {
          exercise: updatedExercise,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to update exercise',
      };
    }
  }

  @Post('teacher/:id/files')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(FilesInterceptor('files', 10))
  @HttpCode(HttpStatus.OK)
  async addFilesToExercise(
    @Param('id') id: string,
    @Request() req: AdminRequest,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    try {
      const teacherId = req.admin?.id;
      const exercise = await this.exercisesService.findById(id);

      if (!exercise) {
        return {
          success: false,
          message: 'Exercise not found',
        };
      }

      if (exercise.teacherId.toString() !== teacherId) {
        return {
          success: false,
          message: 'You do not have permission to modify this exercise',
        };
      }

      if (!files || files.length === 0) {
        return {
          success: false,
          message: 'No files provided',
        };
      }

      const updatedExercise = await this.exercisesService.addFiles(id, files);

      return {
        success: true,
        message: 'Files added successfully',
        data: {
          exercise: updatedExercise,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to add files',
      };
    }
  }

  @Delete('teacher/:id/files/:filePublicId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async deleteFileFromExercise(
    @Param('id') id: string,
    @Param('filePublicId') filePublicId: string,
    @Request() req: AdminRequest,
  ) {
    try {
      const teacherId = req.admin?.id;
      const exercise = await this.exercisesService.findById(id);

      if (!exercise) {
        return {
          success: false,
          message: 'Exercise not found',
        };
      }

      if (exercise.teacherId.toString() !== teacherId) {
        return {
          success: false,
          message: 'You do not have permission to modify this exercise',
        };
      }

      const updatedExercise = await this.exercisesService.deleteFile(id, filePublicId);

      return {
        success: true,
        message: 'File deleted successfully',
        data: {
          exercise: updatedExercise,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to delete file',
      };
    }
  }

  @Delete('teacher/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async deleteExercise(@Param('id') id: string, @Request() req: AdminRequest) {
    try {
      const teacherId = req.admin?.id;
      const exercise = await this.exercisesService.findById(id);

      if (!exercise) {
        return {
          success: false,
          message: 'Exercise not found',
        };
      }

      if (exercise.teacherId.toString() !== teacherId) {
        return {
          success: false,
          message: 'You do not have permission to delete this exercise',
        };
      }

      await this.exercisesService.delete(id);

      return {
        success: true,
        message: 'Exercise deleted successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to delete exercise',
      };
    }
  }

  // Student endpoints
  @Get('student')
  @UseGuards(StudentJwtGuard)
  @HttpCode(HttpStatus.OK)
  async getStudentExercises(
    @Request() req: StudentRequest,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('subject') subject?: string,
  ) {
    try {
      const studentId = req.student?.id;
      if (!studentId) {
        return {
          success: false,
          message: 'Student ID not found',
        };
      }

      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 50;
      const skip = (pageNum - 1) * limitNum;

      const filters: any = {};
      if (subject) {
        filters.subject = subject;
      }

      const exercises = await this.exercisesService.findForStudent(studentId, filters);
      const total = exercises.length;

      // Apply pagination
      const paginatedExercises = exercises.slice(skip, skip + limitNum);

      return {
        success: true,
        data: {
          exercises: paginatedExercises,
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
        message: error.message || 'Failed to fetch exercises',
      };
    }
  }

  @Get('student/:id')
  @UseGuards(StudentJwtGuard)
  @HttpCode(HttpStatus.OK)
  async getExerciseById(@Param('id') id: string, @Request() req: StudentRequest) {
    try {
      const exercise = await this.exercisesService.findById(id);

      if (!exercise || !exercise.isActive) {
        return {
          success: false,
          message: 'Exercise not found',
        };
      }

      return {
        success: true,
        data: {
          exercise,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to fetch exercise',
      };
    }
  }
}

