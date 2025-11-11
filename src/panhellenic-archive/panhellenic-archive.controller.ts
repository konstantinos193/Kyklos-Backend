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
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { PanhellenicArchiveService } from './panhellenic-archive.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateArchiveFileDto } from './dto/create-archive-file.dto';

@Controller('api/panhellenic-archive')
export class PanhellenicArchiveController {
  constructor(private readonly archiveService: PanhellenicArchiveService) {}

  @Get()
  async findAll(@Query() query: any) {
    return this.archiveService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.archiveService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }), // 50MB
          new FileTypeValidator({
            fileType: /(pdf|png|jpeg|jpg|gif|doc|docx|xls|xlsx|ppt|pptx)/,
          }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @Body() body: any,
    @Request() req: any,
  ) {
    // Parse form data fields
    const createDto: CreateArchiveFileDto = {
      displayName: body.displayName,
      subject: body.subject as any,
      year: parseInt(body.year),
      description: body.description,
    };
    return this.archiveService.create(file, createDto, req.admin.id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateArchiveFileDto>,
    @Request() req: any,
  ) {
    return this.archiveService.update(id, updateDto, req.admin.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async delete(@Param('id') id: string, @Request() req: any) {
    return this.archiveService.delete(id, req.admin.id);
  }

  @Put(':id/toggle-active')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async toggleActive(@Param('id') id: string, @Request() req: any) {
    return this.archiveService.toggleActive(id, req.admin.id);
  }

  @Get(':id/proxy')
  async proxyFile(@Param('id') id: string, @Res() res: Response) {
    try {
      const { stream, mimeType, fileName } = await this.archiveService.getFileStream(id);

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // Remove X-Frame-Options to allow embedding
      res.removeHeader('X-Frame-Options');

      stream.pipe(res);
    } catch (error) {
      if (error.status) {
        res.status(error.status).json({
          success: false,
          message: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Σφάλμα κατά τη φόρτωση του αρχείου',
        });
      }
    }
  }
}

