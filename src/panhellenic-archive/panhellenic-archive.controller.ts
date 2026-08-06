import {
  BadRequestException,
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
  Headers,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Response } from 'express';
import {
  ARCHIVE_MAX_FILE_SIZE,
  ARCHIVE_UNSUPPORTED_TYPE_MESSAGE,
  ARCHIVE_UPLOAD_DIR,
  isAllowedArchiveFile,
} from './panhellenic-archive.constants';
import { PanhellenicArchiveService } from './panhellenic-archive.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateArchiveFileDto, ArchiveSubject } from './dto/create-archive-file.dto';
import { UploadArchiveFileDto } from './dto/upload-archive-file.dto';
import { ArchiveQueryDto } from './dto/archive-query.dto';
import { CacheService } from '../cache/cache.service';
import { AdminRequest } from '../common/interfaces/request.interface';

@Controller('api/panhellenic-archive')
export class PanhellenicArchiveController {
  private readonly logger = new Logger(PanhellenicArchiveController.name);
  private readonly RATE_LIMIT_WINDOW = 60; // 60 seconds
  private readonly RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute

  constructor(
    private readonly archiveService: PanhellenicArchiveService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Rate limiter using cache service (Redis in production)
   */
  private async checkRateLimit(identifier: string): Promise<boolean> {
    const cacheKey = `ratelimit:proxy:${identifier}`;
    const current = await this.cacheService.get(cacheKey);

    if (!current) {
      // First request or expired
      await this.cacheService.set(cacheKey, { count: 1 }, this.RATE_LIMIT_WINDOW);
      return true;
    }

    if (current.count >= this.RATE_LIMIT_MAX_REQUESTS) {
      return false;
    }

    // Increment count
    await this.cacheService.set(cacheKey, { count: current.count + 1 }, this.RATE_LIMIT_WINDOW);
    return true;
  }

  @Get()
  async findAll(@Query() query: ArchiveQueryDto) {
    return this.archiveService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.archiveService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      // Reject anything that is not whitelisted BEFORE multer writes it to disk,
      // otherwise every rejected upload leaves an orphan file behind.
      fileFilter: (req, file, cb) => {
        if (!isAllowedArchiveFile(file.mimetype, file.originalname)) {
          cb(new BadRequestException(ARCHIVE_UNSUPPORTED_TYPE_MESSAGE), false);
          return;
        }
        cb(null, true);
      },
      limits: {
        fileSize: ARCHIVE_MAX_FILE_SIZE,
        files: 1,
      },
      storage: diskStorage({
        destination: (req, file, cb) => {
          try {
            // The directory can vanish between restarts (fresh volume, manual cleanup).
            fs.mkdirSync(ARCHIVE_UPLOAD_DIR, { recursive: true });
            cb(null, ARCHIVE_UPLOAD_DIR);
          } catch (error: any) {
            cb(error, ARCHIVE_UPLOAD_DIR);
          }
        },
        filename: (req, file, cb) => {
          // Never reuse the client-supplied name on disk - it is attacker controlled.
          // The extension is already whitelisted by fileFilter above.
          const ext = path.extname(file.originalname).toLowerCase();
          cb(null, `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`);
        },
      }),
    })
  )
  async create(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: ARCHIVE_MAX_FILE_SIZE }),
          // diskStorage gives us no file.buffer, so magic-number sniffing is impossible
          // here - without this flag NestJS 11 rejects every single upload.
          new FileTypeValidator({
            fileType: /^(application\/(pdf|msword|vnd\.ms-excel|vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\.[a-z]+ml\.[a-z]+)|image\/(png|jpe?g|gif))$/,
            skipMagicNumbersValidation: true,
          }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @Body() uploadDto: UploadArchiveFileDto,
    @Request() req: AdminRequest,
  ) {
    // Decode UTF-8 filename if it's encoded
    let originalName = file.originalname;
    try {
      // Try to decode if it's percent-encoded
      if (originalName.includes('%')) {
        originalName = decodeURIComponent(originalName);
      }
    } catch (e) {
      // If decoding fails, use original
      this.logger.warn('Failed to decode filename, using original');
    }

    // Update file object with decoded name
    file.originalname = originalName;

    // Parse form data fields
    const createDto: CreateArchiveFileDto = {
      displayName: uploadDto.displayName,
      subject: uploadDto.subject as ArchiveSubject,
      year: parseInt(uploadDto.year),
      description: uploadDto.description,
    };
    return this.archiveService.create(file, createDto, req.admin.id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateArchiveFileDto>,
    @Request() req: AdminRequest,
  ) {
    return this.archiveService.update(id, updateDto, req.admin.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async delete(@Param('id') id: string, @Request() req: AdminRequest) {
    return this.archiveService.delete(id, req.admin.id);
  }

  @Put(':id/toggle-active')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async toggleActive(@Param('id') id: string, @Request() req: AdminRequest) {
    return this.archiveService.toggleActive(id, req.admin.id);
  }

  // NOTE: @Res() is used WITHOUT passthrough on purpose. With passthrough the global
  // TransformInterceptor wraps the handler's (undefined) return value and writes
  // {"success":true,...} over the piped file, so the endpoint served JSON labelled
  // as application/pdf instead of the document.
  @Get(':id/proxy')
  async proxyFile(
    @Param('id') id: string,
    @Res() res: Response,
    @Headers() headers: any,
  ) {
    // Rate limiting based on IP
    const clientIp = headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown';
    if (!(await this.checkRateLimit(clientIp))) {
      this.logger.warn(`Rate limit exceeded for IP: ${clientIp}`);
      res.status(429).json({
        success: false,
        message: 'Πολλά αιτήματα. Παρακαλώ δοκιμάστε ξανά σε λίγο.',
      });
      return;
    }

    try {
      const { stream, mimeType, fileName } = await this.archiveService.getFileStream(id);

      res.setHeader('Content-Type', mimeType);
      // Greek file names are not valid in a bare filename="..." parameter, so send an
      // ASCII fallback plus the RFC 5987 encoded form.
      const asciiName = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      );
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // Remove X-Frame-Options to allow embedding
      res.removeHeader('X-Frame-Options');
      // Add CORS headers for embedding
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Handle stream errors
      stream.on('error', (error) => {
        this.logger.error(`Stream error for file ${id}:`, error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Σφάλμα κατά τη φόρτωση του αρχείου',
          });
        }
      });

      stream.pipe(res);
    } catch (error: any) {
      this.logger.error(`Proxy error for file ${id}:`, error);
      
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

