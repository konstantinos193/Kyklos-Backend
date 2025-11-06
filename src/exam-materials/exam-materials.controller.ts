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
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ExamMaterialsService } from './exam-materials.service';
import { StudentJwtGuard } from '../auth/guards/student-jwt.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateExamMaterialDto } from './dto/create-exam-material.dto';
import { UpdateExamMaterialDto } from './dto/update-exam-material.dto';
import * as fs from 'fs';

@Controller('api/exam-materials')
export class ExamMaterialsController {
  constructor(private readonly examMaterialsService: ExamMaterialsService) {}

  @Get()
  @UseGuards(StudentJwtGuard)
  async findAllForStudent(@Query() query: any, @Request() req: any) {
    return this.examMaterialsService.findAllForStudent(req.studentId, query);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAllForAdmin(@Query() query: any, @Request() req: any) {
    return this.examMaterialsService.findAllForAdmin(query, req.admin.id);
  }

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAllForAdminList(@Query() query: any, @Request() req: any) {
    return this.examMaterialsService.findAllForAdmin(query, req.admin.id);
  }

  @Get(':id')
  @UseGuards(StudentJwtGuard)
  async findOneForStudent(@Param('id') id: string, @Request() req: any) {
    return this.examMaterialsService.findByIdForStudent(id, req.studentId);
  }

  @Get('download/:id')
  @UseGuards(StudentJwtGuard)
  async downloadForStudent(@Param('id') id: string, @Request() req: any, @Res() res: Response) {
    const fileInfo = await this.examMaterialsService.downloadForStudent(id, req.studentId);

    res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.fileName}"`);
    res.setHeader('Content-Type', fileInfo.mimeType);
    res.setHeader('Content-Length', fileInfo.fileSize);

    const fileStream = fs.createReadStream(fileInfo.filePath);
    fileStream.pipe(res);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDto: CreateExamMaterialDto, @Request() req: any) {
    return this.examMaterialsService.create(createDto, req.admin.id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateExamMaterialDto,
    @Request() req: any,
  ) {
    return this.examMaterialsService.update(id, updateDto, req.admin.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async delete(@Param('id') id: string, @Request() req: any) {
    return this.examMaterialsService.delete(id, req.admin.id);
  }
}
