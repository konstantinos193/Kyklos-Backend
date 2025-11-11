import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards, UseInterceptors, UploadedFiles, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { NewsService } from './news.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateNewsDto, NewsType } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';

@Controller('api/news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: NewsType,
    @Query('search') search?: string,
    @Query('featured') featured?: string,
  ) {
    return this.newsService.findAll({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      type,
      search,
      featured,
    });
  }

  @Get('types')
  async getTypes() {
    return this.newsService.getTypes();
  }

  @Get('announcements')
  async getAnnouncements() {
    return this.newsService.getByType(NewsType.ANNOUNCEMENT);
  }

  @Get('events')
  async getEvents() {
    return this.newsService.getByType(NewsType.EVENT);
  }

  @Get('seminars')
  async getSeminars() {
    return this.newsService.getByType(NewsType.SEMINAR);
  }

  @Get('education')
  async getEducation() {
    return this.newsService.getByType(NewsType.EDUCATION);
  }

  @Get('universities')
  async getUniversities() {
    return this.newsService.getByType(NewsType.UNIVERSITIES);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.newsService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async create(@Body() createDto: CreateNewsDto) {
    return this.newsService.create(createDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(@Param('id') id: string, @Body() updateDto: UpdateNewsDto) {
    return this.newsService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async delete(@Param('id') id: string) {
    return this.newsService.delete(id);
  }

  @Post(':id/files')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(FilesInterceptor('files', 10))
  async addFiles(
    @Param('id') id: string,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }), // 50MB
          new FileTypeValidator({
            fileType: /(pdf|png|jpeg|jpg|gif|doc|docx|xls|xlsx|ppt|pptx|zip|rar)/,
          }),
        ],
        fileIsRequired: false,
      }),
    )
    files: Express.Multer.File[],
  ) {
    return this.newsService.addFiles(id, files || []);
  }

  @Delete(':id/files/:filePublicId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteFile(
    @Param('id') id: string,
    @Param('filePublicId') filePublicId: string,
  ) {
    return this.newsService.deleteFile(id, filePublicId);
  }
}

