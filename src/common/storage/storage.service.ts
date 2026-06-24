import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export interface StorageFile {
  filename: string;
  path: string;
  size: number;
  mimetype: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || './uploads';
    this.ensureUploadDir();
  }

  private ensureUploadDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`Created upload directory: ${this.uploadDir}`);
    }
  }

  async saveFile(
    buffer: Buffer,
    filename: string,
    subfolder?: string,
  ): Promise<StorageFile> {
    const targetDir = subfolder
      ? path.join(this.uploadDir, subfolder)
      : this.uploadDir;

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filePath = path.join(targetDir, filename);
    await fs.promises.writeFile(filePath, buffer);

    const stats = await fs.promises.stat(filePath);

    return {
      filename,
      path: filePath,
      size: stats.size,
      mimetype: this.getMimetype(filename),
    };
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        this.logger.log(`Deleted file: ${filePath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete file ${filePath}:`, error);
      throw error;
    }
  }

  async readFile(filePath: string): Promise<Buffer> {
    return fs.promises.readFile(filePath);
  }

  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  private getMimetype(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}
